"""The Singapore International Film Festival's Eventive raw -> the block, through the platform adapter.

Only the festival's own vocabulary is here: which of its tags name a genre; which tags it marks availability with.
"""

import importlib.util
import os

_spec = importlib.util.spec_from_file_location(
    "eventive_platform_adapter",
    os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "platforms", "eventive.py"))
platform = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(platform)

GENRE_BY_TAG = {
    "SGIFF Pro": "talk",
    "Industry Days": "talk",
    "Forum": "talk",
    "Pitching Forum": "talk",
}

STATUS_BY_TAG = {
    "SOLD OUT": "sold-out",
    "NOT AVAILABLE FOR SALE YET": "unknown",
    "SELLING FAST": "on-sale",
}


def adapt(source):
    return platform.adapt(source, genre_by_tag=GENRE_BY_TAG, status_by_tag=STATUS_BY_TAG)
