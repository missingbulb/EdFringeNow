/* Country flags, drawn rather than typed: a flag emoji is two letters on a
 * device whose fonts have no flags, so each is a small SVG that looks the same
 * everywhere. Only the countries the festival registry names; a country with
 * no drawing here shows no flag. Keyed by ISO 3166-1 alpha-2. */

const UNION =
  `<rect width="60" height="30" fill="#012169"/>` +
  `<path d="M0 0L60 30M60 0L0 30" stroke="#fff" stroke-width="6"/>` +
  `<path d="M0 0L60 30M60 0L0 30" stroke="#c8102e" stroke-width="2.5"/>` +
  `<path d="M30 0v30M0 15h60" stroke="#fff" stroke-width="10"/>` +
  `<path d="M30 0v30M0 15h60" stroke="#c8102e" stroke-width="6"/>`;

const star = (x, y, r, fill, stroke = "") => {
  const pts = [];
  for (let i = 0; i < 10; i++) {
    const a = (Math.PI / 5) * i - Math.PI / 2;
    const d = i % 2 ? r * 0.45 : r;
    pts.push(`${(x + d * Math.cos(a)).toFixed(1)},${(y + d * Math.sin(a)).toFixed(1)}`);
  }
  return `<polygon points="${pts.join(" ")}" fill="${fill}"${stroke ? ` stroke="${stroke}" stroke-width="1"` : ""}/>`;
};

/* The Commonwealth pair: blue, the Union in the corner, and their stars. */
const southern = (stars) =>
  `<rect width="60" height="30" fill="#012169"/><svg width="30" height="15" viewBox="0 0 60 30">${UNION}</svg>${stars}`;

const FLAGS = {
  GB: { viewBox: "0 0 60 30", body: UNION },
  IL: {
    viewBox: "0 0 44 32",
    body:
      `<rect width="44" height="32" fill="#fff"/>` +
      `<rect y="3" width="44" height="5" fill="#0038b8"/><rect y="24" width="44" height="5" fill="#0038b8"/>` +
      `<path d="M22 9.5L28.2 20.2H15.8zM22 22.5L15.8 11.8H28.2z" fill="none" stroke="#0038b8" stroke-width="1.4"/>`,
  },
  AU: {
    viewBox: "0 0 60 30",
    body: southern(star(15, 22.5, 4, "#fff") + star(45, 24, 2.2, "#fff") + star(39, 13, 2.2, "#fff") + star(45, 5, 2.2, "#fff") + star(51, 11, 2.2, "#fff")),
  },
  NZ: {
    viewBox: "0 0 60 30",
    body: southern(star(45, 24.5, 2.6, "#c8102e", "#fff") + star(39.5, 13, 2.3, "#c8102e", "#fff") + star(45, 5.5, 2.2, "#c8102e", "#fff") + star(51, 11, 2.4, "#c8102e", "#fff")),
  },
};

/** A country's flag as inline SVG, or "" for a country with none. */
export function flagSvg(country, cls = "") {
  const flag = FLAGS[country];
  if (!flag) return "";
  return (
    `<svg class="${cls}" viewBox="${flag.viewBox}" preserveAspectRatio="none" aria-hidden="true" focusable="false">` +
    `${flag.body}</svg>`
  );
}
