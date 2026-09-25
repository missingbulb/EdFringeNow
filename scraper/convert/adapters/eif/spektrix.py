"""The International Festival's Spektrix raw -> the block, through the platform adapter.

EIF's own attributes decide what is public programme: an event with a page on
eif.co.uk (`attribute_EventPageURL`), excluding members' events. Touch tours,
backstage tours and lounge add-ons have no page and so drop out with it.
"""

import importlib.util
import os
import re

_spec = importlib.util.spec_from_file_location(
    "spektrix_platform_adapter",
    os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "platforms", "spektrix.py"))
platform = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(platform)

GENRE_BY_TYPE = {
    "Classical Music": "music",
    "Other Music": "music",
    "Opera": "music",
    "Theatre": "theatre",
    "Dance": "dance",
    "Family": "family",
    "Talks": "talk",
}


def public(event):
    return bool(event.get("attribute_EventPageURL")) and event.get("attribute_EventType") != "Membership Event"


def url(event):
    page = event.get("attribute_EventPageURL")
    return "https://www." + page.split("://")[-1].removeprefix("www.") if page else None


def listed_price(event):
    """EIF's own price line: "£30" is the price, "From £20" the cheapest seat
    (the dearest unknown); a suggested donation is not a price."""
    text = event.get("attribute_Price") or ""
    m = re.fullmatch(r"(From )?£(\d+(?:\.\d{1,2})?)", text.strip())
    if not m:
        return None, None
    amount = float(m.group(2))
    return amount, (None if m.group(1) else amount)


def adapt(source):
    return platform.adapt(
        source, public=public, url=url,
        genre=lambda event: GENRE_BY_TYPE.get(event.get("attribute_EventType")),
        listed_price=listed_price,
        # A suggested donation is free entry with an ask; no other EIF event says it is free.
        free=lambda event: True if (event.get("attribute_Price") or "").startswith("Suggested donation") else None,
    )
