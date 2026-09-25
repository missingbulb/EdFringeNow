"""nominatim raw (`geocode.json`) -> venue coordinates, resolved by the address
the festival-site partial gives each venue (the shared platform adapter)."""

import importlib.util
import os

_spec = importlib.util.spec_from_file_location(
    "platform_nominatim",
    os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "platforms", "nominatim.py"))
platform = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(platform)


def adapt(source):
    return platform.adapt(source, "festival-site")
