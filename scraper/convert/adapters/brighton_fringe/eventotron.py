"""Brighton Fringe's Eventotron raw -> the block, through the platform adapter.

Only the genre mapping is Brighton's own: its box-office genres, to ours. A
genre not listed takes the festival's default ("other").
"""

import importlib.util
import os

_spec = importlib.util.spec_from_file_location(
    "eventotron_platform_adapter",
    os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "platforms", "eventotron.py"))
platform = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(platform)

GENRE_BY_SLUG = {
    "comedy": "comedy",
    "theatre": "theatre",
    "circus-dance-physical-theatre": "dance",
    "music-nightlife": "music",
    "children-young-people": "family",
    "literature-spoken-word": "talk",
}


def adapt(source):
    return platform.adapt(source, GENRE_BY_SLUG)
