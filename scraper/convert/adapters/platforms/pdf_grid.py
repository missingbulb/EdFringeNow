"""Wording for a programme cell read out of a PDF grid (scraper/festivals/platforms/pdf_grid.py).

A festival's PDF parser keeps each cell's lines in paragraphs, every line
marked bold or not and `full` when it fills the cell's width, which is how the
exporter wrapped it. These turn those back into the sentences they were: a
`full` line runs on into the next, and lines that stop short are separate
items (a talk's title, then its speaker).
"""


def joined(lines, separator=" — ", speaker_last=False):
    """Lines -> one string: a full line runs on into the next (a word broken
    at a hyphen with no space), the rest are `separator`-joined.

    `speaker_last` says the paragraph is a talk whose last line is its speaker,
    so that line stands apart even after a line long enough to look wrapped.
    """
    out = ""
    for index, line in enumerate(lines):
        if index:
            previous = lines[index - 1]
            last = speaker_last and index == len(lines) - 1
            if previous["full"] and not last:
                out += "" if previous["text"].endswith("-") and not previous["text"].endswith(" -") else " "
            else:
                out += separator
        out += line["text"]
    return out


def heading(paragraph):
    """A session cell's first paragraph -> (title, the lines left over).

    The title is the paragraph's leading bold lines: a wrapped line takes the
    next one on, and a short first line (a track, "Plenary") takes the next one
    after a colon; a short line after that ends the title, and what follows it
    (a moderator, a speaker) is left over.
    """
    bold = 0
    while bold < len(paragraph) and paragraph[bold]["bold"]:
        bold += 1
    if not bold:
        return None, paragraph
    title, used = paragraph[0]["text"], 1
    while used < bold:
        previous = paragraph[used - 1]
        if previous["full"] or previous["text"].endswith((",", "-", "–")):
            title += " " + paragraph[used]["text"]
        elif used == 1:
            title += ("" if previous["text"].endswith(":") else ":") + " " + paragraph[used]["text"]
        else:
            break
        used += 1
    return title, paragraph[used:]
