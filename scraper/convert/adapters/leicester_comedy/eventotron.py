"""The Leicester Comedy Festival's Eventotron raw -> the block, through the platform adapter.

Only the genre mapping is Leicester's own: its box-office genres, to ours. A
genre not listed takes the festival's default ("comedy"): nearly every show is stand-up of some kind.
"""

import importlib.util
import os

_spec = importlib.util.spec_from_file_location(
    "eventotron_platform_adapter",
    os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "platforms", "eventotron.py"))
platform = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(platform)

GENRE_BY_SLUG = {
    "childrens": "family",
    "family-friendly": "family",
    "film": "film",
    "discussion": "talk",
}


def adapt(source):
    return platform.adapt(source, GENRE_BY_SLUG)
