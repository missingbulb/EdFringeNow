#!/usr/bin/env python3
"""The Melbourne International Comedy Festival's own JSON API. Not built yet.

festival.toml declares this source required, so the 2027 edition is listed but
unserved until it exists. What stops it being written is that the API returns
no records out of season: on 2026-09-25 every endpoint answered, but empty.

What was verified that day, from this sandbox:

  * `POST /umbraco/api/searchapi/searchShows` with a JSON body
    (`{"pageNumber": 1, "pageSize": 20, ...}`) answers
    `{"items": [], "pageNumber", "pageSize", "totalPages", "totalItems": 826}` —
    the 2026 count survives, the records do not;
  * `GET /umbraco/api/venuesapi/getvenues` answers `{"venues": []}`;
  * the site's bundle (`/build/app.*.js`) also calls
    `/umbraco/api/showapi/getsessiondetails` and the basket API
    (`/umbraco/api/basketapi/addTickets`, `getcartsummary`), which is the
    transaction surface a booking integration would need;
  * no show pages remain in `/sitemap.xml`.

To build it, once the 2027 programme launches (the festival registers shows
from October and publishes early in the new year): page through searchShows
with an empty filter, fetch getvenues, and read each show page's embedded
`sessionData` array (per-performance date, time, on-sale, sold-out, preview and
cheap-night flags). Write the three through `common.write_raw` in the site's
vocabulary, then write the adapter festival.toml names.
"""

import sys

if __name__ == "__main__":
    sys.exit("micf umbraco-api: no fetcher yet (see this file's docstring); nothing written")
