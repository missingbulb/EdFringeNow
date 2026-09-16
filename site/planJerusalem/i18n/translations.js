/* The festival planner's own words, in every language it speaks.
 *
 * ONE key per string the page's chrome can render, each carrying its four
 * translations and the width its slot can afford. The programme's own text —
 * show names, venues, categories — is never in here: it stays in the source's
 * Hebrew whatever language the chrome is in (see `foreign()` in
 * ../planJerusalem.js).
 *
 * Key-major rather than one file per language, because the two things a
 * translator has to see together are the other languages' takes on a key and
 * the room it has to fit in. It converts mechanically to the locale-major
 * files or the XLIFF a translation vendor would want.
 *
 * ## The fields
 *
 * - `maxWidthPx` — how wide, in CSS pixels, the rendered string may draw. This
 *   is XLIFF 1.2's `maxwidth` attribute, whose own `size-unit` defaults to
 *   `pixel`; it is a property of the SLOT, so it is one number for all four
 *   languages rather than one per language, and it is taken from the tightest
 *   layout the page supports (the narrower of the two committed viewports;
 *   direction does not change how wide a run of text draws). A slot that
 *   cannot wrap — a pill in the grid's 104px status column, a nav item, a
 *   chip — budgets that column's width, less whatever the markup puts beside
 *   the words. A slot that wraps budgets its width times the number of lines
 *   the design gives it, since a paragraph's width is its total advance spread
 *   down the block. Leaf 19.6's case measures every string against the number
 *   in the real page, so a budget is enforced rather than advisory; raising
 *   one is a claim about the design and belongs with a change to the design.
 * - `maxWidthPx: null` + `unrendered` — the string has no box of its own: an
 *   `aria-label` a screen reader speaks, a `title` the OS draws, the document's
 *   own title and description. A budget there would be a number about nothing,
 *   and `null` says that rather than `0` pretending to be a measurement.
 * - `probe` — where to measure a string the page only renders in some states
 *   (a verdict the plan didn't reach, a filter nobody set): the element whose
 *   typography and box that string lands in. A key with a live slot on the page
 *   needs none — the check finds the slot by its own `data-i18n*` binding.
 * - `sample` — values for a message's arguments, used when measuring. A count
 *   is measured at its widest realistic value; text that comes out of the
 *   programme is measured as empty, because its length is the catalogue's to
 *   answer for and not the translator's.
 * - the language keys themselves — ICU MessageFormat patterns (./format.js).
 *   Every plural argument must offer every category the language has, which
 *   `19.5`'s case checks against `Intl.PluralRules` rather than against a list
 *   copied into this repo.
 */

/* The languages the page speaks, in the order the picker offers them.
 *
 * `intl` is the tag Intl formats dates and numbers with, and it carries a
 * region where the bare language leaves one open: this site's English is
 * British ("18 Oct", not "Oct 18"), which `en` alone does not say. The keys
 * below stay on the bare code — a region changes how a date is written, never
 * which translation is chosen. */
export const LOCALES = [
  { code: "en", intl: "en-GB", dir: "ltr", endonym: "English" },
  { code: "he", intl: "he-IL", dir: "rtl", endonym: "עברית" },
  { code: "ru", intl: "ru-RU", dir: "ltr", endonym: "Русский" },
  { code: "ja", intl: "ja-JP", dir: "ltr", endonym: "日本語" },
];

/** What an unrecognised (or absent) language preference falls back to. */
export const DEFAULT_LOCALE = "en";

export const STRINGS = {
  // ---------------------------------------------------------------- chrome --
  "doc.title": {
    maxWidthPx: null,
    unrendered: "the document's title — a browser tab, not a slot on the page",
    en: "Jerusalem Comedy Festival Planner · EdFringeNow",
    he: "מתכנן פסטיבל הקומדיה ירושלים · EdFringeNow",
    ru: "Планировщик Иерусалимского фестиваля комедии · EdFringeNow",
    ja: "エルサレム・コメディ・フェスティバル プランナー · EdFringeNow",
  },
  "doc.description": {
    maxWidthPx: null,
    unrendered: "the meta description — search results and link previews, not a slot on the page",
    en: "Plan the Jerusalem Comedy Festival: star the shows you want, scrub the five festival nights, and get a clash-free itinerary with the walk between venues.",
    he: "תכננו את פסטיבל הקומדיה ירושלים: סמנו בכוכב את ההופעות שבא לכם, גללו בין חמשת ערבי הפסטיבל וקבלו מסלול בלי חפיפות, כולל ההליכה בין המקומות.",
    ru: "Спланируйте Иерусалимский фестиваль комедии: отметьте нужные шоу, пройдитесь по пяти вечерам фестиваля и получите маршрут без накладок, с дорогой между площадками.",
    ja: "エルサレム・コメディ・フェスティバルの計画を。観たい公演に星をつけ、5夜を見渡して、会場間の移動込みで重ならない予定表をつくれます。",
  },
  "festival.title": {
    maxWidthPx: 1020,
    en: "Jerusalem Comedy Festival planner",
    he: "מתכנן פסטיבל הקומדיה ירושלים",
    ru: "Планировщик фестиваля комедии",
    ja: "エルサレム・コメディ・フェスティバル プランナー",
  },
  "festival.city": {
    maxWidthPx: 100,
    en: "Jerusalem",
    he: "ירושלים",
    ru: "Иерусалим",
    ja: "エルサレム",
  },
  "nav.now": {
    maxWidthPx: 100,
    en: "Now",
    he: "עכשיו",
    ru: "Сейчас",
    ja: "いま",
  },
  "nav.plan": {
    maxWidthPx: 100,
    en: "Plan",
    he: "תכנון",
    ru: "План",
    ja: "プラン",
  },
  "nav.primaryLabel": {
    maxWidthPx: null,
    unrendered: "the site navigation's accessible name",
    en: "Primary",
    he: "ראשי",
    ru: "Основная",
    ja: "メイン",
  },
  "header.run": {
    maxWidthPx: 375,
    sample: { city: "Jerusalem", range: "18–22 Oct 2026" },
    en: "{city} · {range}",
    he: "{city} · {range}",
    ru: "{city} · {range}",
    ja: "{city} · {range}",
  },
  "chrome.language": {
    maxWidthPx: null,
    unrendered: "the language picker's accessible name — the control itself shows the language's own name",
    en: "Language",
    he: "שפה",
    ru: "Язык",
    ja: "言語",
  },
  "chrome.theme.toDark": {
    maxWidthPx: null,
    unrendered: "the theme toggle's accessible name and tooltip while the page is light",
    en: "Switch to dark mode",
    he: "מעבר למצב כהה",
    ru: "Переключить на тёмную тему",
    ja: "ダークモードに切り替え",
  },
  "chrome.theme.toLight": {
    maxWidthPx: null,
    unrendered: "the theme toggle's accessible name and tooltip while the page is dark",
    en: "Switch to light mode",
    he: "מעבר למצב בהיר",
    ru: "Переключить на светлую тему",
    ja: "ライトモードに切り替え",
  },

  // ----------------------------------------------------------- board states --
  "state.loading.title": {
    maxWidthPx: 560,
    en: "Loading the programme…",
    he: "טוענים את התוכנייה…",
    ru: "Загружаем программу…",
    ja: "プログラムを読み込み中…",
  },
  "state.loading.sub": {
    maxWidthPx: 560,
    en: "Fetching this year's shows — just a moment.",
    he: "מביאים את ההופעות של השנה — רגע אחד.",
    ru: "Получаем шоу этого года — один момент.",
    ja: "今年の公演を取得しています — 少々お待ちください。",
  },
  "state.error.title": {
    maxWidthPx: 560,
    en: "We couldn't load the programme.",
    he: "לא הצלחנו לטעון את התוכנייה.",
    ru: "Не удалось загрузить программу.",
    ja: "プログラムを読み込めませんでした。",
  },
  "state.error.sub": {
    maxWidthPx: 560,
    en: "Check your connection and try again.",
    he: "בדקו את החיבור ונסו שוב.",
    ru: "Проверьте соединение и попробуйте снова.",
    ja: "接続を確認してもう一度お試しください。",
  },
  "state.error.retry": {
    maxWidthPx: 240,
    en: "Try again",
    he: "נסו שוב",
    ru: "Попробовать снова",
    ja: "再試行",
  },

  // ------------------------------------------------------------ the board --
  "board.count.none": {
    probe: "#boardCount",
    maxWidthPx: 680,
    en: "No shows planned, no shows selected",
    he: "לא תוכננו הופעות, לא נבחרו הופעות",
    ru: "Ничего не запланировано и не выбрано",
    ja: "予定した公演も選んだ公演もありません",
  },
  "board.count.some": {
    probe: "#boardCount",
    maxWidthPx: 680,
    sample: { planned: 12, selected: 24 },
    en: "{planned, plural, one {# show} other {# shows}} planned out of {selected} selected",
    he: "{planned, plural, one {הופעה אחת מתוכננת} two {# הופעות מתוכננות} other {# הופעות מתוכננות}} מתוך {selected} שנבחרו",
    ru: "{planned, plural, one {# шоу запланировано} few {# шоу запланировано} many {# шоу запланировано} other {# шоу запланировано}} из {selected} выбранных",
    ja: "選んだ{selected}公演のうち{planned}公演を予定に入れました",
  },
  "board.clear": {
    maxWidthPx: 160,
    en: "Clear",
    he: "ניקוי",
    ru: "Очистить",
    ja: "クリア",
  },
  "board.legend": {
    maxWidthPx: 88,
    en: "Legend",
    he: "מקרא",
    ru: "Легенда",
    ja: "凡例",
  },
  "board.status": {
    maxWidthPx: 104,
    en: "Status",
    he: "מצב",
    ru: "Статус",
    ja: "状況",
  },
  "board.legendLabel": {
    maxWidthPx: null,
    unrendered: "the colour key dialog's accessible name",
    en: "Colour key",
    he: "מקרא צבעים",
    ru: "Цветовые обозначения",
    ja: "色の凡例",
  },
  "legend.onSale": {
    maxWidthPx: 130,
    en: "On sale",
    he: "במכירה",
    ru: "В продаже",
    ja: "発売中",
  },
  "legend.free": {
    maxWidthPx: 130,
    en: "Free entry",
    he: "כניסה חופשית",
    ru: "Вход свободный",
    ja: "入場無料",
  },
  "legend.inPlan": {
    maxWidthPx: 130,
    en: "In your plan",
    he: "בתוכנית שלכם",
    ru: "В вашем плане",
    ja: "あなたの予定",
  },

  // ----------------------------------------------------------- browse stage --
  "browse.pick": {
    maxWidthPx: 620,
    sample: { count: 34 },
    en: "Pick from {count, plural, one {# show} other {# shows}}",
    he: "בחרו מתוך {count, plural, one {הופעה אחת} two {# הופעות} other {# הופעות}}",
    ru: "Выберите из {count, plural, one {# шоу} few {# шоу} many {# шоу} other {# шоу}}",
    ja: "{count}公演から選んでください",
  },
  "browse.hint": {
    maxWidthPx: 1240,
    en: "Star one and it becomes a lane on the grid; the search bar below keeps the whole programme within reach after that.",
    he: "סמנו הופעה בכוכב והיא תהפוך לשורה בלוח; שורת החיפוש שלמטה משאירה את כל התוכנייה בהישג יד.",
    ru: "Отметьте шоу звёздочкой — и оно станет строкой в сетке; строка поиска ниже держит всю программу под рукой.",
    ja: "星をつけるとグリッドの一行になります。その後は下の検索バーからプログラム全体にアクセスできます。",
  },
  "browse.listLabel": {
    maxWidthPx: null,
    unrendered: "the browse list's accessible name",
    en: "The whole programme",
    he: "כל התוכנייה",
    ru: "Вся программа",
    ja: "プログラム全体",
  },

  // ----------------------------------------------------------- date window --
  "rail.nights": {
    maxWidthPx: 120,
    sample: { count: 5 },
    en: "{count, plural, one {# night} other {# nights}}",
    he: "{count, plural, one {לילה אחד} two {# לילות} other {# לילות}}",
    ru: "{count, plural, one {# ночь} few {# ночи} many {# ночей} other {# ночи}}",
    ja: "{count}泊",
  },
  "rail.from": {
    maxWidthPx: 70,
    en: "From",
    he: "מ־",
    ru: "С",
    ja: "開始",
  },
  "rail.to": {
    maxWidthPx: 70,
    en: "To",
    he: "עד",
    ru: "По",
    ja: "終了",
  },
  "rail.startLabel": {
    maxWidthPx: null,
    unrendered: "the window's start handle, spoken by a screen reader",
    en: "Window start date",
    he: "תאריך תחילת החלון",
    ru: "Дата начала окна",
    ja: "期間の開始日",
  },
  "rail.endLabel": {
    maxWidthPx: null,
    unrendered: "the window's end handle, spoken by a screen reader",
    en: "Window end date",
    he: "תאריך סיום החלון",
    ru: "Дата конца окна",
    ja: "期間の終了日",
  },

  // ---------------------------------------------------------------- search --
  "search.placeholder": {
    maxWidthPx: 260,
    en: "Search shows to add",
    he: "חיפוש הופעות להוספה",
    ru: "Найти шоу, чтобы добавить",
    ja: "追加する公演を検索",
  },
  "search.tools": {
    maxWidthPx: 160,
    en: "Search tools",
    he: "כלי חיפוש",
    ru: "Фильтры",
    ja: "検索ツール",
  },
  "search.resultsLabel": {
    maxWidthPx: null,
    unrendered: "the results list's accessible name",
    en: "Matching shows",
    he: "הופעות תואמות",
    ru: "Подходящие шоу",
    ja: "一致する公演",
  },
  "search.empty": {
    maxWidthPx: 850,
    en: "No shows match — try fewer filters or a different spelling.",
    he: "אין הופעות תואמות — נסו פחות מסננים או איות אחר.",
    ru: "Ничего не найдено — снимите часть фильтров или измените написание.",
    ja: "該当する公演がありません — フィルターを減らすか、別の表記をお試しください。",
  },
  "search.anyKind": {
    maxWidthPx: 150,
    en: "Any kind",
    he: "כל הסוגים",
    ru: "Любой жанр",
    ja: "すべての種類",
  },
  "search.anyVenue": {
    maxWidthPx: 150,
    en: "Any venue",
    he: "כל המקומות",
    ru: "Любая площадка",
    ja: "すべての会場",
  },
  "search.kindsChosen": {
    probe: "#ssfGenreValue",
    maxWidthPx: 150,
    sample: { count: 12 },
    en: "{count, plural, one {# kind} other {# kinds}}",
    he: "{count, plural, one {סוג אחד} two {# סוגים} other {# סוגים}}",
    ru: "{count, plural, one {# жанр} few {# жанра} many {# жанров} other {# жанра}}",
    ja: "{count}種類",
  },
  "search.venuesChosen": {
    probe: "#ssfVenueValue",
    maxWidthPx: 150,
    sample: { count: 12 },
    en: "{count, plural, one {# venue} other {# venues}}",
    he: "{count, plural, one {מקום אחד} two {# מקומות} other {# מקומות}}",
    ru: "{count, plural, one {# площадка} few {# площадки} many {# площадок} other {# площадки}}",
    ja: "{count}会場",
  },
  "search.whichKinds": {
    maxWidthPx: 200,
    en: "Which kinds?",
    he: "אילו סוגים?",
    ru: "Какие жанры?",
    ja: "どの種類?",
  },
  "search.whichVenues": {
    maxWidthPx: 200,
    en: "Which venues?",
    he: "אילו מקומות?",
    ru: "Какие площадки?",
    ja: "どの会場?",
  },
  "search.everything": {
    maxWidthPx: 120,
    en: "everything!",
    he: "הכול!",
    ru: "всё!",
    ja: "すべて!",
  },
  "search.clearFilters": {
    maxWidthPx: 180,
    en: "Clear filters",
    he: "ניקוי מסננים",
    ru: "Сбросить фильтры",
    ja: "フィルターを解除",
  },
  "search.star.add": {
    maxWidthPx: null,
    unrendered: "a show's star button while the show is not starred, spoken by a screen reader",
    sample: { title: "" },
    en: "Add {title}",
    he: "הוספת {title}",
    ru: "Добавить {title}",
    ja: "{title}を追加",
  },
  "search.star.remove": {
    maxWidthPx: null,
    unrendered: "a show's star button while the show is starred, spoken by a screen reader",
    sample: { title: "" },
    en: "Remove {title}",
    he: "הסרת {title}",
    ru: "Убрать {title}",
    ja: "{title}を削除",
  },
  "show.performances": {
    probe: ".ss-row-meta",
    maxWidthPx: 220,
    sample: { count: 12 },
    en: "{count, plural, one {# performance} other {# performances}}",
    he: "{count, plural, one {הופעה אחת} two {# הופעות} other {# הופעות}}",
    ru: "{count, plural, one {# показ} few {# показа} many {# показов} other {# показа}}",
    ja: "{count}公演",
  },
  "show.minutes": {
    probe: ".ss-row-meta",
    maxWidthPx: 120,
    sample: { count: 105 },
    en: "{count} min",
    he: "{count} דק׳",
    ru: "{count} мин",
    ja: "{count}分",
  },

  // ------------------------------------------------------------- the lanes --
  "lane.remove": {
    maxWidthPx: null,
    unrendered: "a lane's remove button, spoken by a screen reader",
    sample: { title: "" },
    en: "Remove {title} from the list",
    he: "הסרת {title} מהרשימה",
    ru: "Убрать {title} из списка",
    ja: "{title}をリストから削除",
  },
  "lane.scheduled": {
    probe: ".lane-status",
    maxWidthPx: 86,
    en: "Scheduled!",
    he: "נקבע!",
    ru: "В плане!",
    ja: "予定済み",
  },
  "lane.noDates": {
    probe: ".lane-status",
    maxWidthPx: 86,
    en: "No dates",
    he: "אין תאריכים",
    ru: "Нет дат",
    ja: "日程なし",
  },
  "lane.outsideHours": {
    probe: ".lane-status",
    maxWidthPx: 86,
    en: "Outside hours",
    he: "מחוץ לשעות",
    ru: "Вне часов",
    ja: "時間帯の外",
  },
  "lane.cantFit": {
    probe: ".lane-status",
    maxWidthPx: 104,
    en: "Can't fit",
    he: "לא נכנס",
    ru: "Не помещается",
    ja: "入りません",
  },
  "perf.tip": {
    maxWidthPx: null,
    unrendered: "a performance mark's tooltip, drawn by the operating system",
    sample: { day: "Sunday 18 Oct", time: "20:00" },
    en: "{day}, {time}",
    he: "{day}, {time}",
    ru: "{day}, {time}",
    ja: "{day} {time}",
  },
  "perf.tip.free": {
    maxWidthPx: null,
    unrendered: "a free performance's tooltip, drawn by the operating system",
    sample: { day: "Sunday 18 Oct", time: "22:00" },
    en: "{day}, {time} — free entry",
    he: "{day}, {time} — כניסה חופשית",
    ru: "{day}, {time} — вход свободный",
    ja: "{day} {time} — 入場無料",
  },

  // -------------------------------------------------------------- the plan --
  "plan.title": {
    maxWidthPx: 560,
    en: "Your festival, planned",
    he: "הפסטיבל שלכם, מתוכנן",
    ru: "Ваш фестиваль, распланированный",
    ja: "あなたのフェスティバル、計画完了",
  },
  "plan.sub": {
    maxWidthPx: 1700,
    sample: { window: "" },
    en: "Your starred shows, fitted into a clash-free run across {window} — one performance each, with the walk between them. Tune anything below and the plan updates instantly.",
    he: "ההופעות שסימנתם, משובצות ברצף בלי חפיפות על פני {window} — הופעה אחת לכל אחת, כולל ההליכה ביניהן. שנו כל דבר למטה והתוכנית תתעדכן מיד.",
    ru: "Отмеченные вами шоу, собранные без накладок в пределах {window} — по одному показу на каждое, с дорогой между ними. Измените что угодно ниже, и план обновится сразу.",
    ja: "星をつけた公演を{window}の中で重ならないように配置します — 各公演1回ずつ、移動時間込みで。下の設定を変えるとすぐに反映されます。",
  },
  "plan.window.placeholder": {
    probe: "#planSub",
    maxWidthPx: 240,
    en: "your window",
    he: "החלון שלכם",
    ru: "вашего окна",
    ja: "選んだ期間",
  },
  "plan.summary": {
    maxWidthPx: 560,
    sample: { shows: 12, nights: 5 },
    en: "{shows, plural, one {# show} other {# shows}} across {nights, plural, one {# night} other {# nights}}.",
    he: "{shows, plural, one {הופעה אחת} two {# הופעות} other {# הופעות}} על פני {nights, plural, one {לילה אחד} two {# לילות} other {# לילות}}.",
    ru: "{shows, plural, one {# шоу} few {# шоу} many {# шоу} other {# шоу}} за {nights, plural, one {# ночь} few {# ночи} many {# ночей} other {# ночи}}.",
    ja: "{nights}泊で{shows}公演。",
  },
  "plan.summary.unfitted": {
    probe: "#planSummary",
    maxWidthPx: 320,
    sample: { count: 12 },
    en: "{count, plural, one {# couldn't be fitted} other {# couldn't be fitted}}.",
    he: "{count, plural, one {אחת לא נכנסה} two {# לא נכנסו} other {# לא נכנסו}}.",
    ru: "{count, plural, one {# не поместилось} few {# не поместились} many {# не поместились} other {# не поместились}}.",
    ja: "{count}公演は入りませんでした。",
  },
  "plan.prefsLabel": {
    maxWidthPx: null,
    unrendered: "the preferences group's accessible name",
    en: "Plan preferences",
    he: "העדפות התכנון",
    ru: "Настройки плана",
    ja: "プランの設定",
  },
  "plan.day": {
    maxWidthPx: 80,
    en: "Day",
    he: "יום",
    ru: "День",
    ja: "1日",
  },
  "plan.dayHoursLabel": {
    maxWidthPx: null,
    unrendered: "the day-hours group's accessible name",
    en: "Day hours",
    he: "שעות היום",
    ru: "Часы дня",
    ja: "1日の時間帯",
  },
  "plan.dayStartLabel": {
    maxWidthPx: null,
    unrendered: "the day-start field, spoken by a screen reader",
    en: "Day starts (24-hour HH:MM)",
    he: "היום מתחיל (שעון 24, HH:MM)",
    ru: "День начинается (24 ч, ЧЧ:ММ)",
    ja: "1日の開始 (24時間表記 HH:MM)",
  },
  "plan.dayEndLabel": {
    maxWidthPx: null,
    unrendered: "the day-end field, spoken by a screen reader",
    en: "Day ends (HH:MM, up to 27:00 for 03:00)",
    he: "היום נגמר (HH:MM, עד 27:00 עבור 03:00)",
    ru: "День заканчивается (ЧЧ:ММ, до 27:00 вместо 03:00)",
    ja: "1日の終了 (HH:MM、03:00 は 27:00 まで)",
  },
  "plan.mealsLabel": {
    maxWidthPx: null,
    unrendered: "the meal-breaks group's accessible name",
    en: "Meal breaks",
    he: "הפסקות אוכל",
    ru: "Перерывы на еду",
    ja: "食事の休憩",
  },
  "plan.lunch": {
    maxWidthPx: 110,
    en: "Lunch",
    he: "צהריים",
    ru: "Обед",
    ja: "昼食",
  },
  "plan.dinner": {
    maxWidthPx: 110,
    en: "Dinner",
    he: "ערב",
    ru: "Ужин",
    ja: "夕食",
  },
  "plan.mealStartLabel": {
    maxWidthPx: null,
    unrendered: "a meal break's start field, spoken by a screen reader",
    sample: { meal: "Lunch" },
    en: "{meal} start",
    he: "תחילת {meal}",
    ru: "Начало: {meal}",
    ja: "{meal}の開始",
  },
  "plan.mealEndLabel": {
    maxWidthPx: null,
    unrendered: "a meal break's end field, spoken by a screen reader",
    sample: { meal: "Lunch" },
    en: "{meal} end",
    he: "סוף {meal}",
    ru: "Конец: {meal}",
    ja: "{meal}の終了",
  },
  "plan.perDayLabel": {
    maxWidthPx: null,
    unrendered: "the shows-per-day group's accessible name",
    en: "Shows per day",
    he: "הופעות ביום",
    ru: "Шоу в день",
    ja: "1日の公演数",
  },
  "plan.fewestLabel": {
    maxWidthPx: null,
    unrendered: "the per-day minimum field, spoken by a screen reader",
    en: "Fewest shows per day",
    he: "מינימום הופעות ביום",
    ru: "Минимум шоу в день",
    ja: "1日の最少公演数",
  },
  "plan.mostLabel": {
    maxWidthPx: null,
    unrendered: "the per-day maximum field, spoken by a screen reader",
    en: "Most shows per day",
    he: "מקסימום הופעות ביום",
    ru: "Максимум шоу в день",
    ja: "1日の最多公演数",
  },
  "plan.perDay": {
    maxWidthPx: 150,
    en: "shows/day",
    he: "הופעות ביום",
    ru: "шоу в день",
    ja: "公演/日",
  },
  "plan.gapGroupLabel": {
    maxWidthPx: null,
    unrendered: "the gap group's accessible name",
    en: "Gap between shows",
    he: "רווח בין הופעות",
    ru: "Промежуток между шоу",
    ja: "公演の間隔",
  },
  "plan.gapLabel": {
    maxWidthPx: null,
    unrendered: "the gap field, spoken by a screen reader",
    en: "Minimum gap between shows",
    he: "רווח מזערי בין הופעות",
    ru: "Минимальный промежуток между шоу",
    ja: "公演間の最小間隔",
  },
  "plan.gap.minutes": {
    probe: "#ctlGap",
    maxWidthPx: 120,
    sample: { count: 45 },
    en: "{count} min",
    he: "{count} דק׳",
    ru: "{count} мин",
    ja: "{count}分",
  },
  "plan.gap.hour": {
    probe: "#ctlGap",
    maxWidthPx: 120,
    en: "1 hour",
    he: "שעה",
    ru: "1 час",
    ja: "1時間",
  },
  "plan.apart": {
    maxWidthPx: 130,
    en: "apart",
    he: "ביניהן",
    ru: "между",
    ja: "空ける",
  },
  "plan.travelLabel": {
    maxWidthPx: null,
    unrendered: "the travel-mode group's accessible name",
    en: "Travel between venues",
    he: "מעבר בין מקומות",
    ru: "Дорога между площадками",
    ja: "会場間の移動",
  },
  "travel.walk": {
    maxWidthPx: 90,
    en: "Walk",
    he: "הליכה",
    ru: "Пешком",
    ja: "徒歩",
  },
  "travel.bike": {
    maxWidthPx: 90,
    en: "Bike",
    he: "אופניים",
    ru: "Вело",
    ja: "自転車",
  },
  "travel.car": {
    maxWidthPx: 90,
    en: "Car",
    he: "רכב",
    ru: "Авто",
    ja: "車",
  },
  "travel.walk.tip": {
    maxWidthPx: null,
    unrendered: "the walk button's tooltip, drawn by the operating system",
    en: "Walking time between venues — used when it's longer than the gap",
    he: "זמן הליכה בין מקומות — נלקח בחשבון כשהוא ארוך מהרווח",
    ru: "Время пешком между площадками — учитывается, когда оно больше промежутка",
    ja: "会場間の徒歩時間 — 間隔より長いときに使われます",
  },
  "travel.bike.tip": {
    maxWidthPx: null,
    unrendered: "the bike button's tooltip, drawn by the operating system",
    en: "Cycling time between venues — used when it's longer than the gap",
    he: "זמן רכיבה בין מקומות — נלקח בחשבון כשהוא ארוך מהרווח",
    ru: "Время на велосипеде между площадками — учитывается, когда оно больше промежутка",
    ja: "会場間の自転車時間 — 間隔より長いときに使われます",
  },
  "travel.car.tip": {
    maxWidthPx: null,
    unrendered: "the car button's tooltip, drawn by the operating system",
    en: "Driving time between venues — used when it's longer than the gap",
    he: "זמן נסיעה בין מקומות — נלקח בחשבון כשהוא ארוך מהרווח",
    ru: "Время на машине между площадками — учитывается, когда оно больше промежутка",
    ja: "会場間の運転時間 — 間隔より長いときに使われます",
  },

  // ---------------------------------------------------------- the schedule --
  "schedule.empty": {
    maxWidthPx: 1400,
    en: "Nothing could be scheduled in this window. Try widening your dates, raising the per-day maximum, shortening the gap, or relaxing your day hours.",
    he: "שום דבר לא נכנס לחלון הזה. נסו להרחיב את התאריכים, להעלות את המקסימום ליום, לקצר את הרווח או להרפות את שעות היום.",
    ru: "В этом окне ничего не поместилось. Расширьте даты, поднимите максимум в день, сократите промежуток или смягчите часы дня.",
    ja: "この期間には何も入りませんでした。日程を広げる、1日の上限を上げる、間隔を短くする、時間帯をゆるめる、のいずれかをお試しください。",
  },
  "schedule.dayCount": {
    probe: ".sch-day-count",
    maxWidthPx: 110,
    sample: { count: 4 },
    en: "{count, plural, one {# show} other {# shows}}",
    he: "{count, plural, one {הופעה אחת} two {# הופעות} other {# הופעות}}",
    ru: "{count, plural, one {# шоу} few {# шоу} many {# шоу} other {# шоу}}",
    ja: "{count}公演",
  },
  "schedule.nothingPlanned": {
    maxWidthPx: null,
    unrendered: "an empty day column's tooltip, drawn by the operating system",
    sample: { day: "Monday 19 Oct" },
    en: "{day} — nothing planned",
    he: "{day} — לא תוכנן כלום",
    ru: "{day} — ничего не запланировано",
    ja: "{day} — 予定なし",
  },
  "leg.sameVenue": {
    probe: ".leg-text",
    maxWidthPx: 170,
    sample: { gap: 45 },
    en: "same venue · {gap}′ gap",
    he: "אותו מקום · {gap}′ רווח",
    ru: "та же площадка · {gap}′",
    ja: "同じ会場 · {gap}′",
  },
  "leg.nearby": {
    probe: ".leg-text",
    maxWidthPx: 170,
    sample: { gap: 45 },
    en: "nearby · {gap}′ gap",
    he: "בסמוך · {gap}′ רווח",
    ru: "рядом · {gap}′",
    ja: "近く · {gap}′",
  },
  "leg.travel": {
    probe: ".leg-text",
    maxWidthPx: 170,
    sample: { minutes: 12, km: "1.4", spare: "+20" },
    en: "{minutes}′ · {km}km · {spare}′",
    he: "{minutes}′ · {km} ק״מ · {spare}′",
    ru: "{minutes}′ · {km} км · {spare}′",
    ja: "{minutes}′ · {km}km · {spare}′",
  },
  "leg.sameVenue.tip": {
    maxWidthPx: null,
    unrendered: "a same-venue leg's tooltip, drawn by the operating system",
    sample: { venue: "", gap: 45 },
    en: "{venue} — no travel, {gap} min between shows",
    he: "{venue} — בלי נסיעה, {gap} דק׳ בין ההופעות",
    ru: "{venue} — без дороги, {gap} мин между шоу",
    ja: "{venue} — 移動なし、公演間{gap}分",
  },
  "leg.unknown.tip": {
    maxWidthPx: null,
    unrendered: "an unknown-travel leg's tooltip, drawn by the operating system",
    en: "Travel time unknown (venue has no coordinates)",
    he: "זמן הנסיעה לא ידוע (למקום אין קואורדינטות)",
    ru: "Время в пути неизвестно (у площадки нет координат)",
    ja: "移動時間は不明です (会場の座標がありません)",
  },
  "leg.travel.tip": {
    maxWidthPx: null,
    unrendered: "a travel leg's tooltip, drawn by the operating system",
    sample: { minutes: 12, km: "1.4", gap: 45, spare: 33 },
    en: "{minutes} min {mode} · {km} km — {gap} min gap, {spare} min spare",
    he: "{minutes} דק׳ {mode} · {km} ק״מ — רווח {gap} דק׳, {spare} דק׳ עודף",
    ru: "{minutes} мин {mode} · {km} км — промежуток {gap} мин, запас {spare} мин",
    ja: "{mode}{minutes}分 · {km}km — 間隔{gap}分、余裕{spare}分",
  },
  "travel.mode.walk": {
    maxWidthPx: null,
    unrendered: "the mode named inside a travel leg's tooltip",
    en: "walk",
    he: "הליכה",
    ru: "пешком",
    ja: "徒歩",
  },
  "travel.mode.bike": {
    maxWidthPx: null,
    unrendered: "the mode named inside a travel leg's tooltip",
    en: "cycle",
    he: "רכיבה",
    ru: "на велосипеде",
    ja: "自転車",
  },
  "travel.mode.car": {
    maxWidthPx: null,
    unrendered: "the mode named inside a travel leg's tooltip",
    en: "drive",
    he: "נסיעה",
    ru: "на машине",
    ja: "車",
  },

  // ------------------------------------------------------------ trip links --
  "trip.title": {
    maxWidthPx: 320,
    en: "While you're here",
    he: "כשאתם כבר כאן",
    ru: "Пока вы здесь",
    ja: "せっかくなので",
  },
  "trip.stay": {
    maxWidthPx: 220,
    en: "Find a bed",
    he: "למצוא מיטה",
    ru: "Найти жильё",
    ja: "宿を探す",
  },
  "trip.transfers": {
    maxWidthPx: 220,
    en: "Airport transfers",
    he: "הסעות משדה התעופה",
    ru: "Трансфер из аэропорта",
    ja: "空港送迎",
  },
  "trip.rail": {
    maxWidthPx: 220,
    en: "Trains",
    he: "רכבות",
    ru: "Поезда",
    ja: "鉄道",
  },
  "trip.partnerTip": {
    maxWidthPx: null,
    unrendered: "a partner link's tooltip, drawn by the operating system",
    sample: { text: "Find a bed", partner: "Booking.com" },
    en: "{text} on {partner} — partner link, we may earn a commission",
    he: "{text} דרך {partner} — קישור שותפים, אנחנו עשויים לקבל עמלה",
    ru: "{text} на {partner} — партнёрская ссылка, мы можем получить комиссию",
    ja: "{partner}で{text} — パートナーリンク、手数料を受け取る場合があります",
  },

  // --------------------------------------------------------------- exports --
  "export.csv": {
    maxWidthPx: 260,
    en: "Download itinerary",
    he: "הורדת המסלול",
    ru: "Скачать маршрут",
    ja: "予定表をダウンロード",
  },
  "export.ics": {
    maxWidthPx: 260,
    en: "Import to calendar",
    he: "ייבוא ליומן",
    ru: "Добавить в календарь",
    ja: "カレンダーに取り込む",
  },
  "export.note": {
    maxWidthPx: 1400,
    en: "Both files are built here in your browser — nothing is uploaded. Times are pinned to Jerusalem, so they stay right wherever your calendar lives.",
    he: "שני הקבצים נבנים כאן בדפדפן שלכם — שום דבר לא נשלח לשרת. השעות נעוצות לירושלים, כך שהן נכונות בכל יומן.",
    ru: "Оба файла собираются здесь, в вашем браузере — ничего не загружается на сервер. Время закреплено за Иерусалимом, поэтому оно верно в любом календаре.",
    ja: "どちらのファイルもブラウザー内で作成され、アップロードされません。時刻はエルサレムに固定されているので、どのカレンダーでも正しく表示されます。",
  },
  "export.calendarName": {
    maxWidthPx: null,
    unrendered: "the calendar's name inside the exported .ics file",
    sample: { festival: "" },
    en: "My {festival} plan",
    he: "התוכנית שלי ל{festival}",
    ru: "Мой план: {festival}",
    ja: "私の{festival}プラン",
  },

  // ---------------------------------------------------------------- footer --
  "footer.rights": {
    maxWidthPx: 240,
    en: "© 2026 Missing Bulb",
    he: "© 2026 Missing Bulb",
    ru: "© 2026 Missing Bulb",
    ja: "© 2026 Missing Bulb",
  },
  "footer.dataFrom": {
    maxWidthPx: 530,
    sample: { source: "" },
    en: "Programme data from {source}.",
    he: "נתוני התוכנייה מתוך {source}.",
    ru: "Данные программы — {source}.",
    ja: "プログラムのデータ提供: {source}。",
  },
  "footer.partnerNote": {
    maxWidthPx: 1400,
    en: "Some travel suggestions are partner links — booking through one may earn us a commission, at no extra cost to you.",
    he: "חלק מהצעות הנסיעה הן קישורי שותפים — הזמנה דרכם עשויה לזכות אותנו בעמלה, בלי עלות נוספת לכם.",
    ru: "Часть советов о поездке — партнёрские ссылки: бронирование через них может принести нам комиссию, без доплаты для вас.",
    ja: "旅行の提案の一部はパートナーリンクです — そこから予約されると手数料を受け取ることがありますが、追加費用はかかりません。",
  },
};
