/* An ICU MessageFormat subset, formatted at runtime.
 *
 * ICU MessageFormat is the syntax every mainstream translation toolchain reads
 * (i18next, FormatJS, gettext converters, XLIFF round-trips), so the messages
 * in ./translations.js are written in it rather than in a spelling of our own.
 * Its successor, MessageFormat 2, is stable in Unicode LDML but `Intl.MessageFormat`
 * is still a TC39 stage-2 proposal, so no browser can format either one for us
 * and a formatter is ours to carry.
 *
 * What this one understands, which is all the page's own strings need:
 *
 *   {name}                             a value, interpolated
 *   {n, plural, one {# night} other {# nights}}
 *                                      a plural, chosen by Intl.PluralRules for
 *                                      the message's own locale; `#` is the
 *                                      number, formatted for that locale
 *   {n, plural, =0 {nothing yet} other {…}}
 *                                      an exact-value case, matched before the
 *                                      language's categories
 *
 * Deliberately absent: nested selects, `select`/`selectordinal`, ICU's
 * apostrophe escaping. A message that needs one of those is a message to
 * simplify — and `format` throws on a malformed one rather than rendering the
 * braces, so the mistake surfaces in the checks rather than on the page.
 */

const ARG = /\{\s*([a-zA-Z0-9_]+)\s*(?:,\s*plural\s*,\s*)?/;

/** The `one {…} other {…}` body of a plural argument, as a map of category → text. */
function parseCategories(source, from) {
  const cases = new Map();
  let i = from;
  while (i < source.length) {
    while (i < source.length && /\s/.test(source[i])) i++;
    if (source[i] === "}") return { cases, end: i + 1 };
    const nameEnd = source.indexOf("{", i);
    if (nameEnd < 0) throw new Error(`unterminated plural near "${source.slice(i, i + 20)}"`);
    const category = source.slice(i, nameEnd).trim();
    let depth = 1;
    let j = nameEnd + 1;
    while (j < source.length && depth > 0) {
      if (source[j] === "{") depth++;
      else if (source[j] === "}") depth--;
      j++;
    }
    if (depth !== 0) throw new Error(`unbalanced braces in plural case "${category}"`);
    cases.set(category, source.slice(nameEnd + 1, j - 1));
    i = j;
  }
  throw new Error("unterminated plural argument");
}

/**
 * Format one ICU message.
 * @param {string} message the pattern
 * @param {object} params values for its arguments
 * @param {string} locale BCP-47 tag — picks both the plural categories and the number format
 * @param {(text: string) => string} [escape] applied to the message's own literal
 *   text and to interpolated values; a caller building HTML passes an escaper
 *   and interpolates already-built markup through `raw`
 * @param {object} [raw] values interpolated verbatim, not escaped
 */
export function format(message, params = {}, locale = "en", escape = (s) => s, raw = {}) {
  let out = "";
  let i = 0;
  while (i < message.length) {
    const open = message.indexOf("{", i);
    if (open < 0) return out + escape(message.slice(i));
    out += escape(message.slice(i, open));
    const head = ARG.exec(message.slice(open));
    if (!head || head.index !== 0) throw new Error(`malformed argument in "${message}"`);
    const name = head[1];
    const isPlural = head[0].includes("plural");
    if (!isPlural) {
      const close = message.indexOf("}", open);
      if (close < 0) throw new Error(`unterminated argument {${name}} in "${message}"`);
      out += name in raw ? raw[name] : escape(String(params[name] ?? ""));
      i = close + 1;
      continue;
    }
    const { cases, end } = parseCategories(message, open + head[0].length);
    const value = Number(params[name]);
    const category = new Intl.PluralRules(locale).select(value);
    const body = cases.get(`=${value}`) ?? cases.get(category) ?? cases.get("other");
    if (body === undefined) throw new Error(`plural {${name}} in "${message}" has no "other" case`);
    out += format(
      body.replaceAll("#", new Intl.NumberFormat(locale).format(value)),
      params,
      locale,
      escape,
      raw
    );
    i = end;
  }
  return out;
}

/** Every argument name a message uses — what the checks compare across languages. */
export function argumentsOf(message) {
  const names = new Set();
  const re = /\{\s*([a-zA-Z0-9_]+)\s*(?:,\s*plural\s*,)?/g;
  for (const m of message.matchAll(re)) names.add(m[1]);
  return names;
}

/** Every plural category a message offers for each of its plural arguments. */
export function pluralCategoriesOf(message) {
  const found = new Map();
  const re = /\{\s*([a-zA-Z0-9_]+)\s*,\s*plural\s*,/g;
  for (const m of message.matchAll(re)) {
    const { cases } = parseCategories(message, m.index + m[0].length);
    found.set(m[1], new Set(cases.keys()));
  }
  return found;
}
