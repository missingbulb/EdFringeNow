#!/usr/bin/env python3
"""Fetch the Electricity & Energy convention's frame programme PDF for one edition into its raw folder.

Run by the festival update, or by hand:

    python3 scraper/festivals/seeei/sources/programme-pdf/fetch.py --edition 2026

Writes `data/festivals/seeei-electricity-energy/<edition>/programme-pdf/`
(`programme.json` + `manifest.json`) and nothing else. The programme page
offers several programmes; the "Frame Program" button links the PDF with every
session, its slot and its room (the "Halls Program" is a picture with no text).
The PDF is cut into cells by the shared pdf_grid platform and read by parse.py.
If its day headings are not in the edition's year, or any session falls outside
the edition, nothing is written.
"""

import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(HERE))))
sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(HERE))), "platforms"))
import common
import parse as sparse
import pdf_grid
import registry

FESTIVAL_DIR = os.path.dirname(os.path.dirname(HERE))
SOURCE_ID = "programme-pdf"
FETCHER_VERSION = 1
SITE = "https://www.electricity2026.com/en"
# "תכנית", the programme page.
PROGRAMME_PAGE = "https://www.electricity2026.com/en/%D7%AA%D7%9B%D7%A0%D7%99%D7%AA"
_FRAME = re.compile(r'>Frame<br[^>]*>\s*Program<.*?href="(https://www\.electricity2026\.com/en/_files/ugd/[0-9a-f_]+\.pdf)"', re.S)


def main():
    args = common.parse_args(__doc__)
    festival = registry.load(FESTIVAL_DIR)
    edition = registry.edition(festival, args.edition)
    page = common.get(PROGRAMME_PAGE, as_json=False)
    found = _FRAME.search(page)
    if not found:
        raise common.FetchRefused("the programme page links no Frame Program PDF; nothing written")
    pdf = found.group(1)
    sessions, unplaced = sparse.sessions([pdf_grid.cells(p) for p in pdf_grid.extract(common.get_bytes(pdf))])
    years = {s["date"][:4] for s in sessions}
    if years != {edition["id"]}:
        raise common.FetchRefused("the programme is dated %s, not edition %s; nothing written" % (sorted(years), edition["id"]))
    common.guard_dates(edition, [s["date"] for s in sessions])
    common.write_raw(
        festival, edition["id"], SOURCE_ID,
        {"programme.json": {"site": SITE, "programmePage": PROGRAMME_PAGE, "pdf": pdf,
                            "sessions": sessions, "unplaced": unplaced}},
        fetcher="scraper/festivals/seeei/sources/programme-pdf/fetch.py",
        fetcher_version=FETCHER_VERSION,
        urls=[PROGRAMME_PAGE, pdf],
        notes="One record per session cell of the frame programme PDF (pdf_grid): its day, its slot's "
              "start as printed and as HH:MM, the start of the day's next slot as its end (null for "
              "the day's last), and its lines in paragraphs, each marked bold or not and whether it "
              "fills the cell's width. `unplaced` is the text of cells in no time row (the track legend).",
    )
    print("%d sessions" % len(sessions))


if __name__ == "__main__":
    main()
