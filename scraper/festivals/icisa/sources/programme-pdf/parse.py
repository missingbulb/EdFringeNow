#!/usr/bin/env python3
"""Pure parsing of ICISA's programme PDF, once pdf_grid has cut it into cells.

The programme is an Excel sheet exported to PDF, one grid per conference day:
a day heading across the top ("Tuesday, Nov- 17th, 2026"), a header row naming
the halls ("HALL A" … "Hall D"), and below it a time column on the left
("08:30-09:30") beside one cell per hall. A session that runs through two time
rows is one merged cell, and so is a row everyone shares (registration, coffee,
a plenary) across all the halls. A day's grid runs on over the next pages
without repeating its heading or its halls, so both carry over.

Each session cell holds its own words: bold lines naming it (often a track
first: "Brain", then the title), a moderator, then a paragraph per talk (its
title, then its speaker). This parser keeps that as paragraphs of lines, each
line marked bold or not and whether it fills the cell's width (so the next line
continues it); naming and wording are the adapter's.

    python3 scraper/festivals/icisa/sources/programme-pdf/parse.py --selftest
"""

import json
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
SAMPLES = os.path.join(HERE, "samples")
sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(HERE))), "platforms"))
import pdf_grid

_DAY = re.compile(r"^(?:Mon|Tues|Wednes|Thurs|Fri|Satur|Sun)day,\s*([A-Za-z]{3})[a-z]*-?\s*(\d{1,2})(?:st|nd|rd|th)?,\s*(\d{4})$")
_HALL = re.compile(r"^hall\s+[a-z0-9]+$", re.I)
_SLOT = re.compile(r"^(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})$")
_MONTHS = {m: n for n, m in enumerate(("jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"), 1)}


def _text(cell):
    return " ".join(line["text"] for line in cell["lines"]).strip()


def _date(match):
    month = _MONTHS[match.group(1).lower()]
    return "%s-%02d-%02d" % (match.group(3), month, int(match.group(2)))


def sessions(pages):
    """[cells of each page] -> every non-heading cell as {date, start, end, slots, halls, paragraphs}.

    `slots` are the time rows the cell spans, as printed; `start` and `end` run
    from the first one's start to the last one's end. `halls` are the header's
    halls the cell lies across.
    """
    out, day, halls = [], None, []
    for cells in pages:
        boxed = [c for c in cells if c["box"] is not None]
        days, headers, slots, rest = [], [], [], []
        for cell in boxed:
            text = _text(cell)
            if _DAY.match(text):
                days.append((cell["box"][1], _date(_DAY.match(text))))
            elif _HALL.match(text):
                headers.append(cell)
            elif _SLOT.match(text):
                slots.append(cell)
            else:
                rest.append(cell)
        for cell in rest:
            top = cell["box"][1]
            here = [d for t, d in days if t <= top]
            cell_day = here[-1] if here else day
            row = [h for h in headers if h["box"][1] <= top]
            if row:
                header_top = max(h["box"][1] for h in row)
                cell_halls = [(_text(h), h["box"]) for h in row if h["box"][1] == header_top]
            else:
                cell_halls = halls
            spanned = [name for name, box in cell_halls
                       if pdf_grid.overlap(cell["box"][0], cell["box"][2], box[0], box[2]) > 0.5]
            rows = [s for s in slots if pdf_grid.overlap(cell["box"][1], cell["box"][3], s["box"][1], s["box"][3]) > 0.5]
            if cell_day is None or not spanned or not rows:
                raise ValueError("cell %r has no day, hall or time row" % _text(cell)[:60])
            rows.sort(key=lambda s: s["box"][1])
            first, last = _SLOT.match(_text(rows[0])), _SLOT.match(_text(rows[-1]))
            out.append({
                "date": cell_day,
                "start": "%02d:%s" % (int(first.group(1)), first.group(2)),
                "end": "%02d:%s" % (int(last.group(3)), last.group(4)),
                "slots": [_text(s) for s in rows],
                "halls": spanned,
                "paragraphs": pdf_grid.paragraphs(cell),
            })
        if days:
            day = days[-1][1]
        if headers:
            header_top = max(h["box"][1] for h in headers)
            halls = [(_text(h), h["box"]) for h in headers if h["box"][1] == header_top]
    return out


def selftest():
    with open(os.path.join(SAMPLES, "programme-cells.json"), encoding="utf-8") as handle:
        pages = json.load(handle)
    rows = sessions(pages)
    assert len(rows) == 75, len(rows)
    assert sorted({r["date"] for r in rows}) == ["2026-11-17", "2026-11-18", "2026-11-19"]
    first = rows[0]
    assert (first["date"], first["start"], first["end"], first["halls"]) == (
        "2026-11-17", "07:30", "08:30", ["HALL A", "HALL B", "HALL C", "Hall D"]), first
    assert first["paragraphs"] == [[{"text": "Registration, Gathering, Light Breakfast & Exhibition", "bold": True, "full": False}]]
    # Hall A's symposium is one cell merged over two time rows.
    symposium = next(r for r in rows if r["paragraphs"][0][0]["text"] == "Symposium - Perioperative Medicine")
    assert (symposium["start"], symposium["end"], symposium["slots"], symposium["halls"]) == (
        "08:30", "11:00", ["08:30-09:30", "09:30-11:00"], ["HALL A"]), symposium
    # Page 2 carries Tuesday on without a heading, and its halls with it.
    brain = next(r for r in rows if r["date"] == "2026-11-17" and r["paragraphs"][0][0]["text"] == "Brain")
    assert (brain["start"], brain["end"], brain["halls"]) == ("13:45", "14:45", ["HALL C"]), brain
    assert [line["text"] for line in brain["paragraphs"][0]] == [
        "Brain", "Mind Matters: Perioperative Cognition, Delirium,", "and Recovery", "Moderator : TBA"], brain
    assert brain["paragraphs"][0][1]["full"] and not brain["paragraphs"][0][0]["full"]
    assert [line["text"] for line in brain["paragraphs"][1]] == [
        "Why So Much Confusion? The Mechanisms of", "Perioperative Neurocognitive Disorders", "Miles Berger"]
    last = rows[-1]
    assert last["date"] == "2026-11-19" and last["end"] == "17:00", last
    print("icisa programme-pdf parse selftest: ok (%d cells)" % len(rows))


if __name__ == "__main__":
    if sys.argv[1:] != ["--selftest"]:
        sys.exit("usage: parse.py --selftest")
    selftest()
