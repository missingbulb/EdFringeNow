/* The Edinburgh Fringe's planner catalogue, read off its three wire files and
 * joined: the compact catalogue (shows.min.json, packed by scraper/normalize.py),
 * the shared lookups (venues.json) and the availability sidecar
 * (availability.min.json). ../plan/lib/hydrate.js does the joining; this module
 * owns fetching the three and refusing a pair that belongs to different
 * generations. Both planners read Edinburgh through it: the Fringe planner
 * (plan/plan.js) and the festival planner, via shared/festival-catalogue.js.
 *
 * The three are split the way they are so each can be cached for as long as its
 * contents actually last (shared/data-cache.js):
 *
 *  - the catalogue is the bulkiest blocking download (3.0 MB, 948 KB gzipped)
 *    and carries nothing that changes through the day, so four days of reuse
 *    costs a returning visitor only the shows added since;
 *  - availability is the one file that changes through the festival, so a day
 *    is the most it can be trusted — and it is far smaller than the catalogue,
 *    so the daily re-download is cheap;
 *  - venues.json is small and its lookup lists are append-only, so refetching
 *    it daily keeps it at least as new as any cached catalogue that indexes
 *    into it.
 */

import { cachedFetchJson, evictCached, DAY_MS } from "./data-cache.js";
import { rehydrateShows, joinFingerprint } from "../plan/lib/hydrate.js";

export const CATALOGUE_TTL_MS = 4 * DAY_MS;
export const AVAILABILITY_TTL_MS = DAY_MS;
export const LOOKUPS_TTL_MS = DAY_MS;

/* What each file has to look like before we'll build a planner out of it.
 *
 * These exist because a cached copy from an older generation of a file parses
 * perfectly and then joins to nothing — no exception, no console line, just a
 * planner quietly reporting that the whole festival is unavailable (#309). The
 * sidecar has carried a `v` for this all along; nothing was reading it. Kept
 * deliberately shallow: enough to tell "this is the file I think it is" from
 * "this is something else", not a schema validator. */
const isCatalogue = (d) => Array.isArray(d) && d.length > 0;
const isLookups = (d) => Boolean(d) && typeof d.venues === "object" && d.venues !== null;
const isAvailabilitySidecar = (d) =>
  Boolean(d) && d.v === 1 && Array.isArray(d.ts) && d.ts.length > 0 &&
  Boolean(d.a) && typeof d.a === "object" && Object.keys(d.a).length > 0;

/* How much of the catalogue must come back with a ticket status before we are
 * willing to draw it.
 *
 * The catalogue is cached for four days and the sidecar for one, so they are
 * routinely joined across generations, and a few misses are the honest cost of
 * that: a show that added or dropped a date since the catalogue was packed
 * finds no status, which is exactly what the date-and-time naming scheme was
 * designed to do. Real drift over four days is a fraction of a percent.
 *
 * A systematic key change is a different animal. #274 corrected every start
 * time by an hour, and the next day's sidecar matched 6% of the previous day's
 * catalogue — 94% of the festival status-unknown, drawn as unavailable (#309).
 * Nothing between 6% and 99% is a state we can tell a coherent story about, so
 * the line sits where it separates drift from breakage rather than where it
 * splits the difference. */
const MIN_STATUS_COVERAGE = 0.9;

/**
 * Do these two files describe the same festival?
 *
 * Two independent answers, because they fail in different places. The
 * fingerprint is exact and cheap and settles it outright — but only for a
 * sidecar new enough to carry one, which a cached copy predating that field
 * won't. Coverage is the fallback: approximate, but it reads the join itself
 * rather than a claim about it, so it also catches whatever the fingerprint
 * hasn't thought of.
 *
 * @returns {{ok: boolean, why?: string}}
 */
function joinIsSound(wire, availability, catalogue) {
  const stamped = availability && typeof availability.k === "string";
  if (stamped) {
    const mine = joinFingerprint(wire);
    if (mine !== availability.k) {
      return { ok: false, why: `catalogue ${mine} vs availability ${availability.k}` };
    }
  }

  let performances = 0;
  let withStatus = 0;
  for (const show of catalogue) {
    for (const perf of show.performances || []) {
      performances++;
      if (perf.status) withStatus++;
    }
  }
  if (performances === 0) return { ok: true }; // an empty catalogue is a different problem
  const coverage = withStatus / performances;
  if (coverage < MIN_STATUS_COVERAGE) {
    return {
      ok: false,
      why: `only ${withStatus} of ${performances} performances (${Math.round(coverage * 100)}%) ` +
           "carry a ticket status",
    };
  }
  return { ok: true };
}

/**
 * The three files, joined — refetched once from source if the copies we were
 * given don't agree with each other.
 *
 * All three are required. Availability used to be allowed to fail on the theory
 * that status-unknown is a state the grid already draws — it isn't. An empty
 * status reads as not-bookable everywhere downstream (isAvailable, segClass,
 * laneStatus), so continuing without the sidecar doesn't degrade the planner, it
 * inverts it: every performance turns red and every show reports "No dates", for
 * a festival that is very much on sale (#309).
 *
 * The retry is the substance. A generation disagreement is not a network failure
 * and not a corrupt file — it is two perfectly good files that have drifted
 * apart on their separate TTLs, and the fix is simply to go and get today's, so
 * that is what happens. Only if freshly-downloaded copies *still* disagree is
 * this a real failure: at that point we genuinely don't know what's bookable,
 * and a wrong plan is worse than no plan.
 *
 * @param {{catalogue: string, lookups: string, availability: string}} urls
 * @param {{year: number, onNote?: (err: unknown, url: string) => void}} opts
 * @returns {Promise<{lookups: object, catalogue: object[]}>}
 */
export async function loadEdfringeWire(urls, { year, onNote } = {}) {
  for (const attempt of [1, 2]) {
    const [wire, lookups, availability] = await Promise.all([
      cachedFetchJson(urls.catalogue, CATALOGUE_TTL_MS, onNote, isCatalogue),
      cachedFetchJson(urls.lookups, LOOKUPS_TTL_MS, onNote, isLookups),
      cachedFetchJson(urls.availability, AVAILABILITY_TTL_MS, onNote, isAvailabilitySidecar),
    ]);
    const catalogue = rehydrateShows(wire, lookups, year, availability);
    const verdict = joinIsSound(wire, availability, catalogue);
    if (verdict.ok) return { lookups, catalogue };

    if (attempt === 2) {
      throw new Error(
        `the catalogue and the ticket availability don't match (${verdict.why})`
      );
    }
    // Drop both and go again. Which of the two is stale isn't knowable from
    // here — the catalogue's four-day TTL makes it the usual suspect, but a
    // sidecar can be the stale one too — and this costs one extra download of
    // each on a path that only runs when they've already disagreed.
    console.warn("Fringe catalogue/availability mismatch, refetching both —", verdict.why);
    await Promise.all([evictCached(urls.catalogue), evictCached(urls.availability)]);
  }
}
