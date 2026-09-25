"""The Book Festival's Spektrix raw -> the block, through the platform adapter.

Its own attributes decide what is public programme: this year's festival
season, not marked excluded, and not a schools booking. Children's events are
family; everything else is a talk (readings, conversations, poetry).
"""

import importlib.util
import os

_spec = importlib.util.spec_from_file_location(
    "spektrix_platform_adapter",
    os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "platforms", "spektrix.py"))
platform = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(platform)


def public(event):
    return (event.get("attribute_Season", "").startswith("Festival ")
            and not event.get("attribute_Exclude")
            and event.get("attribute_ProgramType") != "Schools")


def adapt(source):
    return platform.adapt(
        source, public=public,
        url=lambda event: None,
        genre=lambda event: "family" if event.get("attribute_ProgramType") == "Children's" else "talk",
        free=lambda event: True if event.get("attribute_Free") else None,
    )
