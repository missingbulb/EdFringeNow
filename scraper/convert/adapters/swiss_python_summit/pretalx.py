"""Swiss Python Summit's pretalx raw -> the block, through the platform adapter.

Only the conference's own vocabulary is here: which curated building each room is in.
"""

import importlib.util
import os

_spec = importlib.util.spec_from_file_location(
    "pretalx_platform_adapter",
    os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "platforms", "pretalx.py"))
platform = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(platform)


def adapt(source):
    return platform.adapt(source, venue_of=lambda room: "ost-campus")
