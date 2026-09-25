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
 *                                    data-i18n-data-tip, data-i18n-aria-label
 *   data-i18n-slot="key"             the key an element renders when the page's
 *                                    own code writes the text — applied to
 *                                    nothing, read by the pixel-budget check
 *
 * The two preferences resolve differently on purpose:
 *
 *   language   the URL, and only the URL — one address per language, so a
 *              link means the same thing to everyone who opens it and a
 *              crawler has something to index per language. Nothing is
 *              stored and the device is not consulted: a page that answered
 *              a device preference would be a page whose other languages
 *              nobody could reach.
 *   theme      ?theme= (which is also how a case pins one), then
 *              localStorage under the caller's prefix, then the device's
 *              prefers-color-scheme. It changes no content, so it costs a
 *              reader nothing to carry it from visit to visit.
 */

import { format } from "./format.js";
import { DEFAULT_LOCALE, LOCALES, STRINGS } from "./translations.js";

const LOCALE_CODES = LOCALES.map((l) => l.code);
const DIR_OF = new Map(LOCALES.map((l) => [l.code, l.dir]));
const INTL_OF = new Map(LOCALES.map((l) => [l.code, l.intl]));

/**
 * The URL a language is served at, under the page's own root. The default
 * language is the root itself, so the address a reader is given, and the one
 * every other language's `hreflang` points at, is the planner's own.
 * @param {string} code the language
 * @param {string} root the page's root path, with both slashes
 */
export function localeHref(code, root) {
  return code === DEFAULT_LOCALE ? root : `${root}${code}/`;
}

/** The language a path names, or the default where it names none. */
export function localeFromPath(pathname, root) {
  const segment = (pathname.startsWith(root) ? pathname.slice(root.length) : "").split("/")[0];
  return LOCALE_CODES.includes(segment) ? segment : DEFAULT_LOCALE;
}

const state = {
  locale: DEFAULT_LOCALE,
  /* The path every language of this page hangs off, from initI18n. */
  root: "/",
  /* "light" | "dark" chosen by the reader, or null for "whatever the device says". */
  theme: null,
  storagePrefix: "",
  themeButton: null,
  onChange: () => {},
  /* The document's title, when the page knows better than the static one. */
  documentTitle: null,
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
    state.themeButton.dataset.tip = label;
  }
  document.title = (state.documentTitle && state.documentTitle()) || t("doc.title");
  const description = document.querySelector('meta[name="description"]');
  if (description) description.content = t("doc.description");
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
 * Read the language off the URL, resolve the reader's theme, translate the
 * static markup, and wire the two header controls.
 * @param {object} opts
 * @param {string} opts.root the path every language of this page hangs off
 * @param {string} opts.storagePrefix the page's own localStorage namespace
 * @param {Element} opts.localeSelect the language picker
 * @param {Element} opts.themeButton the light/dark toggle
 * @param {() => void} opts.onChange re-render hook for everything JS drew
 * @param {() => string|null} [opts.documentTitle] the title the page wants now,
 *   or null for the static one
 */
export function initI18n({
  root = "/",
  storagePrefix = "",
  localeSelect,
  themeButton,
  onChange = () => {},
  documentTitle = null,
} = {}) {
  state.storagePrefix = storagePrefix;
  state.documentTitle = documentTitle;
  state.themeButton = themeButton || null;
  state.onChange = onChange;

  state.root = root;
  state.locale = localeFromPath(location.pathname, root);

  const url = new URLSearchParams(location.search);
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
    // A language is an address, so choosing one is a navigation rather than a
    // re-render: the reader ends up somewhere they can bookmark and share.
    localeSelect.addEventListener("change", (e) => {
      location.assign(localeHref(e.target.value, state.root) + location.search + location.hash);
    });
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
