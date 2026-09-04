// /plan2 — the postcard trip planner, page logic.
//
// A wizard whose every answer becomes a sticker on a postcard, then the
// postcard turned over: a calendar of vertical days with one ticket per plan
// item, each of which peels off to reveal what to correct. The drafting itself
// is ./lib/draft.js (pure, deterministic); this file is state, rendering and
// gestures only. State persists in localStorage so the trip survives a reload.

import { cityOf, festivalsIn, festivalsOn, routesFrom, showsOf, perfsBetween, daysBetween, addDays, dayOfWeek, monthName, shortDate, toMin, fromMin, citiesInMonth, genresOf, venueOf } from "./lib/world.js";
import { draftTrip, gapsOf, pickStay, pickRoute, DAY_START } from "./lib/draft.js";

const STORE_KEY = "edfringe.plan2.v1";
const STEPS = ["where", "when", "who", "matters", "travel", "sleep", "draft"];
const CARD_TITLES = { where: "Where to?", when: "When?", who: "Who's coming?", matters: "What matters?", travel: "Getting there?", sleep: "Where to sleep?" };
const HOUR_PX = 40;

const MODE_PIC = { train: "il-train", plane: "il-plane", car: "il-car", coach: "il-coach" };
const MODE_WORD = { train: "Train", plane: "Fly", car: "Drive", coach: "Coach" };
const COST = [["thrifty", "Thrifty", "il-wallet"], ["between", "In between", "il-jar"], ["splash", "Splash out", "il-champagne"]];
const PACE = [["packed", "Packed", "il-sprint"], ["steady", "Steady", "il-stroll"], ["leisurely", "Leisurely", "il-deckchair"]];
const FOCUS = [["festival", "Festival only", "il-curtain"], ["mix", "A mix", "il-picnic"], ["city", "City too", "il-city"]];
const PARTY = [["solo", "Just me", "il-solo"], ["couple", "A couple", "il-couple"], ["family", "Family", "il-family"], ["group", "Friends", "il-group"]];
const SLEEP = [["cost", "Cost", "il-wallet"], ["comfort", "Comfort", "il-hotel"], ["location", "Location", "ic-pin"]];
const AGES = [3, 5, 7, 9, 12, 15];

const stage = document.getElementById("stage");
let world = null;
let state = null;
let ui = { way: "city", month: null, peel: null, chooser: false, more: 0, nameQuery: "" };

// ------------------------------------------------------------------ state --

function fresh() {
  return { v: 1, step: "where", answers: { cityId: null, festivalIds: [], from: null, to: null, party: null, cost: null, pace: null, focus: null, originId: null, mode: null, sleep: [] }, rules: {}, starred: [] };
}

function load() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) {
      const s = JSON.parse(raw);
      if (s && s.v === 1) return { ...fresh(), ...s, answers: { ...fresh().answers, ...s.answers } };
    }
  } catch (_) { /* a blocked or corrupt store just means a fresh postcard */ }
  return fresh();
}

function save() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (_) { /* fine */ }
}

function set(fn) {
  fn(state);
  save();
  render();
}

// ------------------------------------------------------------- utilities --

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const use = (id, cls = "") => `<svg class="${cls}"><use href="#${id}"></use></svg>`;
const money = (city, n) => `${city.currency}${Number.isInteger(n) ? n : n.toFixed(2)}`;
const RING = `<svg class="ring" viewBox="0 0 140 110" preserveAspectRatio="none"><path d="M18 60C6 22 60 6 100 12c30 5 40 30 30 60-10 32-70 40-104 20C10 84 10 66 30 52"></path></svg>`;

function answered(step) {
  const a = state.answers;
  switch (step) {
    case "where": return Boolean(a.cityId && a.festivalIds.length);
    case "when": return Boolean(a.from && a.to);
    case "who": return Boolean(a.party && (a.party.type !== "family" || (a.party.ages && a.party.ages.length)));
    case "matters": return Boolean(a.cost && a.pace && a.focus);
    case "travel": return Boolean(a.originId && a.mode);
    case "sleep": return a.sleep.length === 2;
    default: return true;
  }
}

function primaryFestival() {
  return world.festivals.find((f) => f.id === state.answers.festivalIds[0]);
}

function nights() {
  const a = state.answers;
  return a.from && a.to ? daysBetween(a.from, a.to).length - 1 : 0;
}

function dateRange() {
  const a = state.answers;
  if (!a.from) return "";
  const [, m1, d1] = a.from.split("-").map(Number);
  const [, , d2] = a.to.split("-").map(Number);
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${d1}–${d2} ${months[m1 - 1]}`;
}

// ------------------------------------------------------------ rendering --

function render() {
  if (!world) return;
  stage.innerHTML = state.step === "draft" ? renderBack() : renderFront();
  wire();
}

function stampHtml(f, cls = "", extra = "") {
  return `<div class="stamp ${cls}" style="--stamp:${f.colour}; ${extra}"><div class="art">${use(f.icon)}${esc(f.short)}<small>${esc(f.from.slice(8))}–${esc(f.to.slice(8))} ${monthName(f.from).slice(0, 3)}</small></div></div>`;
}

function postmarkHtml(city, extra = "") {
  const a = state.answers;
  const big = a.from && a.to ? `${Number(a.from.slice(8))}–${Number(a.to.slice(8))}` : a.from ? `${Number(a.from.slice(8))}–` : "· · ·";
  const mid = a.from ? `${monthName(a.from).slice(0, 3).toUpperCase()} ${a.from.slice(0, 4)}` : "";
  const arrival = city && city.arrivals.train ? city.arrivals.train.name : city ? city.name : "";
  return `<svg class="postmark" viewBox="0 0 300 130" width="280" height="122" style="${extra}">
    <defs><path id="pmc" d="M64 26.5a38.5 38.5 0 1 1-.01 0"></path></defs>
    <circle class="ring" cx="64" cy="65" r="50"></circle><circle class="ring" cx="64" cy="65" r="34" stroke-width="1.5"></circle>
    <text><textPath href="#pmc">${esc((city ? city.name : "").toUpperCase())} · ${esc(arrival.toUpperCase())} ·</textPath></text>
    <text class="big" x="64" y="70" text-anchor="middle">${esc(big)}</text>
    <text class="mid" x="64" y="84" text-anchor="middle">${esc(mid)}</text>
    <g class="wave"><path d="M120 44q12-8 24 0t24 0 24 0 24 0 24 0 24 0 24 0"></path><path d="M120 58q12-8 24 0t24 0 24 0 24 0 24 0 24 0 24 0"></path><path d="M120 72q12-8 24 0t24 0 24 0 24 0 24 0 24 0 24 0"></path><path d="M120 86q12-8 24 0t24 0 24 0 24 0 24 0 24 0 24 0"></path></g>
  </svg>`;
}

// Every answered question as a sticker, in the order asked. Clicking one
// reopens that question.
function answerStickers(exceptStep) {
  const a = state.answers;
  const city = a.cityId ? cityOf(world, a.cityId) : null;
  const out = [];
  const st = (step, cls, r, inner) => out.push(`<button type="button" class="sticker corner ${cls}" style="--r:${r}deg" data-reopen="${step}" title="Change this">${inner}</button>`);
  if (exceptStep !== "where" && city && answered("where")) {
    st("where", "label", -3, `${use("ic-pin")}${esc(city.name)}`);
  }
  if (exceptStep !== "when" && answered("when")) st("when", "label sun", 2, `${use("ic-sun")}${esc(dateRange())}`);
  if (exceptStep !== "who" && answered("who")) {
    const p = PARTY.find((x) => x[0] === a.party.type);
    const ages = a.party.type === "family" ? `<span class="sub">${a.party.ages.join(" · ")}</span>` : "";
    st("who", "wide", -2, `${use(p[2])}${p[1]}${ages}`);
  }
  if (exceptStep !== "matters" && answered("matters")) {
    st("matters", "sun", 4, `${use(COST.find((x) => x[0] === a.cost)[2])}${COST.find((x) => x[0] === a.cost)[1]}`);
    st("matters", "rose", -3, `${use(PACE.find((x) => x[0] === a.pace)[2])}${PACE.find((x) => x[0] === a.pace)[1]}`);
    st("matters", "mint", 2, `${use(FOCUS.find((x) => x[0] === a.focus)[2])}${FOCUS.find((x) => x[0] === a.focus)[1]}`);
  }
  if (exceptStep !== "travel" && answered("travel")) {
    const o = world.origins.find((x) => x.id === a.originId);
    st("travel", "wide", -2, `${use(MODE_PIC[a.mode])}${esc(o.station)}`);
  }
  if (exceptStep !== "sleep" && answered("sleep") && city) {
    const stay = pickStay(city, { ...a, notStay: state.rules.notStay });
    st("sleep", "rose", 3, `${use(stay.kind === "hotel" ? "il-hotel" : "il-guesthouse")}${esc(stay.name.split(" ")[0])}`);
  }
  return out.join("");
}

function renderFront() {
  const a = state.answers;
  const city = a.cityId ? cityOf(world, a.cityId) : null;
  const fests = city ? festivalsOn(world, city.id, a.from, a.to) : [];
  const on = fests.filter((f) => a.festivalIds.includes(f.id));
  const off = fests.filter((f) => !a.festivalIds.includes(f.id));
  const idx = STEPS.indexOf(state.step);
  const behind = STEPS.slice(idx + 1, idx + 3).filter((s) => s !== "draft");

  return `
  <section class="front">
    <div class="postcard card-front">
      <div class="picture">${city ? use(city.picture) : `<div class="empty">Pick a city…</div>`}${city ? `<div class="big-name">${esc(city.name)}</div>` : ""}</div>
      <div class="stamps-on">${on.map((f, i) => stampHtml(f, "", `--r:${i % 2 ? 2.5 : -3}deg`)).join("")}</div>
      ${city ? postmarkHtml(city, "right: 120px; top: 4px; transform: rotate(-8deg);") : ""}
      <div class="answers on-card">${answerStickers(state.step)}</div>
      ${answered("where") ? "" : `<div class="caption">post card</div>`}
    </div>
    <div class="tape" style="left: -10px; top: 24px; transform: rotate(-42deg);"></div>
    <div class="tape teal" style="left: 660px; top: 0; transform: rotate(38deg);"></div>
    ${city && (state.step === "where" || state.step === "when") && off.length ? `
    <div class="stampsheet"><div class="title">Also on…</div>
      ${off.map((f, i) => `<button type="button" class="stamp peel" data-fest="${f.id}" style="--stamp:${f.colour}; --r:${i % 2 ? 3 : -2}deg" title="Add ${esc(f.name)} to the trip"><div class="art">${use(f.icon)}${esc(f.short)}<small>${esc(f.from.slice(8))}–${esc(f.to.slice(8))} ${monthName(f.from).slice(0, 3)}</small></div></button>`).join("")}
    </div><div class="tape gold" style="right: 90px; top: 30px; transform: rotate(4deg); width: 90px;"></div>` : ""}
    ${behind.map((s, i) => `<div class="qcard ${i ? "behind-2" : "behind"}"><div class="hole"></div><h2 style="opacity:.35">${CARD_TITLES[s]}</h2></div>`).join("")}
    <div class="qcard current"><div class="hole"></div>${renderCard(state.step)}</div>
    ${idx > 0 ? `<button type="button" class="tag-cta quiet back" data-nav="back">${use("ic-back")} Back</button>` : ""}
    <svg class="string" viewBox="0 0 200 120" width="160" height="96" style="right: 250px; top: 730px;"><path d="M10 10c30 40 60 60 100 70"></path></svg>
    <button type="button" class="tag-cta next" data-nav="next" ${answered(state.step) ? "" : "disabled"}>${state.step === "sleep" ? "Draft my trip" : "Next"} ${use("ic-arrow")}</button>
  </section>`;
}

function optHtml(cls, key, pic, label, on, data) {
  return `<button type="button" class="opt ${cls} ${on ? "is-on" : ""}" ${data}="${key}">${use(pic)}<span>${label}</span>${RING}</button>`;
}

function renderCard(step) {
  const a = state.answers;
  const city = a.cityId ? cityOf(world, a.cityId) : null;
  switch (step) {
    case "where": {
      const ways = [["city", "City", "ic-pin"], ["season", "Season", "ic-sun"], ["genre", "Genre", "ic-masks"], ["name", "Name", "ic-search"]];
      let chooser = "";
      if (ui.way === "city") {
        chooser = `<div class="chips">${world.cities.map((c) => `<button type="button" class="chip ${a.cityId === c.id ? "is-on" : ""}" data-city="${c.id}">${use("ic-pin")}${esc(c.name)}</button>`).join("")}</div>`;
      } else if (ui.way === "season") {
        const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        chooser = `<div class="chips">${months.map((m, i) => { const cs = citiesInMonth(world, i + 1); return `<button type="button" class="chip ${cs.length ? "" : "ghost"} ${ui.month === i + 1 ? "is-on" : ""}" data-month="${i + 1}" ${cs.length ? "" : "disabled"}>${m}</button>`; }).join("")}</div>
          ${ui.month ? `<div class="chips" style="margin-top:10px">${citiesInMonth(world, ui.month).map((c) => `<button type="button" class="chip ${a.cityId === c.id ? "is-on" : ""}" data-city="${c.id}">${use("ic-pin")}${esc(c.name)}</button>`).join("")}</div>` : ""}`;
      } else if (ui.way === "genre") {
        const gs = genresOf(world);
        chooser = `<div class="chips">${gs.map((g) => `<button type="button" class="chip ${ui.genre === g ? "is-on" : ""}" data-genre="${esc(g)}">${esc(g)}</button>`).join("")}</div>
          ${ui.genre ? `<div class="chips" style="margin-top:10px">${world.festivals.filter((f) => f.genres.includes(ui.genre)).map((f) => `<button type="button" class="chip ${a.festivalIds[0] === f.id ? "is-on" : ""}" data-pick-fest="${f.id}">${use(f.icon)}${esc(f.short)} · ${esc(cityOf(world, f.cityId).name)}</button>`).join("")}</div>` : ""}`;
      } else {
        const q = ui.nameQuery.trim().toLowerCase();
        const hits = q ? world.festivals.filter((f) => f.name.toLowerCase().includes(q) || cityOf(world, f.cityId).name.toLowerCase().includes(q)) : [];
        chooser = `<input class="namebox" id="nameBox" type="search" placeholder="A festival you know…" value="${esc(ui.nameQuery)}" autocomplete="off">
          <div class="chips" style="margin-top:10px">${hits.map((f) => `<button type="button" class="chip ${a.festivalIds[0] === f.id ? "is-on" : ""}" data-pick-fest="${f.id}">${use(f.icon)}${esc(f.short)} · ${esc(cityOf(world, f.cityId).name)}</button>`).join("")}</div>`;
      }
      return `<h2>Where to?</h2>
        <div class="opts" style="margin-bottom:12px">${ways.map(([k, l, p]) => optHtml("sq" + (ui.way === k ? "" : " faded"), k, p, l, ui.way === k, "data-way")).join("")}</div>
        ${chooser}
        <div class="foot">${city ? `<span class="answer">${esc(city.name)} ${use("ic-tick")}</span>` : `<span class="note" style="color:var(--ink-faint)">…</span>`}</div>`;
    }
    case "when": {
      const f = primaryFestival();
      const base = ui.month || (f ? f.from.slice(0, 7) : "2026-08");
      const [y, m] = base.split("-").map(Number);
      const first = `${y}-${String(m).padStart(2, "0")}-01`;
      const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
      const startDow = (["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].indexOf(dayOfWeek(first)));
      const cells = [];
      for (let i = 0; i < startDow; i++) cells.push(`<span class="out"></span>`);
      const fests = city ? festivalsIn(world, city.id) : [];
      for (let d = 1; d <= daysInMonth; d++) {
        const iso = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
        const inFest = fests.some((x) => x.from <= iso && x.to >= iso);
        const on = iso === a.from || iso === a.to;
        const within = a.from && a.to && iso > a.from && iso < a.to;
        cells.push(`<button type="button" class="${on ? "on" : ""} ${within ? "in" : ""} ${inFest ? "fest" : "out"}" data-day="${iso}">${d}</button>`);
      }
      const prev = `${m === 1 ? y - 1 : y}-${String(m === 1 ? 12 : m - 1).padStart(2, "0")}`;
      const next = `${m === 12 ? y + 1 : y}-${String(m === 12 ? 1 : m + 1).padStart(2, "0")}`;
      return `<h2>When?</h2>
        <div class="month"><button type="button" data-month-nav="${prev}" aria-label="Earlier month">‹</button><span>${monthName(first)} ${y}</span><button type="button" data-month-nav="${next}" aria-label="Later month">›</button></div>
        <div class="cal"><span class="h">M</span><span class="h">T</span><span class="h">W</span><span class="h">T</span><span class="h">F</span><span class="h">S</span><span class="h">S</span>${cells.join("")}</div>
        <div class="foot"><span class="note" style="color:var(--ink-faint);font-size:20px">${f ? esc(f.short) + " runs " + esc(f.from.slice(8)) + "–" + esc(f.to.slice(8)) : ""}</span><span class="note">${nights() ? nights() + " nights" : a.from ? "…and back?" : ""}</span></div>`;
    }
    case "who": {
      const p = a.party || {};
      return `<h2>Who's coming?</h2>
        <div class="opts">${PARTY.map(([k, l, pic]) => optHtml("", k, pic, l, p.type === k, "data-party")).join("")}</div>
        ${p.type === "family" ? `<div class="ages">Ages ${AGES.map((n) => `<button type="button" class="age ${(p.ages || []).includes(n) ? "is-on" : ""}" data-age="${n}">${n}</button>`).join("")}</div>` : ""}`;
    }
    case "matters": {
      const row = (lbl, list, key, attr) => `<div class="row-opts"><span class="lbl">${lbl}</span>${list.map(([k, l, pic]) => optHtml("", k, pic, l, a[key] === k, attr)).join("")}</div>`;
      return `<h2>What matters?</h2>${row("Cost", COST, "cost", "data-cost")}${row("Pace", PACE, "pace", "data-pace")}${row("Days", FOCUS, "focus", "data-focus")}`;
    }
    case "travel": {
      const origins = world.origins.filter((o) => routesFrom(world, o.id, a.cityId).length);
      const modes = a.originId ? routesFrom(world, a.originId, a.cityId) : [];
      return `<h2>Getting there?</h2>
        <div class="chips">${origins.map((o) => `<button type="button" class="chip ${a.originId === o.id ? "is-on" : ""}" data-origin="${o.id}">${esc(o.name)}</button>`).join("")}</div>
        ${modes.length ? `<div class="opts" style="margin-top:14px">${modes.map((r) => optHtml("sq", r.mode, MODE_PIC[r.mode], `${MODE_WORD[r.mode]} · ${Math.floor(r.minutes / 60)}h${String(r.minutes % 60).padStart(2, "0")}`, a.mode === r.mode, "data-mode")).join("")}</div>` : `<p class="note" style="color:var(--ink-faint);margin-top:14px">…from where?</p>`}`;
    }
    case "sleep": {
      const stay = city && a.sleep.length === 2 ? pickStay(city, a) : null;
      return `<h2>Where to sleep?</h2>
        <p class="note" style="color:var(--ink-faint);font-size:22px;margin:-8px 0 10px">pick two</p>
        <div class="opts">${SLEEP.map(([k, l, pic]) => optHtml("sq", k, pic, l, a.sleep.includes(k), "data-sleep")).join("")}</div>
        ${stay ? `<div class="foot"><span class="answer">${use(stay.kind === "hotel" ? "il-hotel" : "il-guesthouse")}${esc(stay.name)}</span><span class="note">${money(city, stay.perNight)} a night</span></div>` : ""}`;
    }
    default: return "";
  }
}

// ---------------------------------------------------------- the back --

function ticketClass(it) {
  return { show: "", meal: "food", out: "out", travel: "travel", stay: "stay", free: "free" }[it.kind] || "";
}

function ticketHtml(it, city, key) {
  const top = ((it.start - DAY_START) / 60) * HOUR_PX;
  const h = Math.max(26, ((it.end - it.start) / 60) * HOUR_PX - 4);
  const size = h < 40 ? "tiny" : h < 58 ? "short" : "";
  if (it.kind === "free") return `<div class="tix free" style="top:${top}px;height:${h}px"><span class="n">free</span></div>`;
  const t = it.kind === "travel" ? `${fromMin(it.start)} → ${fromMin(it.end)}` : it.kind === "show" ? `${fromMin(it.start)} · ${money(city, it.unit)}` : it.kind === "meal" ? `${fromMin(it.start)}${it.booked ? " · booked" : ""}` : `${fromMin(it.start)} – ${fromMin(it.end)}`;
  const pic = it.kind === "show" ? it.icon : it.kind === "travel" ? MODE_PIC[it.mode] : it.picture;
  const band = it.kind === "show" ? `--band:${it.colour};` : "";
  const lifted = ui.peel === key ? "lift" : "";
  return `<button type="button" class="tix ${ticketClass(it)} ${size} ${it.starred ? "starred" : ""} ${lifted}" style="top:${top}px;height:${h}px;${band}" data-peel="${key}" data-kind="${it.kind}" ${it.oneOff ? 'data-oneoff="1"' : ""} title="${esc(it.title)}">
    <span class="t">${esc(t)}</span><span class="n">${esc(it.title)}</span><span class="v">${esc(it.sub || "")}</span>
    ${pic ? use(pic, "pic") : ""}${it.starred ? use("ic-star", "star") : ""}<i class="curl"></i></button>`;
}

function revealHtml(it, city, top, side) {
  const S = (cls, pic, label, act, r) => `<button type="button" class="sticker ${cls}" style="--r:${r}deg" data-act="${act}">${use(pic)}${label}${act === "keep" || act === "leave" ? "" : use("ic-nope", "x")}</button>`;
  let inner = "";
  if (it.kind === "show" && it.oneOff) inner = S("rose", it.icon, "Not for me", "notShow", -3) + S("keep", "ic-star", "Keep it", "keep", 3);
  else if (it.kind === "show") {
    const venue = venueOf(city, it.venueId);
    inner = S("", "ic-clock", "Not this time", "notTime", -4) + S("", "ic-ticket", "Not this show", "notShow", 3) + S("lilac", world.genreIcons[it.genre] || "ic-masks", `No ${esc(it.genre.toLowerCase())}`, "notGenre", -2) + S("rose", "ic-pin", `Not ${esc(venue ? venue.short : "here")}`, "notVenue", 4) + S("keep", "ic-star", "Keep it", "keep", -3);
  } else if (it.kind === "meal") inner = S("", "il-table", "Somewhere else", "notMeal", -3) + S("rose", "ic-nope", "No meals", "noMeals", 2) + S("keep", "ic-star", "Keep it", "keep", 3);
  else if (it.kind === "out") inner = S("", "il-picnic", "Not this one", "notOut", -3) + S("rose", "ic-nope", "No day out", "noDayOut", 2) + S("keep", "ic-star", "Keep it", "keep", 3);
  else if (it.kind === "travel") inner = S("", "ic-clock", "Earlier", "earlier", -3) + S("", "ic-clock", "Later", "later", 2) + S("keep", "ic-star", "Keep it", "keep", 3);
  else if (it.kind === "stay") inner = S("", "il-hotel", "Another stay", "otherStay", -3) + S("keep", "ic-star", "Keep it", "keep", 3);
  return `<div class="reveal" style="top:${top}px;${side}">${inner}</div>`;
}

function renderBack() {
  const a = state.answers;
  const city = cityOf(world, a.cityId);
  const trip = draftTrip(world, a, state.rules, state.starred);
  const days = trip.days;
  const hours = [];
  for (let h = 8; h <= 24; h++) hours.push(`<span style="top:${(h - 8) * HOUR_PX}px">${String(h).padStart(2, "0")}:00</span>`);
  const cols = days.map((d, di) => {
    const items = [...d.items];
    for (const g of gapsOf(d)) items.push({ kind: "free", start: g.start, end: Math.min(g.end, 24 * 60) });
    items.sort((x, y) => x.start - y.start);
    let peelHtml = "";
    const tickets = items.map((it) => {
      const key = `${di}:${it.kind}:${it.id || it.title}:${it.start}`;
      if (ui.peel === key) {
        const h = Math.max(26, ((it.end - it.start) / 60) * HOUR_PX - 4);
        const side = di >= days.length - 2 ? "right:-6px" : "left:-6px";
        peelHtml = revealHtml(it, city, ((it.start - DAY_START) / 60) * HOUR_PX + h + 8, side);
      }
      return ticketHtml(it, city, key);
    });
    return `<div class="daycol" data-day="${d.date}">${tickets.join("")}${peelHtml}</div>`;
  });
  const fest = primaryFestival();
  const stay = trip.stay;
  return `
  <div class="draft-head"><span class="title-hand">First draft</span><span class="pen-note">peel off what's wrong</span></div>
  <div class="draft-answers">${answerStickers("none")}</div>
  <div class="postcard back" style="--days:${days.length}">
    <div class="head">POST CARD</div>
    <div class="divider"></div>
    <div class="calwrap">
      <div class="calgrid">
        <div></div>${days.map((d) => `<div class="dayhead">${esc(shortDate(d.date).slice(0, 3))} ${Number(d.date.slice(8))}<small>${(n => n === 1 ? "1 show" : `${n} shows`)(d.items.filter((i) => i.kind === "show").length)}</small></div>`).join("")}
        <div class="hours">${hours.join("")}</div>${cols.join("")}
      </div>
    </div>
    <div class="stampbox"></div>
    ${fest ? stampHtml(fest, "", "right: 38px; top: 52px; --r: -2deg;") : ""}
    ${postmarkHtml(city, "right: 110px; top: 30px; transform: rotate(-6deg); width: 240px; height: 104px;")}
    <div class="addr"><span>${esc(stay.name)}</span><span>${esc(stay.address.split(",")[0])}</span><span>${esc(city.name)} ${esc(stay.address.split(",")[1] || "")}</span></div>
    <div class="totals"><span>${trip.totals.nights} nights <b>${money(city, trip.totals.stayCost)}</b></span><span>${MODE_WORD[trip.route ? trip.route.mode : "train"]} <b>${money(city, trip.totals.travel)}</b></span><span>Tickets <b>${money(city, trip.totals.tickets)}</b></span></div>
    <div class="nothing">Nothing booked yet</div>
    <div class="sheet"><div class="title">Stick on…</div>
      <button type="button" class="sticker mint" style="--r:-4deg" data-stick="out">${use("il-picnic")}Day out</button>
      <button type="button" class="sticker sun" style="--r:3deg" data-stick="meal">${use("il-table")}A meal</button>
      <button type="button" class="sticker lilac" style="--r:-2deg" data-stick="pick">${use("il-booklet")}Pick myself</button>
    </div>
  </div>
  <div class="draft-foot"><button type="button" class="tag-cta violet" style="--r:-2deg" data-nav="done">Looks good ${use("ic-tick")}</button></div>
  ${ui.chooser ? renderChooser(city, trip) : ""}`;
}

function renderChooser(city, trip) {
  const a = state.answers;
  const inPlan = new Set(trip.days.flatMap((d) => d.items).filter((i) => i.kind === "show").map((i) => i.id));
  const days = daysBetween(a.from, a.to);
  const groups = a.festivalIds.map((fid) => {
    const f = world.festivals.find((x) => x.id === fid);
    const shows = showsOf(world, [fid]).filter((s) => perfsBetween(s, a.from, a.to).length);
    const starred = shows.filter((s) => state.starred.includes(s.id));
    const rest = shows.filter((s) => !state.starred.includes(s.id)).sort((x, y) => x.title.localeCompare(y.title));
    const limit = 5 + ui.more * 20;
    const rows = [...starred, ...rest.slice(0, limit)];
    const row = (s) => {
      const perfs = perfsBetween(s, a.from, a.to);
      const nightsOn = days.map((d) => perfs.some((p) => p.date === d));
      const venue = venueOf(city, s.venueId);
      return `<div class="crow ${state.starred.includes(s.id) ? "is-on" : ""}">
        <button type="button" class="starbtn" data-star="${s.id}" aria-label="Star ${esc(s.title)}">${use("ic-star")}</button>
        <div><div class="ttl">${esc(s.title)} ${inPlan.has(s.id) ? `<small class="meta">· in the plan</small>` : ""}</div><div class="meta">${esc(s.genre)} · ${esc(venue ? venue.name : "")} · ${s.minutes} min${s.ages ? ` · ${s.ages}+` : ""}${perfs.length === 1 ? " · one night only" : ""}</div></div>
        <div class="nights">${nightsOn.map((on) => `<i class="${on ? "on" : ""}"></i>`).join("")}</div>
        <div class="price">${s.price ? money(city, s.price) : "Free"}</div></div>`;
    };
    return `<h3><i style="--band:${f.colour}"></i>${esc(f.name)} <small>${shows.length} on your dates · ${starred.length} starred</small></h3>${rows.map(row).join("")}
      ${rest.length > limit ? `<div class="more"><button type="button" class="chip" data-more>Show 20 more of ${rest.length - limit}</button></div>` : ""}`;
  });
  return `<div class="chooser" id="chooser"><div class="book">
    <button type="button" class="tag-cta quiet close" style="--r:2deg" data-close-chooser>Back to the postcard ${use("ic-back")}</button>
    <h2>Pick myself</h2><p class="lede">Star what you want in. Starred shows stay in the plan and are never swapped.</p>
    ${groups.join("")}</div></div>`;
}

// --------------------------------------------------------------- wiring --

function next() {
  const i = STEPS.indexOf(state.step);
  set((s) => { s.step = STEPS[Math.min(STEPS.length - 1, i + 1)]; });
}

function wire() {
  const on = (sel, fn) => stage.querySelectorAll(sel).forEach((el) => el.addEventListener("click", (e) => fn(el, e)));
  on("[data-nav]", (el) => {
    const nav = el.dataset.nav;
    if (nav === "next") next();
    else if (nav === "back") set((s) => { s.step = STEPS[Math.max(0, STEPS.indexOf(s.step) - 1)]; });
    else if (nav === "done") el.textContent = "Saved to this browser ✓";
  });
  on("[data-reopen]", (el) => { ui.peel = null; set((s) => { s.step = el.dataset.reopen; }); });
  on("[data-way]", (el) => { ui.way = el.dataset.way; render(); });
  on("[data-city]", (el) => pickCity(el.dataset.city));
  on("[data-month]", (el) => { ui.month = Number(el.dataset.month); render(); });
  on("[data-genre]", (el) => { ui.genre = el.dataset.genre; render(); });
  on("[data-pick-fest]", (el) => { const f = world.festivals.find((x) => x.id === el.dataset.pickFest); pickCity(f.cityId, f.id); });
  const nb = stage.querySelector("#nameBox");
  if (nb) { nb.addEventListener("input", () => { ui.nameQuery = nb.value; const pos = nb.selectionStart; render(); const again = stage.querySelector("#nameBox"); if (again) { again.focus(); again.setSelectionRange(pos, pos); } }); }
  on("[data-fest]", (el) => set((s) => { const id = el.dataset.fest; if (!s.answers.festivalIds.includes(id)) s.answers.festivalIds.push(id); }));
  on("[data-month-nav]", (el) => { ui.month = el.dataset.monthNav; render(); });
  on("[data-day]", (el) => set((s) => {
    const d = el.dataset.day;
    const a = s.answers;
    if (!a.from || (a.from && a.to)) { a.from = d; a.to = null; }
    else if (d < a.from) { a.to = a.from; a.from = d; }
    else if (d === a.from) { a.from = null; }
    else a.to = d;
    if (a.from && a.to) a.festivalIds = a.festivalIds.filter((id) => { const f = world.festivals.find((x) => x.id === id); return f.from <= a.to && f.to >= a.from; });
  }));
  on("[data-party]", (el) => set((s) => { const type = el.dataset.party; s.answers.party = { type, ages: type === "family" ? (s.answers.party && s.answers.party.ages) || [] : [] }; }));
  on("[data-age]", (el) => set((s) => { const n = Number(el.dataset.age); const ages = s.answers.party.ages; const i = ages.indexOf(n); if (i >= 0) ages.splice(i, 1); else ages.push(n); ages.sort((x, y) => x - y); }));
  on("[data-cost]", (el) => set((s) => { s.answers.cost = el.dataset.cost; }));
  on("[data-pace]", (el) => set((s) => { s.answers.pace = el.dataset.pace; }));
  on("[data-focus]", (el) => set((s) => { s.answers.focus = el.dataset.focus; }));
  on("[data-origin]", (el) => set((s) => { s.answers.originId = el.dataset.origin; const modes = routesFrom(world, s.answers.originId, s.answers.cityId); if (!modes.some((r) => r.mode === s.answers.mode)) s.answers.mode = null; }));
  on("[data-mode]", (el) => set((s) => { s.answers.mode = el.dataset.mode; }));
  on("[data-sleep]", (el) => set((s) => { const k = el.dataset.sleep; const sl = s.answers.sleep; const i = sl.indexOf(k); if (i >= 0) sl.splice(i, 1); else { sl.push(k); if (sl.length > 2) sl.shift(); } }));
  // the back
  on("[data-peel]", (el, e) => { e.stopPropagation(); ui.peel = ui.peel === el.dataset.peel ? null : el.dataset.peel; render(); });
  on("[data-act]", (el, e) => { e.stopPropagation(); correct(el.dataset.act); });
  on("[data-stick]", (el) => stick(el.dataset.stick));
  on("[data-close-chooser]", () => { ui.chooser = false; render(); });
  on("[data-more]", () => { ui.more += 1; render(); });
  on("[data-star]", (el) => set((s) => { const id = el.dataset.star; const i = s.starred.indexOf(id); if (i >= 0) s.starred.splice(i, 1); else s.starred.push(id); }));
  const chooser = stage.querySelector("#chooser");
  if (chooser) chooser.addEventListener("click", (e) => { if (e.target === chooser) { ui.chooser = false; render(); } });
}

function pickCity(cityId, festivalId) {
  set((s) => {
    const a = s.answers;
    if (a.cityId !== cityId) { a.from = null; a.to = null; a.originId = null; a.mode = null; s.rules = {}; s.starred = []; }
    a.cityId = cityId;
    const fests = festivalsIn(world, cityId);
    a.festivalIds = festivalId ? [festivalId] : [fests[0].id];
    ui.month = null;
  });
}

// A correction is a rule the drafter obeys from now on; the peeled ticket's
// own facts (which show, which genre, which venue, which night) are the rule.
function correct(act) {
  const key = ui.peel;
  if (!key) return;
  const [di, kind] = key.split(":");
  const a = state.answers;
  const trip = draftTrip(world, a, state.rules, state.starred);
  const day = trip.days[Number(di)];
  const it = day && day.items.find((x) => `${di}:${x.kind}:${x.id || x.title}:${x.start}` === key);
  if (!it && kind !== "free") { ui.peel = null; render(); return; }
  const push = (r, k, v) => { r[k] = r[k] || []; if (!r[k].includes(v)) r[k].push(v); };
  set((s) => {
    const r = s.rules;
    switch (act) {
      case "keep": if (it.kind === "show" && !s.starred.includes(it.id)) s.starred.push(it.id); break;
      case "notTime": push(r, "notTime", it.perf); break;
      case "notShow": push(r, "notShow", it.id); s.starred = s.starred.filter((x) => x !== it.id); break;
      case "notGenre": push(r, "notGenre", it.genre); break;
      case "notVenue": push(r, "notVenue", it.venueId); break;
      case "notMeal": push(r, "notMeal", it.id); break;
      case "noMeals": r.noMeals = true; break;
      case "notOut": push(r, "notOut", it.id); break;
      case "noDayOut": r.noDayOut = true; r.stickOut = []; break;
      case "earlier": r.travelShift = (r.travelShift || 0) - 1; break;
      case "later": r.travelShift = (r.travelShift || 0) + 1; break;
      case "otherStay": {
        const city = cityOf(world, a.cityId);
        const cur = pickStay(city, a);
        push(r, "notStay", cur.id);
        break;
      }
      default: break;
    }
  });
  ui.peel = null;
  render();
}

function stick(what) {
  if (what === "pick") { ui.chooser = true; ui.more = 0; render(); return; }
  const a = state.answers;
  const days = daysBetween(a.from, a.to);
  set((s) => {
    const r = s.rules;
    if (what === "out") {
      r.noDayOut = false;
      const trip = draftTrip(world, a, r, s.starred);
      const free = trip.days.slice(1, -1).find((d) => !d.items.some((i) => i.kind === "out"));
      if (free) { r.stickOut = r.stickOut || []; r.stickOut.push(free.date); }
    } else if (what === "meal") {
      r.noMeals = false;
      r.notMeal = [];
      const trip = draftTrip(world, a, r, s.starred);
      const lacking = trip.days.find((d) => !d.items.some((i) => i.kind === "meal" && i.start >= 17 * 60));
      if (lacking) { r.stickMeal = r.stickMeal || []; if (!r.stickMeal.includes(lacking.date)) r.stickMeal.push(lacking.date); }
    }
  });
  void days;
}

// ----------------------------------------------------------------- boot --

async function boot() {
  if (new URLSearchParams(location.search).has("reset")) { try { localStorage.removeItem(STORE_KEY); } catch (_) { /* fine */ } history.replaceState(null, "", location.pathname); }
  const [symbols, data] = await Promise.all([fetch("symbols.svg").then((r) => r.text()), fetch("data/world.json").then((r) => r.json())]);
  document.getElementById("symbols").innerHTML = symbols;
  world = data;
  state = load();
  document.getElementById("resetBtn").addEventListener("click", () => { state = fresh(); ui = { way: "city", month: null, peel: null, chooser: false, more: 0, nameQuery: "" }; save(); render(); });
  render();
  document.body.dataset.ready = "1";
}

boot();
