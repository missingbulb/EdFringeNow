"""The New Orleans Film Festival's Eventive raw -> the block, through the platform adapter.

Only the festival's own vocabulary is here: which of its tags name a genre.
"""

import importlib.util
import os

_spec = importlib.util.spec_from_file_location(
    "eventive_platform_adapter",
    os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "platforms", "eventive.py"))
platform = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(platform)

GENRE_BY_TAG = {
    "Conference Event": "talk",
    "Parties/Events": "other",
}


def adapt(source):
    return platform.adapt(source, genre_by_tag=GENRE_BY_TAG)
