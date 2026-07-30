// Turning a built schedule (buildSchedule(...).scheduled — a flat, time-ordered
// Slot[]) into the two downloadable artefacts the planner offers:
//   - a CSV itinerary (open in a spreadsheet / print)
//   - an ICS calendar feed (import into Google/Apple/Outlook)
//
// Pure — no DOM, no Blob, no clock. The UI layer builds the Blob and passes the
// current time into toIcs (for DTSTAMP), so this stays deterministic and unit
// -testable.

// Slots carry `start`/`end` as minutes-since-epoch counted with Date.UTC (see
// availability.js dateTimeToMinutes — a wall-clock count, not a real instant).
// We read them back with the matching getUTC* accessors to recover the original
// Edinburgh wall-clock date/time with no timezone drift.

const pad2 = (n) => String(n).padStart(2, "0");

/** A slot's minutes-since-epoch → {date:"YYYY-MM-DD", time:"HH:MM", ...parts}. */
function wallClock(epochMinutes) {
  const d = new Date(epochMinutes * 60000);
  return {
    y: d.getUTCFullYear(),
    mo: d.getUTCMonth() + 1,
    d: d.getUTCDate(),
    h: d.getUTCHours(),
    mi: d.getUTCMinutes(),
    date: `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`,
    time: `${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}`,
  };
}

/** "HH:MM" end time of a slot (start + duration), for display/CSV. */
export function slotEndTime(slot) {
  return wallClock(slot.end).time;
}

// --- CSV -----------------------------------------------------------------

/** RFC-4180 field escaping: wrap in quotes and double any embedded quote when
 *  the value contains a comma, quote, or newline. */
function csvField(value) {
  const s = value == null ? "" : String(value);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

const CSV_HEADERS = ["Date", "Day", "Start", "End", "Show", "Genre", "Venue", "Room", "Status", "Tickets"];

// Short weekday for the CSV "Day" column, derived from the wall-clock date.
const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/**
 * A CSV itinerary, one row per scheduled performance in the given order.
 * @param {import("./engine.js").Slot[]} slots buildSchedule(...).scheduled
 * @returns {string} CSV text (CRLF line endings, header row first)
 */
export function toCsv(slots) {
  const rows = [CSV_HEADERS.join(",")];
  for (const slot of slots || []) {
    const start = wallClock(slot.start);
    const dow = DOW[new Date(slot.start * 60000).getUTCDay()];
    rows.push(
      [
        start.date,
        dow,
        start.time,
        slotEndTime(slot),
        slot.title,
        slot.genre || "",
        slot.venueName || slot.venueCode || "",
        slot.room || "",
        slot.freeNonTicketed ? "Free (non-ticketed)" : "Ticketed",
        slot.url || "",
      ]
        .map(csvField)
        .join(",")
    );
  }
  return rows.join("\r\n");
}

// --- ICS -----------------------------------------------------------------

/** ICS local date-time (floating, no timezone) "YYYYMMDDTHHMMSS". These are
 *  Edinburgh wall-clock times; floating time keeps them at the same clock face
 *  whatever timezone the importing calendar is in — right for an on-the-ground
 *  festival plan. */
function icsLocal(epochMinutes) {
  const w = wallClock(epochMinutes);
  return `${w.y}${pad2(w.mo)}${pad2(w.d)}T${pad2(w.h)}${pad2(w.mi)}00`;
}

/** UTC stamp "YYYYMMDDTHHMMSSZ" for DTSTAMP, from a real Date (export time). */
function icsStamp(date) {
  return (
    `${date.getUTCFullYear()}${pad2(date.getUTCMonth() + 1)}${pad2(date.getUTCDate())}` +
    `T${pad2(date.getUTCHours())}${pad2(date.getUTCMinutes())}${pad2(date.getUTCSeconds())}Z`
  );
}

/** Escape a text value for an ICS property (RFC-5545 §3.3.11). */
function icsText(value) {
  return String(value == null ? "" : value)
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

/** Fold a content line to ≤75 octets with CRLF + single-space continuations
 *  (RFC-5545 §3.1). Counts UTF-8 bytes so multibyte titles fold correctly; a
 *  continuation line's leading space counts toward its 75, so those cap at 74
 *  characters of payload. */
const utf8Len = (s) => new TextEncoder().encode(s).length;
function foldLine(line) {
  if (utf8Len(line) <= 75) return line;
  const out = [];
  let chunk = "";
  let cap = 75; // first line gets the full 75; continuations lose 1 to the space
  for (const ch of line) {
    if (utf8Len(chunk + ch) > cap) {
      out.push(chunk);
      chunk = "";
      cap = 74;
    }
    chunk += ch;
  }
  out.push(chunk);
  return out.join("\r\n ");
}

/* The festival's timezone, shipped inside the file.
 *
 * Times used to go out "floating" (no zone at all), which every calendar app is
 * entitled to read as the *importing user's* local time — so a visitor whose
 * Google Calendar is set to New York imported an Edinburgh plan five hours out.
 * Naming Europe/London and defining it here removes the guess: the events land
 * at Edinburgh wall-clock time whatever the reader's own zone is, and the
 * definition travels with the file so a reader that doesn't know the zone by
 * name can still resolve it. The rules are the UK's standing ones (BST from the
 * last Sunday in March to the last Sunday in October), not a 2026 special case.
 */
const TZID = "Europe/London";
const VTIMEZONE = [
  "BEGIN:VTIMEZONE",
  `TZID:${TZID}`,
  "BEGIN:DAYLIGHT",
  "TZOFFSETFROM:+0000",
  "TZOFFSETTO:+0100",
  "TZNAME:BST",
  "DTSTART:19700329T010000",
  "RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU",
  "END:DAYLIGHT",
  "BEGIN:STANDARD",
  "TZOFFSETFROM:+0100",
  "TZOFFSETTO:+0000",
  "TZNAME:GMT",
  "DTSTART:19701025T020000",
  "RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU",
  "END:STANDARD",
  "END:VTIMEZONE",
];

/**
 * An ICS (iCalendar) feed of the scheduled performances as VEVENTs.
 *
 * Written to survive the trip through Google Calendar's importer, which is
 * where these files actually end up: zoned times (see VTIMEZONE above), a UID
 * that stays put so re-importing an edited plan updates the events instead of
 * duplicating them, GEO alongside the text address so the map pin is right, and
 * a reminder early enough to walk there.
 *
 * @param {import("./engine.js").Slot[]} slots buildSchedule(...).scheduled
 * @param {{now?: Date, prodId?: string, calendarName?: string,
 *          alarmMinutes?: number|null}} [options]
 *   `now` stamps DTSTAMP (pass the current time from the browser; defaults to a
 *   fixed festival date so the function stays pure/testable when omitted).
 *   `alarmMinutes` sets the reminder lead time; pass null for no VALARM.
 * @returns {string} ICS text (CRLF line endings)
 */
export function toIcs(slots, options = {}) {
  const stamp = icsStamp(options.now ?? new Date(Date.UTC(2026, 7, 1)));
  const prodId = options.prodId || "-//EdFringeNow//Fringe Planner//EN";
  const calendarName = options.calendarName || "My Fringe Plan";
  const alarmMinutes = options.alarmMinutes === undefined ? 30 : options.alarmMinutes;

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    `PRODID:${prodId}`,
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    foldLine(`X-WR-CALNAME:${icsText(calendarName)}`),
    `X-WR-TIMEZONE:${TZID}`,
    ...VTIMEZONE,
  ];

  for (const slot of slots || []) {
    const uid = `${slot.slug}-${icsLocal(slot.start)}@edfringenow.com`;
    const location = [slot.venueName, slot.room].filter(Boolean).join(", ");
    const descParts = [];
    if (slot.genre) descParts.push(slot.genre);
    if (slot.freeNonTicketed) descParts.push("Free — non-ticketed");
    if (slot.url) descParts.push(slot.url);
    descParts.push("Planned with EdFringeNow");
    lines.push(
      "BEGIN:VEVENT",
      foldLine(`UID:${uid}`),
      `DTSTAMP:${stamp}`,
      `DTSTART;TZID=${TZID}:${icsLocal(slot.start)}`,
      `DTEND;TZID=${TZID}:${icsLocal(slot.end)}`,
      foldLine(`SUMMARY:${icsText(slot.title)}`),
      foldLine(`LOCATION:${icsText(location)}`),
      foldLine(`DESCRIPTION:${icsText(descParts.join("\n"))}`),
      "STATUS:CONFIRMED",
      "TRANSP:OPAQUE"
    );
    // The venue's own coordinates, so the calendar pins the room rather than
    // geocoding a venue name that half a dozen Fringe venues share.
    if (slot.venueLat != null && slot.venueLng != null) {
      lines.push(`GEO:${slot.venueLat};${slot.venueLng}`);
    }
    if (slot.url) lines.push(foldLine(`URL:${icsText(slot.url)}`));
    if (alarmMinutes != null && alarmMinutes > 0) {
      lines.push(
        "BEGIN:VALARM",
        "ACTION:DISPLAY",
        foldLine(`DESCRIPTION:${icsText(slot.title)}`),
        `TRIGGER:-PT${Math.round(alarmMinutes)}M`,
        "END:VALARM"
      );
    }
    lines.push("END:VEVENT");
  }

  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}
