#!/usr/bin/env python3
"""Availability for the Haifa festival from its ticket seller, ethos.smarticket.co.il. Not built yet.

festival.toml declares this source `required = false`, so every edition is
served without it and every performance's status is "unknown". It is declared
so the place is visible. What stops it being written is that nobody has seen
the seller's event API from a machine that can reach it. The festival's pricing
page names the backend, and the Jerusalem festival's seller runs on the same
vendor, but no endpoint or payload has been read. So this refuses rather than
guess one.

To build it: on a machine with egress, find the per-screening availability
behind `https://www.haifaff.co.il/eng/Basket/<screeningId>`. Then write the raw
through `common.write_raw` keyed by that screening id, and write the adapter
this source's `adapter` names, mapping the seller's states to on-sale,
sold-out and unknown.
"""

import sys

if __name__ == "__main__":
    sys.exit("smarticket: no fetcher yet (see this file's docstring); nothing written")
