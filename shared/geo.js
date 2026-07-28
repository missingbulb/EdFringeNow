/* Geography helpers shared by both front-ends.
 *
 * This is the first module the Now page (`js/app.js`) and the planner
 * (`plan/plan.js`) genuinely share. Both import it as `../shared/geo.js`, which
 * resolves to `/shared/geo.js` from either page. Before this existed the values
 * below were copy-pasted into both files and nothing tied the copies together —
 * a change to one left the pages silently disagreeing.
 */

/* Very rough bounding box for the UK mainland (lat/lng).
 *
 * The Now page uses it to ignore a real location that is nowhere near Edinburgh
 * (e.g. a tester overseas), keeping the central-Edinburgh default rather than
 * moving the pin abroad. The planner uses it to hide its debug menu, which is a
 * testing affordance and so only shows when we are not clearly in the UK.
 *
 * Kept deliberately loose — it only needs to tell "in the UK" from "not". */
export const UK_BOUNDS = { minLat: 49.8, maxLat: 59.0, minLng: -8.2, maxLng: 1.9 };

/* Is a [lat, lng] roughly within the UK mainland box above? */
export function isInUK([lat, lng]) {
  return (
    lat >= UK_BOUNDS.minLat &&
    lat <= UK_BOUNDS.maxLat &&
    lng >= UK_BOUNDS.minLng &&
    lng <= UK_BOUNDS.maxLng
  );
}
