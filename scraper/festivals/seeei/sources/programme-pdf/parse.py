#!/usr/bin/env python3
"""Pure parsing of SEEEI's Electricity & Energy "frame programme" PDF, once pdf_grid has cut it into cells.

The programme is a Word table exported to PDF: a day heading row ("Tuesday,
November 10th, 2026"), then one row per time slot with its start time in the
right-hand column ("15:30") and, to its left, as many cells as the slot has
parallel sessions (one for a plenary or a break, seven for the WAM/WPM/TAM/TPM
tracks). Each session cell names itself (its code, "WAM1" or "Plenary Session
1", its chair, its title, its talks) and ends with the room it is in
("Herods Boutique, Kings AB", "Dan Eilat – Coral"). A row's slot ends where
the next row of the same day starts; the day's last slot has no printed end.
A page may begin by continuing the previous page's day without repeating its
heading; the reprinted heading above that page's grid is outside the table and
is not read. Below the last day, a legend of tracks and their chairs sits in no
time row and is not a session.

Each session keeps its lines in paragraphs, marked bold or not and whether
they fill the cell's width; naming them is the adapter's.

    python3 scraper/festivals/seeei/sources/programme-pdf/parse.py --selftest
"""

import json
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
SAMPLES = os.path.join(HERE, "samples")
sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(HERE))), "platforms"))
import pdf_grid

_DAY = re.compile(r"^(?:Mon|Tues|Wednes|Thurs|Fri|Satur|Sun)day,\s*([A-Za-z]+)\s+(\d{1,2})(?:st|nd|rd|th)?,\s*(\d{4})$")
_TIME = re.compile(r"^(\d{1,2}):\s?(\d{2})$")
_MONTHS = {m: n for n, m in enumerate(("january", "february", "march", "april", "may", "june", "july", "august",
                                        "september", "october", "november", "december"), 1)}


def _text(cell):
    return " ".join(line["text"] for line in cell["lines"]).strip()


def sessions(pages):
    """[cells of each page] -> ([{date, start, end, timeText, paragraphs}], [unplaced cell texts]).

    Sessions come in slot order, left to right within a slot.
    """
    rows, unplaced, day = [], [], None
    for cells in pages:
        boxed = [c for c in cells if c["box"] is not None]
        days, times, rest = [], [], []
        for cell in boxed:
            text = _text(cell)
            if _DAY.match(text):
                m = _DAY.match(text)
                days.append((cell["box"][1], "%s-%02d-%02d" % (m.group(3), _MONTHS[m.group(1).lower()], int(m.group(2)))))
            elif _TIME.match(text):
                times.append(cell)
            else:
                rest.append(cell)
        placed = set()
        for slot in sorted(times, key=lambda c: c["box"][1]):
            here = [d for t, d in days if t <= slot["box"][1]]
            slot_day = here[-1] if here else day
            if slot_day is None:
                raise ValueError("time %r comes before any day heading" % _text(slot))
            m = _TIME.match(_text(slot))
            members = [c for c in rest if c["box"][2] <= slot["box"][0] + pdf_grid.REACH
                       and pdf_grid.overlap(c["box"][1], c["box"][3], slot["box"][1], slot["box"][3]) > 0.5]
            for cell in sorted(members, key=lambda c: c["box"][0]):
                placed.add(id(cell))
                rows.append({"date": slot_day, "start": "%02d:%s" % (int(m.group(1)), m.group(2)),
                             "timeText": _text(slot), "paragraphs": pdf_grid.paragraphs(cell)})
        unplaced += [_text(c) for c in rest if id(c) not in placed]
        if days:
            day = days[-1][1]
    # A slot ends where the day's next slot starts.
    starts = sorted({(r["date"], r["start"]) for r in rows})
    for row in rows:
        later = [s for d, s in starts if d == row["date"] and s > row["start"]]
        row["end"] = later[0] if later else None
    return rows, unplaced


def selftest():
    with open(os.path.join(SAMPLES, "programme-cells.json"), encoding="utf-8") as handle:
        pages = json.load(handle)
    rows, unplaced = sessions(pages)
    assert len(rows) == 70, len(rows)
    assert sorted({r["date"] for r in rows}) == ["2026-11-10", "2026-11-11", "2026-11-12", "2026-11-13"]
    first = rows[0]
    assert (first["date"], first["start"], first["end"]) == ("2026-11-10", "14:00", "15:30"), first
    assert first["paragraphs"] == [[{"text": "Opening of Registration", "bold": True, "full": False}]], first
    workshop = rows[1]
    assert (workshop["start"], workshop["end"]) == ("15:30", "17:00")
    assert [line["text"] for p in workshop["paragraphs"] for line in p] == [
        "Workshop A", "Energy Storage Technologies,", "Management and Maintenance", "Chair: Ido Karbol",
        "Herods Boutique, Kings AB"], workshop
    # Seven parallel tracks, left to right.
    wam = [r for r in rows if r["date"] == "2026-11-11" and r["start"] == "11:50"]
    assert [r["paragraphs"][0][0]["text"] for r in wam] == ["WAM1", "WAM2", "WAM3", "WAM4", "WAM5", "WAM6", "WAM 7-1"], wam
    # "11: 00" as printed; the page-3 award ceremony continues Thursday.
    assert any(r["timeText"] == "11: 00" and r["start"] == "11:00" for r in rows)
    award = next(r for r in rows if r["paragraphs"][0][0]["text"].startswith("Award Ceremony"))
    assert (award["date"], award["start"]) == ("2026-11-12", "19:30"), award
    hebrew = next(r for r in rows if r["paragraphs"][0][0]["text"] == "TAM 6")
    assert "בינה מלאכותית (AI)" in [line["text"] for p in hebrew["paragraphs"] for line in p], hebrew
    assert rows[-1]["end"] is None and rows[-1]["date"] == "2026-11-13"
    assert any(text.startswith("Operation and") for text in unplaced), unplaced
    print("seeei programme-pdf parse selftest: ok (%d sessions)" % len(rows))


if __name__ == "__main__":
    if sys.argv[1:] != ["--selftest"]:
        sys.exit("usage: parse.py --selftest")
    selftest()
