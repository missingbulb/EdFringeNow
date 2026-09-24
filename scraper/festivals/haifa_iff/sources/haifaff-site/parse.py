"""Pure transforms that turn haifaff.co.il's server-rendered pages into programme records.

No network and no filesystem, except that `--selftest` reads the committed
samples/. `fetch.py` fetches the pages and passes their text in here.

What the site carries, and where (scraper/festivals/haifa_iff/README.md has the map):

  * `/eng/Screening_schedule` is the whole programme on one page. A day heading
    ("Friday 25.09.26") is followed by venue headings ("Rapaport"), and each
    venue lists rows: a start time, a heading (title and director run
    together), an info line, the row's section tags, a "More Info" link to
    `/eng/Films/<id>` or `/eng/Events/<id>`, and an "Order Tickets" link to
    `/eng/Basket/<screeningId>`;
  * `/eng/Films/<id>` holds a film's metadata: the h1 title, section links
    `…/Films/grp|fwsa|<groupId>/<name>`, and a "Label: value" list whose
    `Festival` entry is the edition number;
  * the Hebrew schedule `/לוח_הקרנות` has the same rows with the same ids. Its
    film links carry the Hebrew title as their slug.

The samples these rules were written against are reconstructed from markdown
renderings of those pages, not captured bytes. So the parser reads element
kinds (headings, list items, links, text lines) and never class names, which
nobody here has seen.
"""

import html as _html
import os
import re
import sys
import unicodedata
import urllib.parse
from html.parser import HTMLParser

HERE = os.path.dirname(os.path.abspath(__file__))
SAMPLES = os.path.join(HERE, "samples")

# Elements whose text is one line of the page. Anything else is inline, and
# its text joins the enclosing line.
_BLOCKS = {"h1", "h2", "h3", "h4", "h5", "h6", "li", "p", "div", "td", "th", "tr", "section", "article", "br", "hr", "ul", "ol", "table"}
_HEADINGS = {"h1", "h2", "h3", "h4", "h5", "h6"}

_DAY_RE = re.compile(r"(\d{1,2})\.(\d{1,2})\.(\d{2}|\d{4})\b")
_TIME_RE = re.compile(r"^(\d{1,2}):(\d{2})$")
_FILM_RE = re.compile(r"/(?:eng/Films|סרטים)/(\d+)(?:/([^/?#]*))?")
_EVENT_RE = re.compile(r"/(?:eng/Events|אירועים)/(\d+)")
_BASKET_RE = re.compile(r"/(?:eng/Basket|סל_הקניות)/(\d+)")
# A group link: `grp|fwsa|1098` on the film pages. The separator arrives
# percent-encoded (%7C) or literal, so the URL is decoded before this matches.
_GROUP_RE = re.compile(r"grp\|[a-z]+\|(\d+)")
_EDITION_EN_RE = re.compile(r"Haifa\s+(\d{1,3})(?:st|nd|rd|th)\s+International\s+Film\s+Festival", re.I)
_EDITION_HE_RE = re.compile(r"פסטיבל הסרטים[^<\n]{0,20}?ה-(\d{1,3})")


def clean_text(raw):
    """Unescape entities, drop bidi and other invisible format characters, collapse spaces."""
    if raw is None:
        return ""
    text = _html.unescape(raw)
    text = "".join(ch for ch in text if unicodedata.category(ch) != "Cf")
    return re.sub(r"\s+", " ", text).strip()


class _Lines(HTMLParser):
    """The page as a flat list of lines: (kind, text, links[(href, text)]).

    kind is the tag of the block that holds the line: h1..h6, li, or "text"
    for any other block. Class names are ignored on purpose (module docstring).
    """

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.lines = []
        self._kind = "text"
        self._buf = []
        self._links = []
        self._href = None
        self._link_text = []
        self._skip = 0
        self.meta = {}

    def _flush(self):
        text = clean_text("".join(self._buf))
        if text or self._links:
            self.lines.append((self._kind, text, self._links))
        self._buf, self._links = [], []

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag in ("script", "style", "title"):
            self._skip += 1
            return
        if tag == "meta" and attrs.get("property"):
            self.meta[attrs["property"]] = attrs.get("content")
        if tag in _BLOCKS:
            self._flush()
            if tag in _HEADINGS or tag == "li":
                self._kind = tag
            elif self._kind not in _HEADINGS and self._kind != "li":
                self._kind = "text"
        if tag == "a":
            self._href = attrs.get("href")
            self._link_text = []

    def handle_endtag(self, tag):
        if tag in ("script", "style", "title"):
            self._skip = max(0, self._skip - 1)
            return
        if tag == "a" and self._href is not None:
            self._links.append((self._href, clean_text("".join(self._link_text))))
            self._href = None
        if tag in _BLOCKS:
            self._flush()
            self._kind = "text"

    def handle_data(self, data):
        if self._skip:
            return
        self._buf.append(data)
        if self._href is not None:
            self._link_text.append(data)


def lines_of(page_html):
    parser = _Lines()
    parser.feed(page_html)
    parser.close()
    parser._flush()
    return parser.lines, parser.meta


def _path(href):
    return urllib.parse.unquote(urllib.parse.urlsplit(href).path) if href else ""


def absolute(href, site):
    """A link as an absolute URL, keeping the site's own (encoded) spelling."""
    return urllib.parse.urljoin(site + "/", href) if href else None


# --- the edition marker -----------------------------------------------------

def edition_marker(page_html):
    """The edition number the page prints about itself, or None.

    English banner: "Haifa 42nd International Film Festival". Hebrew banner:
    "פסטיבל הסרטים הבינלאומי ה-42 חיפה". A film page's label list: "Festival: 42".
    """
    lines, _ = lines_of(page_html)
    for _, text, _ in lines:
        m = _EDITION_EN_RE.search(text) or _EDITION_HE_RE.search(text)
        if m:
            return int(m.group(1))
    for kind, text, _ in lines:
        m = re.match(r"^Festival\s*:\s*(\d{1,3})$", text)
        if m:
            return int(m.group(1))
    return None


# --- the schedule -----------------------------------------------------------

def parse_day(text):
    """"Friday 25.09.26" / "יום שישי 25.09.26" -> "2026-09-25", or None."""
    m = _DAY_RE.search(text)
    if not m:
        return None
    day, month, year = int(m.group(1)), int(m.group(2)), m.group(3)
    year = int(year) + (2000 if len(year) == 2 else 0)
    if not (1 <= month <= 12 and 1 <= day <= 31):
        return None
    return "%04d-%02d-%02d" % (year, month, day)


def parse_start(text):
    m = _TIME_RE.match(text)
    if not m:
        return None
    hour, minute = int(m.group(1)), int(m.group(2))
    if hour > 29 or minute > 59:
        return None
    return "%02d:%02d" % (hour, minute)


def parse_schedule(page_html, site):
    """Every row of the schedule page, in page order.

    A row is {date, start, venue, kind: film|event, refId, heading, info,
    tags, screeningId, ticketUrl, slug}. A row the page gives no film or
    event link is still returned with kind None, so the fetch can report it
    instead of dropping it without a trace.
    """
    lines, _ = lines_of(page_html)
    rows, row = [], None
    day = venue = None

    def close():
        if row is not None:
            rows.append(row)

    for kind, text, links in lines:
        if kind == "h1" and parse_day(text):
            close()
            row, day, venue = None, parse_day(text), None
            continue
        if day is None:
            continue
        if kind == "h2":
            close()
            row, venue = None, text
            continue
        start = parse_start(text) if kind == "text" else None
        if start:
            close()
            row = {"date": day, "start": start, "venue": venue, "kind": None, "refId": None,
                   "heading": None, "info": None, "tags": [], "screeningId": None,
                   "ticketUrl": None, "slug": None}
            continue
        if row is None:
            continue
        if kind == "h3" and row["heading"] is None:
            row["heading"] = text
        elif kind == "li":
            row["tags"].append(text)
        elif kind == "text" and text and not links and row["info"] is None:
            row["info"] = text
        for href, _label in links:
            path = _path(href)
            film, event, basket = _FILM_RE.search(path), _EVENT_RE.search(path), _BASKET_RE.search(path)
            if film and row["refId"] is None:
                row["kind"], row["refId"] = "film", int(film.group(1))
                row["slug"] = film.group(2) or None
            elif event and row["refId"] is None:
                row["kind"], row["refId"] = "event", int(event.group(1))
            elif basket and row["screeningId"] is None:
                row["screeningId"] = int(basket.group(1))
                row["ticketUrl"] = absolute(href, site)
    close()
    return rows


def title_from_slug(slug, heading):
    """The title part of a schedule heading, read off the link's slug.

    The heading runs the title and the director together ("הישאר איתי מירסיני
    אריסטידו") with nothing between them, but the film link's slug is the
    title alone, with underscores for spaces ("הישאר_איתי"). When the heading
    starts with the slug's words, that prefix is the title. Otherwise the
    slug's own words are.
    """
    if not slug:
        return None
    words = clean_text(slug.replace("_", " "))
    if not words:
        return None
    if heading and heading.startswith(words):
        return heading[: len(words)]
    return words


# --- a film page ------------------------------------------------------------

_LABELS = {
    "Festival": "festival",
    "Director": "director",
    "Country/Year": "countryYear",
    "Runtime": "runtime",
    "Language": "language",
    "Subtitles": "subtitles",
}


def parse_film(page_html):
    """{title, sections[{id, name}], edition, director, country, year, runtimeMin,
    language, subtitles, synopsis, image} from an `/eng/Films/<id>` page.

    Anything the page does not print is None. A runtime is never guessed,
    because the planner reads it to decide whether two screenings clash.
    """
    lines, meta = lines_of(page_html)
    film = {k: None for k in ("title", "director", "country", "year", "runtimeMin", "language", "subtitles", "synopsis", "image")}
    film["sections"] = []
    film["edition"] = None
    film["image"] = meta.get("og:image")
    labels_end = None
    for index, (kind, text, links) in enumerate(lines):
        if kind == "h1" and film["title"] is None:
            film["title"] = text
        for href, label in links:
            group = _GROUP_RE.search(_path(href))
            if group and label:
                entry = {"id": group.group(1), "name": label}
                if entry not in film["sections"]:
                    film["sections"].append(entry)
        m = re.match(r"^([A-Za-z/ ]+?)\s*:\s*(.+)$", text) if kind == "li" else None
        if m and m.group(1) in _LABELS:
            labels_end = index
            key, value = _LABELS[m.group(1)], m.group(2).strip()
            if key == "festival":
                film["edition"] = int(value) if value.isdigit() else None
            elif key == "countryYear":
                cy = re.match(r"^(.*?)\s*((?:19|20)\d{2})$", value)
                film["country"], film["year"] = (cy.group(1) or None, int(cy.group(2))) if cy else (value, None)
            elif key == "runtime":
                rt = re.match(r"^(\d{1,3})\s*(?:minutes|min)\b", value, re.I)
                film["runtimeMin"] = int(rt.group(1)) if rt and int(rt.group(1)) > 0 else None
            else:
                film[key] = value
    if labels_end is not None:
        # The synopsis is the first real paragraph after the label list.
        for kind, text, links in lines[labels_end + 1 :]:
            if kind == "text" and len(text) >= 40 and not links:
                film["synopsis"] = text
                break
    return film


# --- selftest ---------------------------------------------------------------

def _sample(name):
    with open(os.path.join(SAMPLES, name), encoding="utf-8") as handle:
        return handle.read()


def selftest():
    site = "https://www.haifaff.co.il"
    eng, heb, film_page = _sample("schedule-eng.html"), _sample("schedule-heb.html"), _sample("film-eng-13537.html")

    assert edition_marker(eng) == 42
    assert edition_marker(heb) == 42
    assert edition_marker(film_page) == 42
    assert edition_marker("<div>Haifa 41st International Film Festival</div>") == 41
    assert edition_marker("<div>no marker here</div>") is None

    assert parse_day("Friday 25.09.26") == "2026-09-25"
    assert parse_day("יום שישי 25.09.26") == "2026-09-25"
    assert parse_day("Rapaport") is None
    assert parse_start("22:45") == "22:45"
    assert parse_start("102 Min'") is None

    rows = parse_schedule(eng, site)
    assert len(rows) == 4, rows
    first = rows[0]
    assert (first["date"], first["start"], first["venue"]) == ("2026-09-25", "11:15", "Rapaport"), first
    assert (first["kind"], first["refId"], first["screeningId"]) == ("film", 13497, 28040), first
    assert first["ticketUrl"] == "https://www.haifaff.co.il/eng/Basket/28040"
    assert first["heading"] == "Hold onto Me Myrsini Aristidou"
    assert first["info"] == "102 Min', Greek, Subtitles in Hebrew, English"
    assert first["tags"] == []
    assert rows[1]["tags"] == ["Carmel International Competition"], rows[1]
    event = rows[3]
    assert (event["date"], event["venue"], event["kind"], event["refId"]) == ("2026-09-26", "Auditorium", "event", 13846), event
    assert event["screeningId"] == 27885

    he_rows = parse_schedule(heb, site)
    assert [(r["refId"], r["screeningId"]) for r in he_rows] == [(13497, 28040), (13514, 28152), (13544, 28022)], he_rows
    assert he_rows[0]["venue"] == "רפפורט"
    # The heading runs title and director together; the slug separates them.
    assert title_from_slug(he_rows[0]["slug"], he_rows[0]["heading"]) == "הישאר איתי"
    assert title_from_slug(he_rows[2]["slug"], he_rows[2]["heading"]) == "סיפור על משפחה"
    assert title_from_slug(None, "x") is None

    film = parse_film(film_page)
    assert film["title"] == "Adult Supervision"
    assert film["sections"] == [{"id": "1098", "name": "Golden Anchor Competition"}], film["sections"]
    assert film["edition"] == 42
    assert (film["director"], film["country"], film["year"]) == ("Alex Schulman", "Sweden", 2026), film
    assert film["runtimeMin"] == 108
    assert (film["language"], film["subtitles"]) == ("Swedish", "Hebrew, English")
    assert film["synopsis"].startswith("When three fathers chaperone")
    # Unknown stays unknown: the reconstructed page carries no og:image.
    assert film["image"] is None
    bare = parse_film("<h1>X</h1><ul><li><strong>Runtime</strong>: about two hours</li></ul>")
    assert bare["runtimeMin"] is None and bare["sections"] == [] and bare["edition"] is None

    print("haifa parse selftest: ok")


if __name__ == "__main__":
    if sys.argv[1:] != ["--selftest"]:
        sys.exit("usage: parse.py --selftest")
    selftest()
