#!/usr/bin/env python3
"""Forms Wizard: the Israeli conference-site builder (`https://<event>.forms-wizard.biz/`) several medical conferences publish on.

A conference's site is one server-rendered page of sections. Its agenda
section holds a tab per day (`id="agenda-<agenda>-day-<YYYY-MM-DD>"`) and in
each an agenda item per row of the programme:

    <div class="agenda-item card …" id="agenda-item-<id>">
      <div class="agenda-item-thumbnail …"><i class="fa fa-fw fa-<icon> …"></i></div>
      <h5 class="agenda-item-title …"> <title> </h5>
      <p class="agenda-item-tags …">
        <span class="agenda-time-wrapper …"><i class="fa fa-clock-o"></i> <span dir="ltr">09:00 - 10:45</span></span>
        <span …><i class="fa fa-user-circle-o"></i> <people></span>
        <span …><i class="fa fa-map-marker"></i> <place></span>
      </p>
      <div class="agenda-item-description …"><div class="cke-content"> <free HTML> </div></div>

Every tag is optional, and the organiser types the time into the title instead
when the item has none. This module reads the items in the platform's own
words: the description's tables as rows of cells of lines, any other text as
one row of one cell. What an item is (a session, a break) is the festival's
adapter's call. Parsing is pure; `run` is the hand-run fetcher's entry point.

    python3 scraper/festivals/platforms/forms_wizard.py --selftest
"""

import html
import re
import sys

FETCHER_VERSION = 1

_DAY = re.compile(r'<div class="agenda-day tab-pane[^"]*" id="agenda-\d+-day-(\d{4}-\d{2}-\d{2})">')
_ITEM = re.compile(r'<div class="agenda-item card[^"]*"[^>]*\bid="agenda-item-(\d+)"')
_SECTION_END = re.compile(r"</section>")
_ICON = re.compile(r'agenda-item-thumbnail[^>]*>\s*<i class="([^"]*)"')
_TITLE = re.compile(r'<h5 class="agenda-item-title[^"]*">(.*?)</h5>', re.S)
_TIME = re.compile(r'agenda-time-wrapper[^>]*>.*?<span dir="ltr">(.*?)</span>', re.S)
_PEOPLE = re.compile(r'<i class="fa fa-user-circle-o"></i>(.*?)</span>', re.S)
_PLACE = re.compile(r'<i class="fa fa-map-marker"></i>(.*?)</span>', re.S)
_DESCRIPTION = re.compile(r'<div class="agenda-item-description[^"]*"[^>]*>\s*<div class="cke-content">(.*?)(?:<a class="agenda-description-collapse-button|$)', re.S)
_TABLE = re.compile(r"<table\b.*?</table>", re.S | re.I)
_ROW = re.compile(r"<tr\b.*?</tr>", re.S | re.I)
_CELL = re.compile(r"<t[dh]\b.*?</t[dh]>", re.S | re.I)
_BREAK = re.compile(r"</(p|div|li|h[1-6])\s*>|<br\s*/?>", re.I)
_TAG = re.compile(r"<[^>]+>")
_ICON_NOISE = {"fa", "fa-fw", "fa-3x", "d-block", "mx-auto"}


def lines_of(markup):
    """HTML -> its non-empty lines of text, whitespace collapsed."""
    text = html.unescape(_TAG.sub("", _BREAK.sub("\n", markup)))
    lines = (re.sub(r"\s+", " ", line).strip() for line in text.split("\n"))
    return [line for line in lines if line]


def _text(markup):
    return " ".join(lines_of(markup)) or None


def description(markup):
    """An item's description HTML -> [[[line]]]: its tables' rows of cells, then any other text as one row of one cell."""
    rows = []
    for table in _TABLE.findall(markup):
        for row in _ROW.findall(table):
            cells = [lines_of(cell) for cell in _CELL.findall(row)]
            if any(cells):
                rows.append(cells)
    rest = lines_of(_TABLE.sub("\n", markup))
    if rest:
        rows.append([rest])
    return rows


def _item(day, item_id, markup):
    icon = _ICON.search(markup)
    icons = [name for name in icon.group(1).split() if name not in _ICON_NOISE] if icon else []
    title, time, people, place = (_TITLE.search(markup), _TIME.search(markup),
                                  _PEOPLE.search(markup), _PLACE.search(markup))
    body = _DESCRIPTION.search(markup)
    return {
        "id": int(item_id),
        "date": day,
        "icon": icons[0][3:] if icons and icons[0].startswith("fa-") else None,
        "title": _text(title.group(1)) if title else None,
        "time": _text(time.group(1)) if time else None,
        "people": _text(people.group(1)) if people else None,
        "place": _text(place.group(1)) if place else None,
        "description": description(body.group(1)) if body else [],
    }


def agenda(page):
    """The site's page -> [item], in the agenda's order (see the module docstring)."""
    days = list(_DAY.finditer(page))
    items = []
    for n, day in enumerate(days):
        end = days[n + 1].start() if n + 1 < len(days) else len(page)
        closing = _SECTION_END.search(page, day.end(), end)
        pane = page[day.end():closing.start() if closing else end]
        starts = list(_ITEM.finditer(pane))
        for k, start in enumerate(starts):
            stop = starts[k + 1].start() if k + 1 < len(starts) else len(pane)
            items.append(_item(day.group(1), start.group(1), pane[start.start():stop]))
    return items


def run(festival_dir, site, source_id, fetcher):
    """A festival's `fetch.py --edition <id>`: read the live site's agenda, keep the edition's days, guard, write raw.

    `site` may carry `{edition}`, for a conference that opens a site per year.
    """
    import os
    sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    import common
    import registry

    args = common.parse_args("Fetch a Forms Wizard conference site's agenda into its raw folder.")
    festival = registry.load(festival_dir)
    edition = registry.edition(festival, args.edition)
    site = site.format(edition=edition["id"])
    items = agenda(common.get(site, as_json=False))
    if not items:
        raise common.FetchRefused("%s has no agenda items; nothing written" % site)
    kept = [item for item in items if edition["first"] <= item["date"] <= edition["last"]]
    if not kept:
        common.not_ready("%s's agenda has no day in edition %s (it lists %s)"
                         % (site, edition["id"], sorted({i["date"] for i in items})))
    common.guard_dates(edition, [item["date"] for item in kept])
    common.write_raw(
        festival, edition["id"], source_id, {"programme.json": {"site": site, "items": kept}},
        fetcher=fetcher, fetcher_version=FETCHER_VERSION,
        urls=[site],
        notes="The agenda section's items on the edition's days, each with its icon, title, time, "
              "people, place and description as the site prints them; a description's tables are rows "
              "of cells of lines (scraper/festivals/platforms/forms_wizard.py).",
    )
    print("%d agenda items" % len(kept))


def selftest():
    # Shapes copied from emergencymedicine-2026.forms-wizard.biz, 2026-10-02, trimmed.
    page = '''<section class='website-section agenda-section'>
    <ul id="agenda-809-days-nav"><li class="nav-item" id="agenda-809-day-2026-10-21-tab"></li></ul>
    <div class="tab-content"> <div class="agenda-day tab-pane pt-3 active" id="agenda-809-day-2026-10-21">
    <div class="agenda-item card px-3 py-2 mb-3" id="agenda-item-16813" data-track="All Tracks">
      <div class="agenda-item-thumbnail col-3"> <i class="fa fa-fw fa-group fa-3x d-block mx-auto "></i> </div>
      <h5 class="agenda-item-title mb-0"> מליאת בוקר - Plenary Session </h5>
      <p class="agenda-item-tags text-muted mb-2 text-sm"> <span class="d-block mr-3">
        <span class="agenda-time-wrapper d-inline-block"><i class="fa fa-clock-o"></i> <span dir="ltr">09:00 - 10:45</span></span> </span>
        <span class="d-block mr-3"><i class="fa fa-user-circle-o"></i> Moderators: Dr. A, Dr. B</span>
        <span class="d-block mr-3"><i class="fa fa-map-marker"></i> Hall A</span> </p>
      <div class="agenda-item-description text-muted collapse" id="agenda-item-16813-description-all"> <div class="cke-content">
        <table class="Table"><tbody><tr><td><p><strong><span>09:00 - 09:15</span></strong></p></td>
        <td><p><strong>Greetings</strong></p><p><span><strong>Dr. A</strong>, <em>Chair</em></span><br> <span>Dr. B &amp; C</span></p></td></tr>
        <tr><td><p> </p></td><td><p> </p></td></tr></tbody></table><p>Posters follow.</p>
      </div> </div> <p> <a class="agenda-description-collapse-button" role="button" href=""> More Details </a> </p> </div>
    <div class="agenda-item card px-3 py-2 mb-3" id="agenda-item-16818" data-track="All Tracks">
      <div class="agenda-item-thumbnail col-3"> <i class="fa fa-fw fa-coffee fa-3x d-block mx-auto "></i> </div>
      <h5 class="agenda-item-title mb-0"> מושבים מקבילים - 11:15-13:00 - Parallel Session </h5>
      <p class="agenda-item-tags"> <span class="d-block mr-3"> </span> </p>
      <div class="agenda-item-description text-muted mb-2 text-sm " id="x"> <div class="cke-content"> </div> </div> </div>
    </div></div> </section><section><div class="agenda-item card" id="agenda-item-1"></div></section>'''
    items = agenda(page)
    assert [i["id"] for i in items] == [16813, 16818], items
    plenary, parallel = items
    assert (plenary["date"], plenary["icon"], plenary["title"], plenary["time"]) == (
        "2026-10-21", "group", "מליאת בוקר - Plenary Session", "09:00 - 10:45"), plenary
    assert (plenary["people"], plenary["place"]) == ("Moderators: Dr. A, Dr. B", "Hall A"), plenary
    assert plenary["description"] == [[["09:00 - 09:15"], ["Greetings", "Dr. A, Chair", "Dr. B & C"]],
                                      [["Posters follow."]]], plenary["description"]
    assert (parallel["icon"], parallel["time"], parallel["people"], parallel["place"], parallel["description"]) == (
        "coffee", None, None, None, []), parallel
    assert agenda("<html></html>") == []
    print("forms wizard platform selftest: ok")


if __name__ == "__main__":
    if sys.argv[1:] != ["--selftest"]:
        sys.exit("usage: forms_wizard.py --selftest")
    selftest()
