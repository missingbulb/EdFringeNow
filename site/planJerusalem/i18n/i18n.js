/* The page's language, direction and theme — resolved, applied and remembered.
 *
 * The machinery here names no festival and no string: it reads
 * ./translations.js and drives whatever markup carries the `data-i18n*`
 * attributes below. It lives beside the festival planner because that is the
 * only front-end that speaks more than one language; the day a second one
 * does, this module moves to ../../shared/ unchanged and both import it.
 *
 * Markup contract, so a static string needs no JavaScript of its own:
 *   data-i18n="key"                  the element's text
 *   data-i18n-<attr>="key"           that attribute, e.g. data-i18n-placeholder,
 *                                    data-i18n-title, data-i18n-aria-label
 *   data-i18n-slot="key"             the key an element renders when the page's
 *                                    own code writes the text — applied to
 *                                    nothing, read by the pixel-budget check
 *
 * Preference resolution, most explicit first:
 *   ?lang= / ?theme=   the URL, which is also how a case pins one
 *   localStorage       the reader's last choice, under the caller's prefix
 *   the device         navigator.languages / prefers-color-scheme
 *   the default        English, and whatever the device's colour scheme is
 */

import { format } from "./format.js";
import { DEFAULT_LOCALE, LOCALES, STRINGS } from "./translations.js";

const LOCALE_CODES = LOCALES.map((l) => l.code);
const DIR_OF = new Map(LOCALES.map((l) => [l.code, l.dir]));
const INTL_OF = new Map(LOCALES.map((l) => [l.code, l.intl]));

const state = {
  locale: DEFAULT_LOCALE,
  /* "light" | "dark" chosen by the reader, or null for "whatever the device says". */
  theme: null,
  storagePrefix: "",
  themeButton: null,
  onChange: () => {},
};

export function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
  );
}

export const currentLocale = () => state.locale;

/** The tag to format a date or a number with — the language, plus its region. */
export const currentIntlLocale = () => INTL_OF.get(state.locale) || state.locale;
export const currentDir = () => DIR_OF.get(state.locale) || "ltr";

/** The reader's chosen theme, or null while the device's preference is in force. */
export const currentTheme = () => state.theme;

/** One translated string, as text. */
export function t(key, params = {}) {
  const entry = STRINGS[key];
  if (!entry) throw new Error(`no such translation key: ${key}`);
  return format(entry[state.locale] ?? entry[DEFAULT_LOCALE], params, currentIntlLocale());
}

/**
 * One translated string, as HTML: the message's own text is escaped, and
 * anything in `raw` is interpolated as already-built markup — which is how a
 * string wraps a value in an element without the translation carrying tags.
 */
export function tHtml(key, params = {}, raw = {}) {
  const entry = STRINGS[key];
  if (!entry) throw new Error(`no such translation key: ${key}`);
  return format(entry[state.locale] ?? entry[DEFAULT_LOCALE], params, currentIntlLocale(), escapeHtml, raw);
}

/** Apply every `data-i18n*` binding under `root` in the current language. */
export function applyTranslations(root = document) {
  for (const el of root.querySelectorAll("[data-i18n]")) {
    el.textContent = t(el.dataset.i18n);
  }
  for (const el of root.querySelectorAll("*")) {
    for (const name of Object.keys(el.dataset)) {
      // `data-i18n-slot` names the key an element renders for the pixel-budget
      // check; the page's own code writes that text, so nothing is applied here.
      if (name === "i18n" || name === "i18nSlot" || !name.startsWith("i18n")) continue;
      // data-i18n-aria-label → i18nAriaLabel → aria-label
      const attr = name
        .slice(4)
        .replace(/^[A-Z]/, (c) => c.toLowerCase())
        .replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
      el.setAttribute(attr, t(el.dataset[name]));
    }
  }
}

function read(key) {
  try {
    return localStorage.getItem(state.storagePrefix + key);
  } catch {
    // A blocked localStorage is a page that forgets, not a page that breaks.
    return null;
  }
}

function write(key, value) {
  try {
    if (value === null) localStorage.removeItem(state.storagePrefix + key);
    else localStorage.setItem(state.storagePrefix + key, value);
  } catch {
    /* see read() */
  }
}

/** The first of the device's languages this page speaks, if it speaks any. */
function deviceLocale() {
  for (const tag of navigator.languages || [navigator.language || ""]) {
    const base = String(tag).toLowerCase().split("-")[0];
    if (LOCALE_CODES.includes(base)) return base;
  }
  return null;
}

function applyDocument() {
  const html = document.documentElement;
  html.lang = state.locale;
  html.dir = currentDir();
  if (state.theme) html.dataset.theme = state.theme;
  else delete html.dataset.theme;
  applyTranslations(document);
  if (state.themeButton) {
    // The toggle's label names the state a press would move to, so it flips
    // with the theme and cannot be a fixed data-i18n binding.
    const label = t(themeToggleKey());
    state.themeButton.setAttribute("aria-label", label);
    state.themeButton.title = label;
  }
  document.title = t("doc.title");
  const description = document.querySelector('meta[name="description"]');
  if (description) description.content = t("doc.description");
}

export function setLocale(code, { remember = true } = {}) {
  if (!LOCALE_CODES.includes(code) || code === state.locale) return;
  state.locale = code;
  if (remember) write("lang", code);
  applyDocument();
  state.onChange();
}

export function setTheme(theme, { remember = true } = {}) {
  state.theme = theme === "light" || theme === "dark" ? theme : null;
  if (remember) write("theme", state.theme);
  applyDocument();
  state.onChange();
}

/** Whether the page is dark right now — the reader's choice, else the device's. */
export function isDark() {
  if (state.theme) return state.theme === "dark";
  return matchMedia("(prefers-color-scheme: dark)").matches;
}

/**
 * Resolve the reader's language and theme, translate the static markup, and
 * wire the two header controls.
 * @param {object} opts
 * @param {string} opts.storagePrefix the page's own localStorage namespace
 * @param {Element} opts.localeSelect the language picker
 * @param {Element} opts.themeButton the light/dark toggle
 * @param {() => void} opts.onChange re-render hook for everything JS drew
 */
export function initI18n({ storagePrefix = "", localeSelect, themeButton, onChange = () => {} } = {}) {
  state.storagePrefix = storagePrefix;
  state.themeButton = themeButton || null;
  state.onChange = onChange;

  const url = new URLSearchParams(location.search);
  const asked = url.get("lang");
  const stored = read("lang");
  state.locale =
    (LOCALE_CODES.includes(asked) && asked) ||
    (LOCALE_CODES.includes(stored) && stored) ||
    deviceLocale() ||
    DEFAULT_LOCALE;

  const askedTheme = url.get("theme");
  const storedTheme = read("theme");
  state.theme =
    askedTheme === "light" || askedTheme === "dark"
      ? askedTheme
      : storedTheme === "light" || storedTheme === "dark"
        ? storedTheme
        : null;

  if (localeSelect) {
    localeSelect.innerHTML = LOCALES.map(
      (l) => `<option value="${l.code}" lang="${l.code}">${escapeHtml(l.endonym)}</option>`
    ).join("");
    localeSelect.value = state.locale;
    localeSelect.addEventListener("change", (e) => setLocale(e.target.value));
  }

  if (themeButton) {
    themeButton.addEventListener("click", () => setTheme(isDark() ? "light" : "dark"));
    // The device changing its mind still moves a page the reader hasn't pinned.
    matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
      if (!state.theme) applyDocument();
    });
  }

  applyDocument();
}

/** The theme toggle's own label, which names the state a press would move to. */
export function themeToggleKey() {
  return isDark() ? "chrome.theme.toLight" : "chrome.theme.toDark";
}
