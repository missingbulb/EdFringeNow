"""Pure transforms that turn abugoshfestival.co.il's WordPress pages into programme records.

No network and no filesystem, except that `--selftest` reads the committed
samples/. `fetch.py` fetches the pages and passes their text in here.

What the site carries, and where:

  * the Concert Schedule page (`/en/לוח-קונצרטים/`, Hebrew at `/לוח-קונצרטים/`)
    lists every ticketed concert as a JetEngine listing card
    (`jet-listing-grid__item`, `data-post-id`): a link to the concert's own
    page, a picture, a label ("Church Concert No. 1"), a day/month ("30/9"),
    a start time, the place ("Abu Gosh | Kiryat Yearim Church", or "Tel Aviv
    Museum of Art"), the title in an h1 and a blurb in a p. The page heading
    carries the year ("Concerts Board 2026", "לוח קונצרטים 2026"); the cards
    carry none;
  * the Outdoor Performances page (`/en/outside/`, Hebrew `/outside/`) has the
    same cards, with the place (a spot at the festival's church) before the
    date and one or more time ranges ("10:00–10:45 | 16:15–16:50");
  * each card's own page prints the price ("Price: 210 NIS"), links the
    Smarticket basket (`agfestival.smarticket.co.il/...?id=<n>`), states the
    running time ("Concert duration: Approximately 75 minutes") and describes
    the concert under an "An Insight into ..." heading. A free outdoor page
    says "Free admission" instead of a price;
  * the Hebrew pages use the same URL slugs as the English ones, so a card
    pairs with its Hebrew twin by slug.

The samples are the fetched pages with their <script>, <style>, <svg> and
<head> contents removed (the parser reads none of them), captured on
2026-09-27.
"""

import html as _html
import os
import re
import sys
import urllib.parse

HERE = os.path.dirname(os.path.abspath(__file__))
SAMPLES = os.path.join(HERE, "samples")

CARD_SPLIT = re.compile(r'<div class="jet-listing-grid__item ')
DAY_MONTH = re.compile(r"^(\d{1,2})/(\d{1,2})$")
TIME = re.compile(r"(\d{1,2}):(\d{2})")
YEAR_MARKER = re.compile(r"(?:Concerts Board|לוח קונצרטים)\s+(20\d\d)")


def _text(fragment):
    """A fragment's visible text, whitespace collapsed."""
    return re.sub(r"\s+", " ", _html.unescape(re.sub(r"<[^>]+>", " ", fragment))).strip()


def _tokens(fragment):
    """Each run of text between tags, in order, blanks dropped."""
    return [t for t in (re.sub(r"\s+", " ", _html.unescape(part)).strip() for part in re.split(r"<[^>]+>", fragment)) if t]


def year_marker(page):
    """The year the schedule's heading prints ("Concerts Board 2026"), or None."""
    body = page[page.find("<body"):] if "<body" in page else page
    found = YEAR_MARKER.search(_text(body))
    return int(found.group(1)) if found else None


def slug_of(url):
    """The page's last path segment, percent-decoded: the key the two languages share."""
    path = urllib.parse.urlsplit(url).path.rstrip("/")
    return urllib.parse.unquote(path.rsplit("/", 1)[-1]).lower()


def parse_times(text):
    """"10:00–10:45 | 16:15–16:50" -> [{start, end}]; "11:00" -> [{start: "11:00", end: None}]."""
    slots = []
    for part in text.split("|"):
        found = ["%02d:%s" % (int(h), m) for h, m in TIME.findall(part)]
        if found:
            slots.append({"start": found[0], "end": found[1] if len(found) > 1 else None})
    return slots


def parse_listing(page):
    """Every listing card on a schedule page, in page order.

    Returns [{postId, url, slug, image, label, dayMonth, times[], place[], title, blurb}].
    `label` is the card's own name ("Church Concert No. 1"), None on the outdoor
    cards, whose pre-date line is their place instead. `place` keeps the page's
    parts ("Abu Gosh", "Kiryat Yearim Church") without the separator.
    """
    cards = []
    for chunk in CARD_SPLIT.split(page)[1:]:
        post_id = re.search(r'data-post-id="(\d+)"', chunk)
        link = re.search(r'<a [^>]*href="([^"]+)"', chunk)
        if not post_id or not link:
            continue
        body = chunk[link.end():chunk.find("</a>", link.end())]
        image = re.search(r'<img [^>]*src="([^"]+)"', body)
        title = re.search(r"<h1[^>]*>(.*?)</h1>", body, re.S)
        blurb = re.search(r"<p[^>]*>(.*?)</p>", body, re.S)
        tokens = _tokens(body)
        at = next((i for i, t in enumerate(tokens) if DAY_MONTH.match(t)), None)
        if at is None or title is None or at + 1 >= len(tokens):
            continue
        title_text = _text(title.group(1))
        before = tokens[:at]
        after_time = tokens[at + 2:]
        place = after_time[:after_time.index(title_text)] if title_text in after_time else []
        place = [p for p in place if p != "|"]
        if place:
            label = before[-1] if before else None
        else:
            label, place = None, before[-1:]
        url = _html.unescape(link.group(1))
        cards.append({
            "postId": int(post_id.group(1)),
            "url": url,
            "slug": slug_of(url),
            "image": _html.unescape(image.group(1)) if image else None,
            "label": label,
            "dayMonth": tokens[at],
            "times": parse_times(tokens[at + 1]),
            "place": place,
            "title": title_text,
            "blurb": _text(blurb.group(1)) if blurb else None,
        })
    return cards


def iso_date(day_month, year):
    day, month = DAY_MONTH.match(day_month).groups()
    return "%04d-%02d-%02d" % (year, int(month), int(day))


def parse_detail(page):
    """A concert's own page -> {price, free, ticketUrl, durationMin, description}.

    `price` is the whole shekels printed ("Price: 210 NIS"), None when the page
    prints none; `free` is True only when the page says "Free admission"
    (None otherwise: a priced page is not a claim about free entry beyond its
    price). The description is the paragraphs under "An Insight into ...",
    up to the first bold sub-heading ("Programme"), or None.
    """
    body = page[page.find("<body"):] if "<body" in page else page
    text = _text(body)
    price = re.search(r"Price:\s*:?\s*(\d+)\s*NIS", text)
    ticket = re.search(r'href="(https://agfestival\.smarticket\.co\.il/[^"]*\?id=\d+)"', body)
    duration = re.search(r"duration:\s*approximately\s+(\d+)\s*minutes", text, re.I)
    description = None
    insight = re.search(r"<h1[^>]*>\s*An Insight into.*?</h1>", body, re.S)
    if insight:
        # The description is the dynamic field right under the heading (empty
        # on the outdoor pages); the performers and the footer come later.
        field = re.search(r'jet-listing-dynamic-field__content"\s*>(.*?)</div>', body[insight.end():], re.S)
        block = field.group(1) if field else ""
        paragraphs = []
        for p in re.finditer(r"<p[^>]*>(.*?)</p>", block, re.S):
            inner = p.group(1).strip()
            if re.fullmatch(r"<(b|strong)>.*</\1>", inner, re.S):
                break
            para = _text(inner)
            if para:
                paragraphs.append(para)
        description = "\n\n".join(paragraphs) or None
    return {
        "price": int(price.group(1)) if price else None,
        "free": True if re.search(r"Free admission", text) else None,
        "ticketUrl": _html.unescape(ticket.group(1)) if ticket else None,
        "durationMin": int(duration.group(1)) if duration else None,
        "description": description,
    }


def _sample(name):
    with open(os.path.join(SAMPLES, name), encoding="utf-8") as handle:
        return handle.read()


def selftest():
    en, he = _sample("schedule-en.html"), _sample("schedule-he.html")
    out_en, out_he = _sample("outdoor-en.html"), _sample("outdoor-he.html")

    assert year_marker(en) == 2026 and year_marker(he) == 2026
    assert year_marker("<body><h2>Concerts Board 2027</h2></body>") == 2027
    assert year_marker(out_en) is None

    assert parse_times("11:00") == [{"start": "11:00", "end": None}]
    assert parse_times("10:00–10:45 | 16:15–16:50") == [
        {"start": "10:00", "end": "10:45"}, {"start": "16:15", "end": "16:50"}]
    assert parse_times("  12:45-13:15") == [{"start": "12:45", "end": "13:15"}]
    assert iso_date("29/9", 2026) == "2026-09-29" and iso_date("3/10", 2026) == "2026-10-03"

    cards = parse_listing(en)
    assert len(cards) == 17, len(cards)
    first = cards[0]
    assert first["postId"] == 9079 and first["label"] == "Museum Concert No. 1", first
    assert (first["dayMonth"], first["times"], first["place"]) == ("29/9", [{"start": "11:00", "end": None}], ["Tel Aviv Museum of Art"]), first
    assert first["title"] == "Fauré’s Requiem"
    assert first["image"] == "https://abugoshfestival.co.il/wp-content/uploads/2026/05/hero_sukot_2026_1-1024x497.webp"
    assert first["slug"] == "קונצרט-מוזיאון-מס-1", first["slug"]
    church = next(c for c in cards if c["label"] == "Church Concert No. 9")
    assert church["place"] == ["Abu Gosh", "Kiryat Yearim Church"] and church["dayMonth"] == "3/10"
    crypt = [c for c in cards if c["place"][-1:] == ["The Crypt"]]
    assert len(crypt) == 4
    assert all(c["image"] for c in cards)

    he_cards = parse_listing(he)
    # Same slugs, not the same order: the Hebrew page sorts two cards differently.
    assert sorted(c["slug"] for c in he_cards) == sorted(c["slug"] for c in cards)
    assert he_cards[0]["title"] == "הרקוויאם של פורה" and he_cards[0]["place"] == ["מוזיאון ת״א"]

    outdoor = parse_listing(out_en)
    assert len(outdoor) == 12, len(outdoor)
    assert outdoor[0]["label"] is None and outdoor[0]["place"] == ["The Café Terrace"], outdoor[0]
    assert outdoor[0]["times"] == [{"start": "10:00", "end": "10:45"}, {"start": "16:15", "end": "16:50"}]
    assert outdoor[0]["title"] == "“Coffee, Jazz & Israeli Song”"
    assert outdoor[0]["image"].endswith("-1024x497.webp")
    out_he_cards = parse_listing(out_he)
    assert {c["slug"] for c in out_he_cards} == {c["slug"] for c in outdoor}

    concert = parse_detail(_sample("detail-church-2.html"))
    assert concert["price"] == 210 and concert["free"] is None, concert
    assert concert["ticketUrl"].startswith("https://agfestival.smarticket.co.il/") and concert["ticketUrl"].endswith("?id=173")
    assert concert["durationMin"] == 75
    assert concert["description"].startswith("A moving and uplifting concert")
    assert "Programme" not in concert["description"] and "Amazing Grace" in concert["description"]

    free = parse_detail(_sample("detail-outdoor-1.html"))
    assert free["price"] is None and free["free"] is True and free["ticketUrl"] is None, free
    assert free["durationMin"] == 30 and free["description"] is None, free

    assert parse_detail("<body><p>nothing</p></body>") == {
        "price": None, "free": None, "ticketUrl": None, "durationMin": None, "description": None}
    print("abugosh-site parse selftest ok")


if __name__ == "__main__":
    if sys.argv[1:] == ["--selftest"]:
        selftest()
    else:
        sys.exit("usage: parse.py --selftest")
