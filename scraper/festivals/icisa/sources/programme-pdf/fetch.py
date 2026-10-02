#!/usr/bin/env python3
"""Fetch ICISA's programme PDF for one edition into its raw folder.

Run by the festival update, or by hand:

    python3 scraper/festivals/icisa/sources/programme-pdf/fetch.py --edition 2026

Writes `data/festivals/icisa/<edition>/programme-pdf/` (`programme.json` +
`manifest.json`) and nothing else. The programme page links the current PDF
(its address changes with each revision); the PDF is cut into cells by the
shared pdf_grid platform and read by parse.py. If the PDF's day headings are
not in the edition's year, or any session falls outside the edition, nothing is
written.
"""

import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(HERE))))
sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(HERE))), "platforms"))
import common
import parse as iparse
import pdf_grid
import registry

FESTIVAL_DIR = os.path.dirname(os.path.dirname(HERE))
SOURCE_ID = "programme-pdf"
FETCHER_VERSION = 1
SITE = "https://www.icisa2026.com/"
PROGRAMME_PAGE = "https://www.icisa2026.com/program"
_PDF = re.compile(r'href="(https://www\.icisa2026\.com/_files/ugd/[0-9a-f_]+\.pdf)"')


def main():
    args = common.parse_args(__doc__)
    festival = registry.load(FESTIVAL_DIR)
    edition = registry.edition(festival, args.edition)
    page = common.get(PROGRAMME_PAGE, as_json=False)
    links = list(dict.fromkeys(_PDF.findall(page)))
    if len(links) != 1:
        raise common.FetchRefused("the programme page links %d programme PDFs, not one: %s" % (len(links), links))
    pdf = links[0]
    sessions = iparse.sessions([pdf_grid.cells(p) for p in pdf_grid.extract(common.get_bytes(pdf))])
    years = {s["date"][:4] for s in sessions}
    if years != {edition["id"]}:
        raise common.FetchRefused("the programme is dated %s, not edition %s; nothing written" % (sorted(years), edition["id"]))
    common.guard_dates(edition, [s["date"] for s in sessions])
    common.write_raw(
        festival, edition["id"], SOURCE_ID,
        {"programme.json": {"site": SITE, "programmePage": PROGRAMME_PAGE, "pdf": pdf, "sessions": sessions}},
        fetcher="scraper/festivals/icisa/sources/programme-pdf/fetch.py",
        fetcher_version=FETCHER_VERSION,
        urls=[PROGRAMME_PAGE, pdf],
        notes="One record per cell of the programme PDF's daily grids (pdf_grid): its day, the time rows "
              "it spans as printed and their start and end, the halls it lies across as the header "
              "names them, and its lines in paragraphs, each marked bold or not and whether it fills "
              "the cell's width.",
    )
    print("%d cells" % len(sessions))


if __name__ == "__main__":
    main()
