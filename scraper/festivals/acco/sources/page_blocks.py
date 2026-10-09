"""A page's markup as a flat run of text blocks, for the Acco parsers.

Both Acco programmes are hand-laid pages rather than an API: the theatre centre's
is one WordPress/Elementor page, the street programme one static HTML file. What
the parsers need from either is the visible text in reading order, one block per
line of the page, with the links each line carries, and where the page's
sections and cards open and close. That is all this module produces, so a parser
keys off the page's words (a date heading, an `HH:MM title` line) rather than
off class names a page rebuild would change.

Pure: markup in, tokens out.
"""

import html.parser
import re

# Elements that end one line of text and start the next.
_BREAKS = {
    "p", "div", "li", "br", "tr", "td", "th", "dt", "dd",
    "h1", "h2", "h3", "h4", "h5", "h6", "header", "footer", "figure", "figcaption",
}
# Containers whose boundaries a parser needs to see: a section groups cards
# under its heading, an article is one card.
_CONTAINERS = {"section", "article"}
_SKIP = {"script", "style", "noscript", "template", "svg"}
_HEADINGS = {"h1", "h2", "h3", "h4"}


class _Blocks(html.parser.HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.tokens = []
        self.text = []
        self.hrefs = []
        self.tag = None
        self.skip = 0

    def flush(self):
        text = re.sub(r"\s+", " ", "".join(self.text)).strip()
        # Invisible bidi marks survive a strip() and make equal lines unequal.
        text = re.sub(r"[‎‏‪-‮⁦-⁩]", "", text).strip()
        if text:
            self.tokens.append({"kind": "text", "text": text, "hrefs": self.hrefs, "tag": self.tag})
        self.text, self.hrefs, self.tag = [], [], None

    def handle_starttag(self, tag, attrs):
        if tag in _SKIP:
            self.skip += 1
            return
        if tag in _CONTAINERS:
            self.flush()
            self.tokens.append({"kind": "start", "tag": tag})
        elif tag in _BREAKS:
            self.flush()
            self.tag = tag if tag in _HEADINGS else None
        if tag == "a":
            href = dict(attrs).get("href")
            if href:
                # Kept on the line it sits in, and also as a token of its own,
                # so a link with no text (a poster image) is still seen.
                self.hrefs.append(href)
                self.tokens.append({"kind": "link", "href": href})
        if tag == "meta":
            # The street page states its dates in its description meta; a meta
            # is the one place visible-text parsing would otherwise miss it.
            content = dict(attrs).get("content")
            if content:
                self.tokens.append({"kind": "text", "text": content.strip(), "hrefs": [], "tag": "meta"})

    def handle_endtag(self, tag):
        if tag in _SKIP:
            self.skip = max(0, self.skip - 1)
            return
        if tag in _CONTAINERS:
            self.flush()
            self.tokens.append({"kind": "end", "tag": tag})
        elif tag in _BREAKS:
            self.flush()

    def handle_data(self, data):
        if not self.skip:
            self.text.append(data)


def blocks(markup):
    """[{kind: text|link|start|end, ...}] in document order."""
    parser = _Blocks()
    parser.feed(markup)
    parser.close()
    parser.flush()
    return parser.tokens


def selftest():
    tokens = blocks(
        '<meta name="description" content="28–30.9.26"><script>x = "<p>no</p>"</script>'
        '<section><h2>ראש</h2><article><p>א‏ <a href="https://t.test/1">ב</a></p><br>ג</article></section>'
    )
    texts = [(t["text"], t["tag"], t["hrefs"]) for t in tokens if t["kind"] == "text"]
    assert texts == [("28–30.9.26", "meta", []), ("ראש", "h2", []), ("א ב", None, ["https://t.test/1"]), ("ג", None, [])], texts
    kinds = [(t["kind"], t.get("tag") or t.get("href")) for t in tokens if t["kind"] != "text"]
    assert kinds == [("start", "section"), ("start", "article"), ("link", "https://t.test/1"),
                     ("end", "article"), ("end", "section")], kinds
