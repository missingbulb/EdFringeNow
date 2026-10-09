"""nominatim raw -> venue coordinates, resolved against the spektrix partial's addresses."""

import importlib.util
import os

_spec = importlib.util.spec_from_file_location(
    "nominatim_platform_adapter",
    os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "platforms", "nominatim.py"))
platform = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(platform)


def adapt(source):
    return platform.adapt(source, "spektrix")
