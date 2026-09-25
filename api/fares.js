/* The fare service: the cheapest one-way flights for one route on one day,
 * read from Travelpayouts' Aviasales data API.
 *
 * It lives server-side for one reason — the partner's token is a secret, and
 * anything the page holds is public — so it forwards nothing of the reader's
 * but the route, the day and the currency. The prices are the partner's
 * cached ones (what its users found recently), not a live seat search, which
 * is what the partner's data API offers and what the page says.
 *
 * The response shape parseFares() reads is the partner's documentation's;
 * it has not yet been checked against a real answer (product/requirements.md,
 * section 27).
 */

export const PARTNER_URL = "https://api.travelpayouts.com/aviasales/v3/prices_for_dates";
const FARES_PER_DAY = 3;
// Cached prices move over hours, not seconds, so a browser may keep an answer
// for one.
const CACHE_SECONDS = 3600;

const IATA = /^[A-Z]{3}$/;
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const CURRENCY = /^[a-z]{3}$/;

function json(body, status, cacheSeconds = 0) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": cacheSeconds ? `public, max-age=${cacheSeconds}` : "no-store",
    },
  });
}

/**
 * GET /api/fares?from=LON&to=TLV&date=2026-10-17&currency=gbp
 * → { fares: [...] }, cheapest first. With no token configured the answer is
 * an empty list, never an error, so the page falls back to the partner's
 * search rather than to a broken block.
 */
export async function handleFares(request, env, fetchImpl = fetch) {
  const q = new URL(request.url).searchParams;
  const from = (q.get("from") || "").toUpperCase();
  const to = (q.get("to") || "").toUpperCase();
  const date = q.get("date") || "";
  const currency = CURRENCY.test(q.get("currency") || "") ? q.get("currency") : "eur";
  if (!IATA.test(from) || !IATA.test(to) || !DAY.test(date)) return json({ error: "from, to and date are required" }, 400);
  if (!env.TRAVELPAYOUTS_TOKEN) return json({ fares: [], source: "not-configured" }, 200);

  const partner = new URLSearchParams({
    origin: from,
    destination: to,
    departure_at: date,
    one_way: "true",
    direct: "false",
    sorting: "price",
    limit: String(FARES_PER_DAY),
    currency,
  });
  let res;
  try {
    res = await fetchImpl(`${PARTNER_URL}?${partner}`, { headers: { "X-Access-Token": env.TRAVELPAYOUTS_TOKEN } });
  } catch {
    return json({ fares: [], source: "partner-unreachable" }, 502);
  }
  if (!res.ok) return json({ fares: [], source: `partner-${res.status}` }, 502);
  let body;
  try {
    body = await res.json();
  } catch {
    return json({ fares: [], source: "partner-unparsed" }, 502);
  }
  return json({ fares: parseFares(body, currency), source: "partner" }, 200, CACHE_SECONDS);
}

/**
 * The partner's answer as the page reads it. A field the partner left out
 * stays null rather than becoming a zero: a flight with no stated length is
 * not an instant one.
 */
export function parseFares(body, currency) {
  if (!body || body.success !== true || !Array.isArray(body.data)) return [];
  const unit = String(body.currency || currency).toLowerCase();
  const num = (v) => (Number.isFinite(v) ? v : null);
  return body.data
    .filter((d) => d && typeof d.departure_at === "string" && Number.isFinite(d.price) && typeof d.link === "string")
    .map((d) => ({
      departAt: d.departure_at,
      durationMin: num(d.duration_to) ?? num(d.duration),
      stops: num(d.transfers),
      price: d.price,
      currency: unit,
      airline: typeof d.airline === "string" ? d.airline : null,
      link: d.link,
    }))
    .sort((a, b) => a.price - b.price);
}
