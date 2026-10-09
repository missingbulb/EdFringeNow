/* The faded photograph of the leading festival's city behind the top of the
 * page (planNG.css draws it; festivals.js says which photograph is whose).
 *
 * Each photograph gets its own <img> in the backdrop, made the first time its
 * city leads and kept after: moving back to a city shown before costs no
 * download, and the photograph leaving fades out under the one arriving
 * rather than vanishing. The one leaving stays lit until the one arriving has
 * decoded, and then the two swap in the same frame, so the fade is a
 * cross-fade and never runs through an empty band.
 */

/**
 * Show `photo` (a CITY_PHOTOS entry) in `host`, or nothing when it is null.
 * @param {HTMLElement} host the backdrop element
 * @param {{src: string, position?: string} | null} photo
 */
export function showCityPhoto(host, photo) {
  const want = photo ? photo.src : "";
  if (host.dataset.showing === want) return;
  host.dataset.showing = want;
  const leaving = () => {
    for (const other of host.querySelectorAll("img.is-on")) other.classList.remove("is-on");
  };
  if (!photo) return leaving();

  let img = [...host.querySelectorAll("img")].find((i) => i.dataset.src === photo.src);
  if (!img) {
    img = document.createElement("img");
    img.alt = "";
    img.decoding = "async";
    img.dataset.src = photo.src;
    if (photo.position) img.style.objectPosition = photo.position;
    img.src = photo.src;
    host.append(img);
  }
  const light = () => {
    if (host.dataset.showing !== photo.src) return;
    // Laid out at zero opacity first, so the class change is a transition
    // even for a photograph the cache hands back already decoded.
    void img.offsetWidth;
    leaving();
    img.classList.add("is-on");
  };
  img.decode().then(light, light);
}
