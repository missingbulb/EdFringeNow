/*
 * How the reader is getting to the festival: the answer the travel blocks
 * either side of the trip ask for, stored as `arrive` on the saved origin.
 *
 * Pure: no DOM, no fetch.
 */

/** Living there, driving their own car, taking the train, flying. */
export const ARRIVALS = ["local", "drive", "train", "fly"];

/** How the saved origin says the reader arrives; null while it hasn't said.
 * An origin saved before the question asked this is read by where it placed
 * the reader: their home in the festival's city as living there, abroad as
 * flying, and anything vaguer as not yet said. */
export function arrivalOf(origin) {
  if (!origin) return null;
  if (ARRIVALS.includes(origin.arrive)) return origin.arrive;
  if (origin.kind === "city") return "local";
  if (origin.kind === "abroad") return "fly";
  return null;
}
