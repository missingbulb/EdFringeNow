"""The Tallgrass Film Festival's Eventive raw -> the block, through the platform adapter.

The festival tags nothing with a genre or availability, so the platform's defaults stand.
"""

import importlib.util
import os

_spec = importlib.util.spec_from_file_location(
    "eventive_platform_adapter",
    os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "platforms", "eventive.py"))
platform = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(platform)


def adapt(source):
    return platform.adapt(source)
