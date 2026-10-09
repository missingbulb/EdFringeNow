"""An Eventer producer page's raw (`programme.json`) -> the per-performance facts Eventer knows.

Shared by every festival that sells through Eventer (scraper/festivals/platforms/eventer.py
writes the raw). Eventer lists performances, not shows, under the producer's own
title lines, so a festival's adapter matches each one to its programme's
performance and supplies the vocabulary: which ticket types are not a seat's
price, and which hall a title line names.
"""

import html
import re

# "(50 דק')", "(60דק')", "(75 דק׳)": the running time the producer writes into the title line.
MINUTES_RE = re.compile(r"\((\d{1,3})\s*דק")
_BLOCK_END = re.compile(r"</(p|div|li|h[1-6])\s*>|<br\s*/?>", re.I)
_TAG = re.compile(r"<[^>]+>")


def minutes_in(name):
    found = MINUTES_RE.search(name or "")
    return int(found.group(1)) if found and int(found.group(1)) > 0 else None


def text_of(markup):
    """An event description's HTML as plain paragraphs, or None when it holds no text."""
    if not markup:
        return None
    text = html.unescape(_TAG.sub("", _BLOCK_END.sub("\n", markup)))
    lines = [re.sub(r"[ \t ]+", " ", line).strip() for line in text.split("\n")]
    paragraphs, current = [], []
    for line in lines + [""]:
        if line:
            current.append(line)
        elif current:
            paragraphs.append(" ".join(current))
            current = []
    return "\n\n".join(paragraphs) or None


def seat_prices(event, not_a_seat):
    """(min, max) over the ticket types that are one seat's price, or (None, None)."""
    amounts = [t["price"] for t in event["ticketTypes"]
               if isinstance(t.get("price"), (int, float)) and t["price"] > 0 and not not_a_seat(t["name"] or "")]
    return (min(amounts), max(amounts)) if amounts else (None, None)


def status_of(event):
    remaining = event.get("totalRemaining")
    if remaining is None:
        return "unknown"
    return "on-sale" if remaining > 0 else "sold-out"
