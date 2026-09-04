// The test-data world for /plan2: performance expansion, lookups and the few
// geographic helpers the drafter needs. Pure functions over the committed
// plan2/data/world.json shape; nothing here touches the DOM or the network.

const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function toMin(hhmm) {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

export function fromMin(min) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

// ISO date arithmetic without time zones: dates are calendar days, full stop.
export function addDays(iso, n) {
  const [y, m, d] = iso.split("-").map(Number);
  const t = Date.UTC(y, m - 1, d + n);
  return new Date(t).toISOString().slice(0, 10);
}

export function dayOfWeek(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return DOW[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
}

export function daysBetween(from, to) {
  const out = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
}

export function shortDate(iso) {
  const [, m, d] = iso.split("-").map(Number);
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${dayOfWeek(iso)} ${d} ${months[m - 1]}`;
}

export function monthName(iso) {
  const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  return months[Number(iso.split("-")[1]) - 1];
}

// A show's performances as [{date, time}] — the JSON carries a rule, not the
// list, so a run of a month reads as one line. Late-night starts (01:00) are
// kept on the calendar day they fall on; the drafter treats them as the
// previous evening's tail.
export function expandPerfs(show) {
  const p = show.perfs;
  if (p.dates) return p.dates.map(([date, time]) => ({ date, time }));
  const out = [];
  if (p.daily) {
    const except = new Set(p.daily.except || []);
    const skip = new Set(p.daily.skipDays || []);
    for (const date of daysBetween(p.daily.from, p.daily.to)) {
      if (except.has(date) || skip.has(dayOfWeek(date))) continue;
      out.push({ date, time: p.daily.time });
    }
  }
  if (p.weekly) {
    const days = new Set(p.weekly.days);
    for (const date of daysBetween(p.weekly.from, p.weekly.to)) {
      if (days.has(dayOfWeek(date))) out.push({ date, time: p.weekly.time });
    }
  }
  return out;
}

export function perfsBetween(show, from, to) {
  return expandPerfs(show).filter((p) => p.date >= from && p.date <= to);
}

export function haversineKm([lat1, lng1], [lat2, lng2]) {
  const R = 6371;
  const toRad = (x) => (x * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

// Walking at 4.5 km/h along streets that are ~30% longer than the crow flies.
export function walkMinutes(a, b) {
  if (!a || !b) return 0;
  return Math.round((haversineKm(a, b) * 1.3 / 4.5) * 60);
}

export function cityOf(world, cityId) {
  return world.cities.find((c) => c.id === cityId);
}

export function festivalsIn(world, cityId) {
  return world.festivals.filter((f) => f.cityId === cityId);
}

// Festivals overlapping a date window, or all of the city's when no window yet.
export function festivalsOn(world, cityId, from, to) {
  return festivalsIn(world, cityId).filter((f) => !from || (f.from <= to && f.to >= from));
}

export function venueOf(city, venueId) {
  return city.venues.find((v) => v.id === venueId);
}

export function showsOf(world, festivalIds) {
  const set = new Set(festivalIds);
  return world.shows.filter((s) => set.has(s.festivalId));
}

export function routesFrom(world, originId, cityId) {
  return world.routes.filter((r) => r.originId === originId && r.cityId === cityId);
}

// Cities whose festivals run in a given month (1–12), for the "by season" way in.
export function citiesInMonth(world, month) {
  const mm = String(month).padStart(2, "0");
  return world.cities.filter((c) =>
    festivalsIn(world, c.id).some((f) => f.from.slice(5, 7) <= mm && f.to.slice(5, 7) >= mm)
  );
}

export function genresOf(world) {
  return [...new Set(world.festivals.flatMap((f) => f.genres))].sort();
}
