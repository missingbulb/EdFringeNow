"""venues-research (curated/venues.json) -> the venues' cited addresses and pins, through the shared curated adapter."""

import importlib.util
import os

_spec = importlib.util.spec_from_file_location(
    "curated_venues_adapter",
    os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "platforms", "curated_venues.py"))
platform = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(platform)


def adapt(source):
    return platform.adapt(source)
