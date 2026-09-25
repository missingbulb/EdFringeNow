#!/usr/bin/env python3
"""The NZ International Comedy Festival's "find a show" pages. Not built yet.

festival.toml declares this source required, so the 2027 edition is listed but
unserved until it exists. The site (Silverstripe, server-rendered) publishes no
JSON API; on 2026-09-25 `/find-a-show` listed only four off-season events, so
there was no festival programme to write a parser against.

To build it, once the 2027 programme is published: walk `/find-a-show` (it
filters by region, Auckland or Wellington), read each `/find-a-show/<slug>` page
for its performances, venue and per-show ticket agent link, write them through
`common.write_raw` in the site's vocabulary, and write the adapter
festival.toml names. There is no availability and no central price, so the
source declares neither role.
"""

import sys

if __name__ == "__main__":
    sys.exit("nzicf find-a-show: no fetcher yet (see this file's docstring); nothing written")
