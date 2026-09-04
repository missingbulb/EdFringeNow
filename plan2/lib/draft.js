// The drafter: answers + corrections + the world → one deterministic trip.
// No randomness, no clock: the same inputs always draft the same plan, so a
// golden can pin it and a correction re-drafts predictably.
//
// answers: { cityId, festivalIds, from, to, party: {type, ages}, cost, pace,
//            focus, originId, mode, sleep: [two of cost|comfort|location] }
// rules:   { notShow: [id], notGenre: [genre], notVenue: [venueId],
//            notTime: ["showId@date"], notMeal: [id], notOut: [id],
//            noDayOut: bool, noMeals: bool, travelShift: -1|0|1 }
// starred: [showId]   — must be in the plan, never swapped
// picks:   [showId]   — chosen by hand in the content chooser (same as starred)

import { perfsBetween, toMin, fromMin, daysBetween, dayOfWeek, walkMinutes, cityOf, venueOf, showsOf, routesFrom } from "./world.js";

const DAY_START = 8 * 60; // the calendar's first hour
const DAY_END = 24 * 60;
const GAP = 15; // minutes between the end of one thing and the start of the next

const PACE_SHOWS = { packed: 5, steady: 3, leisurely: 2 };
const COST_CAP = { thrifty: 14, between: 24, splash: Infinity };
const COST_TABLE = { thrifty: 1, between: 2, splash: 3 }; // restaurant price band ceiling

function youngest(party) {
  if (!party || party.type !== "family" || !party.ages || !party.ages.length) return null;
  return Math.min(...party.ages);
}

function partySize(party) {
  if (!party) return 2;
  if (party.type === "solo") return 1;
  if (party.type === "couple") return 2;
  if (party.type === "family") return 2 + (party.ages ? party.ages.length : 1);
  return 5;
}

// The evening ends earlier with small children: last show must START by then.
function lastStart(party) {
  const y = youngest(party);
  if (y !== null && y < 8) return 19 * 60 + 30;
  if (y !== null) return 20 * 60 + 30;
  return 22 * 60 + 30;
}

export function pickStay(city, answers) {
  const wants = new Set(answers.sleep || ["cost", "location"]);
  const size = partySize(answers.party);
  const scored = city.hotels
    .filter((h) => h.sleeps >= size)
    .filter((h) => !(answers.notStay || []).includes(h.id))
    .map((h) => ({ h, score: ["cost", "comfort", "location"].reduce((s, k) => s + (wants.has(k) ? h[k] * 2 : h[k]), 0) }))
    .sort((a, b) => b.score - a.score || a.h.perNight - b.h.perNight || a.h.id.localeCompare(b.h.id));
  return scored.length ? scored[0].h : city.hotels[0];
}

export function pickRoute(world, answers) {
  const routes = routesFrom(world, answers.originId, answers.cityId);
  if (!routes.length) return null;
  return routes.find((r) => r.mode === answers.mode) || routes[0];
}

function travelLegs(world, city, answers, rules, stay) {
  const route = pickRoute(world, answers);
  if (!route) return { out: null, back: null, route: null };
  const shift = rules.travelShift || 0;
  const arrival = city.arrivals[route.mode] || city.arrivals.train;
  const transfer = arrival && arrival.transferMin ? arrival.transferMin : 0;
  // Outbound: the departure that lands around lunchtime, nudged by the shift.
  const deps = route.departures.map(toMin);
  let outIdx = deps.findIndex((d) => d + route.minutes >= 12 * 60);
  if (outIdx < 0) outIdx = deps.length - 1;
  outIdx = Math.max(0, Math.min(deps.length - 1, outIdx + shift));
  const outDep = deps[outIdx];
  const out = { kind: "travel", mode: route.mode, start: outDep, end: outDep + route.minutes, title: `${world.origins.find((o) => o.id === answers.originId).station} → ${arrival.name}`, sub: `${route.operator} · ${partySize(answers.party)} seats`, price: route.price * partySize(answers.party), at: [arrival.lat, arrival.lng], transferMin: transfer };
  // Homeward: leave mid-afternoon on the last day so the morning is free.
  let backIdx = deps.findIndex((d) => d >= 15 * 60);
  if (backIdx < 0) backIdx = deps.length - 1;
  backIdx = Math.max(0, Math.min(deps.length - 1, backIdx + shift));
  const backDep = deps[backIdx];
  const back = { kind: "travel", mode: route.mode, start: backDep, end: backDep + route.minutes, title: `${arrival.name} → ${world.origins.find((o) => o.id === answers.originId).station}`, sub: `${route.operator} · ${partySize(answers.party)} seats`, price: route.price * partySize(answers.party), at: [stay.lat, stay.lng], transferMin: transfer };
  return { out, back, route };
}

function isOneOff(show, from, to) {
  return perfsBetween(show, from, to).length === 1;
}

function mealFor(city, answers, rules, which, when, near, usedIds, latestStart = when.min + 90) {
  if (rules.noMeals) return null;
  const y = youngest(answers.party);
  const cap = COST_TABLE[answers.cost] || 2;
  const day = dayOfWeek(when.date);
  const cands = city.restaurants
    .filter((r) => r.meals.includes(which))
    .filter((r) => !(rules.notMeal || []).includes(r.id))
    .filter((r) => y === null || r.kids)
    .filter((r) => r.price <= cap)
    .filter((r) => !r.days || r.days.includes(day))
    .filter((r) => !usedIds.has(r.id))
    .map((r) => {
      const slot = r.slots.map(toMin).find((s) => s >= when.min) ?? null;
      return { r, slot, walk: walkMinutes(near, [r.lat, r.lng]) };
    })
    .filter((x) => x.slot !== null && x.slot <= latestStart)
    .sort((a, b) => a.walk - b.walk || a.r.price - b.r.price || a.r.id.localeCompare(b.r.id));
  if (!cands.length) return null;
  const { r, slot } = cands[0];
  usedIds.add(r.id);
  const booked = r.bookable;
  return { kind: "meal", id: r.id, start: slot, end: slot + (which === "lunch" ? 60 : 75), title: r.name, sub: booked ? `table for ${partySize(answers.party)} · ${r.cuisine}` : `walk in · ${r.cuisine}`, booked, price: 0, at: [r.lat, r.lng], picture: "il-table" };
}

function dayOutFor(city, answers, rules, date, used) {
  if (rules.noDayOut) return null;
  const y = youngest(answers.party);
  const cands = city.excursions
    .filter((e) => !(rules.notOut || []).includes(e.id))
    .filter((e) => !used.has(e.id))
    .filter((e) => y === null || y >= e.kidsMin)
    .filter((e) => (COST_CAP[answers.cost] || Infinity) >= e.price)
    .sort((a, b) => a.id.localeCompare(b.id));
  if (!cands.length) return null;
  const e = cands[0];
  used.add(e.id);
  const start = toMin(e.start);
  return { kind: "out", id: e.id, start, end: start + e.hours * 60, title: e.name, sub: e.sub, price: e.price * partySize(answers.party), at: [city.lat, city.lng], picture: e.picture };
}

// Which full days get a day out: focus decides the count, the middle of the
// trip gets the first one, then every other day outward.
function dayOutDates(days, focus, stuckOn) {
  const full = days.slice(1, -1);
  const want = focus === "festival" ? 0 : focus === "city" ? Math.ceil(full.length / 2) : full.length ? 1 : 0;
  const order = [];
  const mid = Math.floor(full.length / 2);
  for (let i = 0; i < full.length; i++) {
    const idx = i % 2 === 0 ? mid + Math.ceil(i / 2) : mid - Math.ceil(i / 2);
    if (idx >= 0 && idx < full.length && !order.includes(full[idx])) order.push(full[idx]);
  }
  const chosen = new Set(order.slice(0, want));
  for (const d of stuckOn || []) chosen.add(d);
  return chosen;
}

export function draftTrip(world, answers, rules = {}, starred = []) {
  const city = cityOf(world, answers.cityId);
  const days = daysBetween(answers.from, answers.to);
  const stay = pickStay(city, { ...answers, notStay: rules.notStay });
  const { out, back, route } = travelLegs(world, city, answers, rules, stay);
  const shows = showsOf(world, answers.festivalIds || []);
  const y = youngest(answers.party);
  const cap = COST_CAP[answers.cost] || Infinity;
  const perDay = PACE_SHOWS[answers.pace] || 3;
  const latest = lastStart(answers.party);
  const starSet = new Set(starred);
  const notShow = new Set(rules.notShow || []);
  const notGenre = new Set(rules.notGenre || []);
  const notVenue = new Set(rules.notVenue || []);
  const notTime = new Set(rules.notTime || []);
  const usedShows = new Set();
  const usedMeals = new Set();
  const usedOuts = new Set();
  const outDates = dayOutDates(days, answers.focus, rules.stickOut);

  const eligible = (s) =>
    !notShow.has(s.id) && !notGenre.has(s.genre) && !notVenue.has(s.venueId) && (starSet.has(s.id) || ((y === null || s.ages <= y) && s.price <= cap && (y === null || s.ages < 16)));

  const result = { days: [], stay, route, totals: { nights: days.length - 1, stayCost: stay.perNight * (days.length - 1), travel: (out ? out.price : 0) + (back ? back.price : 0), tickets: 0 } };

  for (let di = 0; di < days.length; di++) {
    const date = days[di];
    const first = di === 0;
    const last = di === days.length - 1;
    const items = [];
    let cursor = DAY_START + 60; // 09:00 unless travel says otherwise
    let near = [stay.lat, stay.lng];
    let dayEnd = DAY_END;

    if (first && out) {
      items.push({ ...out, date });
      cursor = out.end + out.transferMin + GAP;
      near = out.at;
      const checkIn = Math.max(cursor, 14 * 60);
      items.push({ kind: "stay", date, start: checkIn, end: checkIn + 30, title: "Check in", sub: stay.name, price: 0, at: [stay.lat, stay.lng], picture: stay.kind === "hotel" ? "il-hotel" : "il-guesthouse" });
      cursor = checkIn + 30 + GAP;
      near = [stay.lat, stay.lng];
    }
    if (last && back) {
      items.push({ kind: "stay", date, start: 10 * 60, end: 10 * 60 + 30, title: "Check out", sub: "bags stay at the desk", price: 0, at: [stay.lat, stay.lng], picture: stay.kind === "hotel" ? "il-hotel" : "il-guesthouse" });
      cursor = Math.max(cursor, 10 * 60 + 30 + GAP);
      dayEnd = back.start - back.transferMin - 45;
      items.push({ ...back, date });
    }

    if (outDates.has(date) && !first && !last) {
      const o = dayOutFor(city, answers, rules, date, usedOuts);
      if (o) items.push({ ...o, date, at: [stay.lat, stay.lng] });
    }

    // Shows: fit around what the day already holds (travel, the stay, a day
    // out), starred and hand-picked shows first, then the best fit for each
    // remaining hole — a late starred concert never blocks the afternoon.
    const genresToday = new Set();
    const budget = perDay + starSet.size;
    let count = 0;
    const fits = (venueAt, start, end) => {
      const sorted = [...items].sort((a, b) => a.start - b.start);
      for (const it of sorted) {
        if (it.end + GAP + walkMinutes(it.at, venueAt) > start && it.start - GAP - walkMinutes(venueAt, it.at) < end) return null;
      }
      const prev = sorted.filter((it) => it.end <= start).at(-1);
      return { prev, gapBefore: prev ? start - prev.end : start - (DAY_START + 60) };
    };
    while (count < budget) {
      const cands = [];
      for (const s of shows) {
        if (usedShows.has(s.id) || !eligible(s)) continue;
        const venue = venueOf(city, s.venueId);
        const at = venue ? [venue.lat, venue.lng] : [stay.lat, stay.lng];
        for (const p of perfsBetween(s, answers.from, answers.to)) {
          if (p.date !== date || notTime.has(`${s.id}@${p.date}`)) continue;
          const start = toMin(p.time);
          const end = start + s.minutes;
          if (start < DAY_START + 60 || start > latest || end > dayEnd) continue;
          const fit = fits(at, start, end);
          if (!fit) continue;
          let score = 0;
          if (starSet.has(s.id)) score += 1000;
          score -= fit.gapBefore / 10; // fill the day from the front, don't leave holes
          score -= fit.prev ? walkMinutes(fit.prev.at, at) : 0;
          if (genresToday.has(s.genre)) score -= 25;
          if (answers.cost === "thrifty") score -= s.price;
          if (y !== null && s.ages <= y && s.ages > 0) score += 10; // made for the kids
          cands.push({ s, p, start, end, at, score });
        }
      }
      if (!cands.length) break;
      cands.sort((a, b) => b.score - a.score || a.start - b.start || a.s.id.localeCompare(b.s.id));
      const { s, p, start, end, at } = cands[0];
      const venue = venueOf(city, s.venueId);
      const festival = world.festivals.find((f) => f.id === s.festivalId);
      items.push({ kind: "show", id: s.id, perf: `${s.id}@${p.date}`, date, start, end, title: s.title, sub: venue ? venue.name : "", venueId: s.venueId, genre: s.genre, festivalId: s.festivalId, colour: festival.colour, icon: festival.icon, price: s.price * partySize(answers.party), unit: s.price, oneOff: isOneOff(s, answers.from, answers.to), starred: starSet.has(s.id), at });
      usedShows.add(s.id);
      genresToday.add(s.genre);
      count++;
      result.totals.tickets += s.price * partySize(answers.party);
    }
    // Meals into the gaps: lunch in the midday window, dinner in the evening
    // one; a stuck-on meal insists on a dinner even on the last day.
    items.sort((a, b) => a.start - b.start);
    const stuckMeal = (rules.stickMeal || []).includes(date);
    const windows = [["lunch", 11 * 60 + 30, 14 * 60 + 45, 60], ["dinner", 17 * 60 + 30, (last && !stuckMeal) ? dayEnd : 21 * 60 + 30, 75]];
    for (const [which, wFrom, wTo, dur] of windows) {
      if (which === "dinner" && last && !stuckMeal && dayEnd < 19 * 60) continue;
      const gaps = [];
      let c = first && out ? out.end + out.transferMin : DAY_START + 60;
      for (const it of items) { if (it.start - c >= dur + GAP) gaps.push([c, it.start - GAP, it]); c = Math.max(c, it.end + GAP); }
      if (Math.min(dayEnd, DAY_END) - c >= dur + GAP) gaps.push([c, Math.min(dayEnd, DAY_END) - GAP, null]);
      for (const [gFrom, gTo] of gaps) {
        const from = Math.max(gFrom, wFrom);
        const to = Math.min(gTo, wTo);
        if (to - from < dur) continue;
        const before = [...items].reverse().find((it) => it.end <= from + GAP);
        const m = mealFor(city, answers, rules, which, { date, min: from }, before ? before.at : [stay.lat, stay.lng], usedMeals, to - dur);
        if (m) { m.end = m.start + dur; items.push({ ...m, date }); break; }
      }
    }
    items.sort((a, b) => a.start - b.start);
    result.days.push({ date, items });
  }
  result.totals.tickets += result.days.flatMap((d) => d.items).filter((i) => i.kind === "out").reduce((s, i) => s + i.price, 0);
  return result;
}

// Free gaps of an hour or more between a day's items, for the dashed "free"
// tickets and for stick-on placement.
export function gapsOf(day, from = DAY_START + 60, to = 23 * 60) {
  const gaps = [];
  let cursor = from;
  for (const it of day.items) {
    if (it.start - cursor >= 60) gaps.push({ start: cursor, end: it.start });
    cursor = Math.max(cursor, it.end + GAP);
  }
  if (to - cursor >= 60) gaps.push({ start: cursor, end: to });
  return gaps;
}

export { DAY_START, DAY_END, fromMin };
