// Dependency-free by design: a local pack's checks must load without the
// vendored mount, so this returns plain finding objects rather than importing
// engine/checks/helpers/findings.mjs.

// The repo holds two data trees and normalize.py writes both: `site/data/`, the
// wire files the browser fetches, and `data/`, the pipeline's own working files.
// Its module header is the authoritative list:
//
//   site/data/normalized/shows.min.json, availability.min.json, descriptions.min.json
//   site/data/venues.json
//   site/data/days/<YYYY-MM-DD>.json + site/data/days/index.json
//   data/normalized/shows.json                   the master, which no page fetches
//
// Both trees are scanned, because the hazard is the same on either side of the
// publish boundary — worse on the published one, where an unowned file is served
// to visitors. So a file under either that isn't one of those shapes came from a hand, a
// throwaway probe, or a force-added raw cache — and the next `refresh-shows`
// run neither maintains it nor knows about it. The patterns are deliberately
// shape-based (a dir plus a `.json` leaf) rather than a literal file list, so a
// new day file or a new normalized artefact doesn't trip the check; a whole new
// output *directory* does, which is the moment a human should confirm the
// producer really writes it.
const ALLOWED_PATTERNS = [
  /^site\/data\/normalized\/[^/]+\.json$/,
  /^site\/data\/days\/[^/]+\.json$/,
  /^data\/normalized\/[^/]+\.json$/,
];

// The two roots a committed data file may sit under. Named once so the scan, the
// findings and this file's own prose cannot drift apart.
const DATA_ROOTS = ['site/data/', 'data/'];

// Grandfathered: the pre-pipeline mock dataset the design-concepts prototypes
// still load, documented as such in README.md. It is not normalizer output and
// never will be; it is exempt by name so the rule can stay strict for everything
// else. Do not add to this list — new data comes from the normalizer.
const ALLOWED_FILES = new Set(['site/data/venues.json', 'data/shows.json']);

// The one committed file under data/ that is an *input* to normalize.py rather
// than an output of it: the fetch-once ticket-price cache written by
// scraper/fetch_prices.py. It satisfies what this rule is actually protecting —
// a script in this repo produces it, and nothing silently destroys it (the
// normalizer only ever reads it) — so it is named here rather than exempted by
// shape. Anything else claiming to be a second input needs the same scrutiny
// this entry got, which is why it is one name and not a pattern.
const ALLOWED_INPUTS = new Map([
  ['data/prices.json', 'scraper/fetch_prices.py'],
  // The small festivals' raw: each file a hand-run fetcher writes under its own
  // data/festivals/<festival>/<edition>/<source>/, and the converter only reads.
  ['data/festivals/jerusalem-comedy/2026/comedy-festival-site/manifest.json', 'scraper/festivals/jerusalem/sources/comedy-festival-site/fetch.py'],
  ['data/festivals/jerusalem-comedy/2026/comedy-festival-site/programme.json', 'scraper/festivals/jerusalem/sources/comedy-festival-site/fetch.py'],
  ['data/festivals/jerusalem-comedy/2026/nominatim/manifest.json', 'scraper/festivals/jerusalem/sources/nominatim/fetch.py'],
  ['data/festivals/jerusalem-comedy/2026/nominatim/geocode.json', 'scraper/festivals/jerusalem/sources/nominatim/fetch.py'],
  ['data/festivals/acco/2026/acco-tc/manifest.json', 'scraper/festivals/acco/sources/acco-tc/fetch.py'],
  ['data/festivals/acco/2026/acco-tc/programme.json', 'scraper/festivals/acco/sources/acco-tc/fetch.py'],
  ['data/festivals/acco/2026/eventer/manifest.json', 'scraper/festivals/acco/sources/eventer/fetch.py'],
  ['data/festivals/acco/2026/eventer/programme.json', 'scraper/festivals/acco/sources/eventer/fetch.py'],
  ['data/festivals/acco/2026/street-programme/manifest.json', 'scraper/festivals/acco/sources/street-programme/fetch.py'],
  ['data/festivals/acco/2026/street-programme/programme.json', 'scraper/festivals/acco/sources/street-programme/fetch.py'],
  ['data/festivals/haifa-iff/2026/haifaff-site/manifest.json', 'scraper/festivals/haifa_iff/sources/haifaff-site/fetch.py'],
  ['data/festivals/haifa-iff/2026/haifaff-site/programme.json', 'scraper/festivals/haifa_iff/sources/haifaff-site/fetch.py'],
  ['data/festivals/indnegev/2026/indnegev-site/manifest.json', 'scraper/festivals/indnegev/sources/indnegev-site/fetch.py'],
  ['data/festivals/indnegev/2026/indnegev-site/programme.json', 'scraper/festivals/indnegev/sources/indnegev-site/fetch.py'],
  ['data/festivals/jerusalem-oud/2026/confederation-house/manifest.json', 'scraper/festivals/jerusalem_oud/sources/confederation-house/fetch.py'],
  ['data/festivals/jerusalem-oud/2026/confederation-house/programme.json', 'scraper/festivals/jerusalem_oud/sources/confederation-house/fetch.py'],
  ['data/festivals/abu-gosh/2026/abugosh-site/manifest.json', 'scraper/festivals/abu_gosh/sources/abugosh-site/fetch.py'],
  ['data/festivals/abu-gosh/2026/abugosh-site/programme.json', 'scraper/festivals/abu_gosh/sources/abugosh-site/fetch.py'],
  ['data/festivals/tel-aviv-festival/2026/festival-site/manifest.json', 'scraper/festivals/tel_aviv_festival/sources/festival-site/fetch.py'],
  ['data/festivals/tel-aviv-festival/2026/festival-site/programme.json', 'scraper/festivals/tel_aviv_festival/sources/festival-site/fetch.py'],
  ['data/festivals/isra/2026/eventact-agenda/manifest.json', 'scraper/festivals/isra/sources/eventact-agenda/fetch.py'],
  ['data/festivals/isra/2026/eventact-agenda/programme.json', 'scraper/festivals/isra/sources/eventact-agenda/fetch.py'],
  ['data/festivals/ais-conference/2026/eventact-agenda/manifest.json', 'scraper/festivals/ais_conference/sources/eventact-agenda/fetch.py'],
  ['data/festivals/ais-conference/2026/eventact-agenda/programme.json', 'scraper/festivals/ais_conference/sources/eventact-agenda/fetch.py'],
  ['data/festivals/tlvfest/2026/cinematheque/manifest.json', 'scraper/festivals/tlvfest/sources/cinematheque/fetch.py'],
  ['data/festivals/tlvfest/2026/cinematheque/programme.json', 'scraper/festivals/tlvfest/sources/cinematheque/fetch.py'],
  ['data/festivals/kol-hamusica/2026/smarticket/manifest.json', 'scraper/festivals/kol_hamusica/sources/smarticket/fetch.py'],
  ['data/festivals/kol-hamusica/2026/smarticket/programme.json', 'scraper/festivals/kol_hamusica/sources/smarticket/fetch.py'],
  ['data/festivals/red-sea-jazz/2026/festival-site/manifest.json', 'scraper/festivals/red_sea_jazz/sources/festival-site/fetch.py'],
  ['data/festivals/red-sea-jazz/2026/festival-site/programme.json', 'scraper/festivals/red_sea_jazz/sources/festival-site/fetch.py'],
  ['data/festivals/icisa/2026/programme-pdf/manifest.json', 'scraper/festivals/icisa/sources/programme-pdf/fetch.py'],
  ['data/festivals/icisa/2026/programme-pdf/programme.json', 'scraper/festivals/icisa/sources/programme-pdf/fetch.py'],
  ['data/festivals/seeei-electricity-energy/2026/programme-pdf/manifest.json', 'scraper/festivals/seeei/sources/programme-pdf/fetch.py'],
  ['data/festivals/seeei-electricity-energy/2026/programme-pdf/programme.json', 'scraper/festivals/seeei/sources/programme-pdf/fetch.py'],
  ['data/festivals/israel-neurological-association/2026/congress-site/manifest.json', 'scraper/festivals/israel_neurology/sources/congress-site/fetch.py'],
  ['data/festivals/israel-neurological-association/2026/congress-site/programme.json', 'scraper/festivals/israel_neurology/sources/congress-site/fetch.py'],
  ['data/festivals/iaem/2026/forms-wizard/manifest.json', 'scraper/festivals/iaem/sources/forms-wizard/fetch.py'],
  ['data/festivals/iaem/2026/forms-wizard/programme.json', 'scraper/festivals/iaem/sources/forms-wizard/fetch.py'],
  ['data/festivals/israman/2027/festival-site/manifest.json', 'scraper/festivals/israman/sources/festival-site/fetch.py'],
  ['data/festivals/israman/2027/festival-site/programme.json', 'scraper/festivals/israman/sources/festival-site/fetch.py'],
  ['data/festivals/brighton-fringe/2026/eventotron/manifest.json', 'scraper/festivals/brighton_fringe/sources/eventotron/fetch.py'],
  ['data/festivals/brighton-fringe/2026/eventotron/programme.json', 'scraper/festivals/brighton_fringe/sources/eventotron/fetch.py'],
  ['data/festivals/edinburgh-art-festival/2026/festival-site/manifest.json', 'scraper/festivals/edinburgh_art_festival/sources/festival-site/fetch.py'],
  ['data/festivals/edinburgh-art-festival/2026/festival-site/programme.json', 'scraper/festivals/edinburgh_art_festival/sources/festival-site/fetch.py'],
  ['data/festivals/edinburgh-book-festival/2026/nominatim/geocode.json', 'scraper/festivals/edinburgh_book_festival/sources/nominatim/fetch.py'],
  ['data/festivals/edinburgh-book-festival/2026/nominatim/manifest.json', 'scraper/festivals/edinburgh_book_festival/sources/nominatim/fetch.py'],
  ['data/festivals/edinburgh-book-festival/2026/spektrix/manifest.json', 'scraper/festivals/edinburgh_book_festival/sources/spektrix/fetch.py'],
  ['data/festivals/edinburgh-book-festival/2026/spektrix/programme.json', 'scraper/festivals/edinburgh_book_festival/sources/spektrix/fetch.py'],
  ['data/festivals/edinburgh-deaf-festival/2026/festival-site/manifest.json', 'scraper/festivals/edinburgh_deaf_festival/sources/festival-site/fetch.py'],
  ['data/festivals/edinburgh-deaf-festival/2026/festival-site/programme.json', 'scraper/festivals/edinburgh_deaf_festival/sources/festival-site/fetch.py'],
  ['data/festivals/edinburgh-deaf-festival/2026/nominatim/geocode.json', 'scraper/festivals/edinburgh_deaf_festival/sources/nominatim/fetch.py'],
  ['data/festivals/edinburgh-deaf-festival/2026/nominatim/manifest.json', 'scraper/festivals/edinburgh_deaf_festival/sources/nominatim/fetch.py'],
  ['data/festivals/edinburgh-tattoo/2027/ticketing-api/manifest.json', 'scraper/festivals/edinburgh_tattoo/sources/ticketing-api/fetch.py'],
  ['data/festivals/edinburgh-tattoo/2027/ticketing-api/programme.json', 'scraper/festivals/edinburgh_tattoo/sources/ticketing-api/fetch.py'],
  ['data/festivals/eif/2026/nominatim/geocode.json', 'scraper/festivals/eif/sources/nominatim/fetch.py'],
  ['data/festivals/eif/2026/nominatim/manifest.json', 'scraper/festivals/eif/sources/nominatim/fetch.py'],
  ['data/festivals/eif/2026/spektrix/manifest.json', 'scraper/festivals/eif/sources/spektrix/fetch.py'],
  ['data/festivals/eif/2026/spektrix/programme.json', 'scraper/festivals/eif/sources/spektrix/fetch.py'],
  ['data/festivals/eiff/2026/festival-site/manifest.json', 'scraper/festivals/eiff/sources/festival-site/fetch.py'],
  ['data/festivals/eiff/2026/festival-site/programme.json', 'scraper/festivals/eiff/sources/festival-site/fetch.py'],
  ['data/festivals/fringe-by-the-sea/2026/festival-site/manifest.json', 'scraper/festivals/fringe_by_the_sea/sources/festival-site/fetch.py'],
  ['data/festivals/fringe-by-the-sea/2026/festival-site/programme.json', 'scraper/festivals/fringe_by_the_sea/sources/festival-site/fetch.py'],
  ['data/festivals/fringe-by-the-sea/2026/nominatim/geocode.json', 'scraper/festivals/fringe_by_the_sea/sources/nominatim/fetch.py'],
  ['data/festivals/fringe-by-the-sea/2026/nominatim/manifest.json', 'scraper/festivals/fringe_by_the_sea/sources/nominatim/fetch.py'],
  ['data/festivals/leicester-comedy/2026/eventotron/manifest.json', 'scraper/festivals/leicester_comedy/sources/eventotron/fetch.py'],
  ['data/festivals/leicester-comedy/2026/eventotron/programme.json', 'scraper/festivals/leicester_comedy/sources/eventotron/fetch.py'],
  ['data/festivals/new-orleans-film-festival/2026/eventive/manifest.json', 'scraper/festivals/new_orleans_film_festival/sources/eventive/fetch.py'],
  ['data/festivals/new-orleans-film-festival/2026/eventive/programme.json', 'scraper/festivals/new_orleans_film_festival/sources/eventive/fetch.py'],
  ['data/festivals/new-orleans-film-festival/2026/nominatim/geocode.json', 'scraper/festivals/new_orleans_film_festival/sources/nominatim/fetch.py'],
  ['data/festivals/new-orleans-film-festival/2026/nominatim/manifest.json', 'scraper/festivals/new_orleans_film_festival/sources/nominatim/fetch.py'],
  ['data/festivals/singapore-international-film-festival/2026/eventive/manifest.json', 'scraper/festivals/singapore_international_film_festival/sources/eventive/fetch.py'],
  ['data/festivals/singapore-international-film-festival/2026/eventive/programme.json', 'scraper/festivals/singapore_international_film_festival/sources/eventive/fetch.py'],
  ['data/festivals/singapore-international-film-festival/2026/nominatim/geocode.json', 'scraper/festivals/singapore_international_film_festival/sources/nominatim/fetch.py'],
  ['data/festivals/singapore-international-film-festival/2026/nominatim/manifest.json', 'scraper/festivals/singapore_international_film_festival/sources/nominatim/fetch.py'],
  ['data/festivals/tallgrass-film-festival/2026/eventive/manifest.json', 'scraper/festivals/tallgrass_film_festival/sources/eventive/fetch.py'],
  ['data/festivals/tallgrass-film-festival/2026/eventive/programme.json', 'scraper/festivals/tallgrass_film_festival/sources/eventive/fetch.py'],
  ['data/festivals/tallgrass-film-festival/2026/nominatim/geocode.json', 'scraper/festivals/tallgrass_film_festival/sources/nominatim/fetch.py'],
  ['data/festivals/tallgrass-film-festival/2026/nominatim/manifest.json', 'scraper/festivals/tallgrass_film_festival/sources/nominatim/fetch.py'],
  ['data/festivals/tryon-international-film-festival/2026/eventive/manifest.json', 'scraper/festivals/tryon_international_film_festival/sources/eventive/fetch.py'],
  ['data/festivals/tryon-international-film-festival/2026/eventive/programme.json', 'scraper/festivals/tryon_international_film_festival/sources/eventive/fetch.py'],
  ['data/festivals/tryon-international-film-festival/2026/nominatim/geocode.json', 'scraper/festivals/tryon_international_film_festival/sources/nominatim/fetch.py'],
  ['data/festivals/tryon-international-film-festival/2026/nominatim/manifest.json', 'scraper/festivals/tryon_international_film_festival/sources/nominatim/fetch.py'],
  ['data/festivals/viet-film-fest/2026/eventive/manifest.json', 'scraper/festivals/viet_film_fest/sources/eventive/fetch.py'],
  ['data/festivals/viet-film-fest/2026/eventive/programme.json', 'scraper/festivals/viet_film_fest/sources/eventive/fetch.py'],
  ['data/festivals/viet-film-fest/2026/nominatim/geocode.json', 'scraper/festivals/viet_film_fest/sources/nominatim/fetch.py'],
  ['data/festivals/viet-film-fest/2026/nominatim/manifest.json', 'scraper/festivals/viet_film_fest/sources/nominatim/fetch.py'],
  ['data/festivals/santa-fe-international-film-festival/2026/eventive/manifest.json', 'scraper/festivals/santa_fe_international_film_festival/sources/eventive/fetch.py'],
  ['data/festivals/santa-fe-international-film-festival/2026/eventive/programme.json', 'scraper/festivals/santa_fe_international_film_festival/sources/eventive/fetch.py'],
  ['data/festivals/santa-fe-international-film-festival/2026/nominatim/geocode.json', 'scraper/festivals/santa_fe_international_film_festival/sources/nominatim/fetch.py'],
  ['data/festivals/santa-fe-international-film-festival/2026/nominatim/manifest.json', 'scraper/festivals/santa_fe_international_film_festival/sources/nominatim/fetch.py'],
  ['data/festivals/london-latino-film-festival/2026/eventive/manifest.json', 'scraper/festivals/london_latino_film_festival/sources/eventive/fetch.py'],
  ['data/festivals/london-latino-film-festival/2026/eventive/programme.json', 'scraper/festivals/london_latino_film_festival/sources/eventive/fetch.py'],
  ['data/festivals/london-latino-film-festival/2026/nominatim/geocode.json', 'scraper/festivals/london_latino_film_festival/sources/nominatim/fetch.py'],
  ['data/festivals/london-latino-film-festival/2026/nominatim/manifest.json', 'scraper/festivals/london_latino_film_festival/sources/nominatim/fetch.py'],
  ['data/festivals/outshine-lgbtq-film-festival/2026/eventive/manifest.json', 'scraper/festivals/outshine_lgbtq_film_festival/sources/eventive/fetch.py'],
  ['data/festivals/outshine-lgbtq-film-festival/2026/eventive/programme.json', 'scraper/festivals/outshine_lgbtq_film_festival/sources/eventive/fetch.py'],
  ['data/festivals/outshine-lgbtq-film-festival/2026/nominatim/geocode.json', 'scraper/festivals/outshine_lgbtq_film_festival/sources/nominatim/fetch.py'],
  ['data/festivals/outshine-lgbtq-film-festival/2026/nominatim/manifest.json', 'scraper/festivals/outshine_lgbtq_film_festival/sources/nominatim/fetch.py'],
  ['data/festivals/silicon-valley-jewish-film-festival/2026/eventive/manifest.json', 'scraper/festivals/silicon_valley_jewish_film_festival/sources/eventive/fetch.py'],
  ['data/festivals/silicon-valley-jewish-film-festival/2026/eventive/programme.json', 'scraper/festivals/silicon_valley_jewish_film_festival/sources/eventive/fetch.py'],
  ['data/festivals/silicon-valley-jewish-film-festival/2026/nominatim/geocode.json', 'scraper/festivals/silicon_valley_jewish_film_festival/sources/nominatim/fetch.py'],
  ['data/festivals/silicon-valley-jewish-film-festival/2026/nominatim/manifest.json', 'scraper/festivals/silicon_valley_jewish_film_festival/sources/nominatim/fetch.py'],
  ['data/festivals/litquake/2026/sched/manifest.json', 'scraper/festivals/litquake/sources/sched/fetch.py'],
  ['data/festivals/litquake/2026/sched/programme.json', 'scraper/festivals/litquake/sources/sched/fetch.py'],
  ['data/festivals/litquake/2026/nominatim/geocode.json', 'scraper/festivals/litquake/sources/nominatim/fetch.py'],
  ['data/festivals/litquake/2026/nominatim/manifest.json', 'scraper/festivals/litquake/sources/nominatim/fetch.py'],
  ['data/festivals/hack-lu/2026/pretalx/manifest.json', 'scraper/festivals/hack_lu/sources/pretalx/fetch.py'],
  ['data/festivals/hack-lu/2026/pretalx/programme.json', 'scraper/festivals/hack_lu/sources/pretalx/fetch.py'],
  ['data/festivals/scala-days/2026/pretalx/manifest.json', 'scraper/festivals/scala_days/sources/pretalx/fetch.py'],
  ['data/festivals/scala-days/2026/pretalx/programme.json', 'scraper/festivals/scala_days/sources/pretalx/fetch.py'],
  ['data/festivals/swiss-python-summit/2026/pretalx/manifest.json', 'scraper/festivals/swiss_python_summit/sources/pretalx/fetch.py'],
  ['data/festivals/swiss-python-summit/2026/pretalx/programme.json', 'scraper/festivals/swiss_python_summit/sources/pretalx/fetch.py'],
  ['data/festivals/matrix-conference/2026/pretalx/manifest.json', 'scraper/festivals/matrix_conference/sources/pretalx/fetch.py'],
  ['data/festivals/matrix-conference/2026/pretalx/programme.json', 'scraper/festivals/matrix_conference/sources/pretalx/fetch.py'],
  ['data/festivals/marxismnl-conference/2026/pretalx/manifest.json', 'scraper/festivals/marxismnl_conference/sources/pretalx/fetch.py'],
  ['data/festivals/marxismnl-conference/2026/pretalx/programme.json', 'scraper/festivals/marxismnl_conference/sources/pretalx/fetch.py'],
  ['data/festivals/pycon-greece/2026/pretalx/manifest.json', 'scraper/festivals/pycon_greece/sources/pretalx/fetch.py'],
  ['data/festivals/pycon-greece/2026/pretalx/programme.json', 'scraper/festivals/pycon_greece/sources/pretalx/fetch.py'],
  // The cities' visitor raw, written by scraper/cities/fetch.py per city and source.
  ['data/cities/abu-ghosh/amenities/manifest.json', 'scraper/cities/fetch.py'],
  ['data/cities/abu-ghosh/amenities/places.json', 'scraper/cities/fetch.py'],
  ['data/cities/abu-ghosh/osm/manifest.json', 'scraper/cities/fetch.py'],
  ['data/cities/abu-ghosh/osm/places.json', 'scraper/cities/fetch.py'],
  ['data/cities/abu-ghosh/wikidata/entities.json', 'scraper/cities/fetch.py'],
  ['data/cities/abu-ghosh/wikidata/manifest.json', 'scraper/cities/fetch.py'],
  ['data/cities/abu-ghosh/wikivoyage/gonext.json', 'scraper/cities/fetch.py'],
  ['data/cities/abu-ghosh/wikivoyage/manifest.json', 'scraper/cities/fetch.py'],
  ['data/cities/akko/amenities/manifest.json', 'scraper/cities/fetch.py'],
  ['data/cities/akko/amenities/places.json', 'scraper/cities/fetch.py'],
  ['data/cities/akko/osm/manifest.json', 'scraper/cities/fetch.py'],
  ['data/cities/akko/osm/places.json', 'scraper/cities/fetch.py'],
  ['data/cities/akko/wikidata/entities.json', 'scraper/cities/fetch.py'],
  ['data/cities/akko/wikidata/manifest.json', 'scraper/cities/fetch.py'],
  ['data/cities/akko/wikivoyage/gonext.json', 'scraper/cities/fetch.py'],
  ['data/cities/akko/wikivoyage/manifest.json', 'scraper/cities/fetch.py'],
  ['data/cities/auckland/amenities/manifest.json', 'scraper/cities/fetch.py'],
  ['data/cities/auckland/amenities/places.json', 'scraper/cities/fetch.py'],
  ['data/cities/auckland/osm/manifest.json', 'scraper/cities/fetch.py'],
  ['data/cities/auckland/osm/places.json', 'scraper/cities/fetch.py'],
  ['data/cities/auckland/wikidata/entities.json', 'scraper/cities/fetch.py'],
  ['data/cities/auckland/wikidata/manifest.json', 'scraper/cities/fetch.py'],
  ['data/cities/auckland/wikivoyage/gonext.json', 'scraper/cities/fetch.py'],
  ['data/cities/auckland/wikivoyage/manifest.json', 'scraper/cities/fetch.py'],
  ['data/cities/brighton/amenities/manifest.json', 'scraper/cities/fetch.py'],
  ['data/cities/brighton/amenities/places.json', 'scraper/cities/fetch.py'],
  ['data/cities/brighton/osm/manifest.json', 'scraper/cities/fetch.py'],
  ['data/cities/brighton/osm/places.json', 'scraper/cities/fetch.py'],
  ['data/cities/brighton/wikidata/entities.json', 'scraper/cities/fetch.py'],
  ['data/cities/brighton/wikidata/manifest.json', 'scraper/cities/fetch.py'],
  ['data/cities/brighton/wikivoyage/gonext.json', 'scraper/cities/fetch.py'],
  ['data/cities/brighton/wikivoyage/manifest.json', 'scraper/cities/fetch.py'],
  ['data/cities/capernaum/amenities/manifest.json', 'scraper/cities/fetch.py'],
  ['data/cities/capernaum/amenities/places.json', 'scraper/cities/fetch.py'],
  ['data/cities/capernaum/osm/manifest.json', 'scraper/cities/fetch.py'],
  ['data/cities/capernaum/osm/places.json', 'scraper/cities/fetch.py'],
  ['data/cities/capernaum/wikidata/entities.json', 'scraper/cities/fetch.py'],
  ['data/cities/capernaum/wikidata/manifest.json', 'scraper/cities/fetch.py'],
  ['data/cities/capernaum/wikivoyage/gonext.json', 'scraper/cities/fetch.py'],
  ['data/cities/capernaum/wikivoyage/manifest.json', 'scraper/cities/fetch.py'],
  ['data/cities/edinburgh/amenities/manifest.json', 'scraper/cities/fetch.py'],
  ['data/cities/edinburgh/amenities/places.json', 'scraper/cities/fetch.py'],
  ['data/cities/edinburgh/osm/manifest.json', 'scraper/cities/fetch.py'],
  ['data/cities/edinburgh/osm/places.json', 'scraper/cities/fetch.py'],
  ['data/cities/edinburgh/wikidata/entities.json', 'scraper/cities/fetch.py'],
  ['data/cities/edinburgh/wikidata/manifest.json', 'scraper/cities/fetch.py'],
  ['data/cities/edinburgh/wikivoyage/gonext.json', 'scraper/cities/fetch.py'],
  ['data/cities/edinburgh/wikivoyage/manifest.json', 'scraper/cities/fetch.py'],
  ['data/cities/haifa/amenities/manifest.json', 'scraper/cities/fetch.py'],
  ['data/cities/haifa/amenities/places.json', 'scraper/cities/fetch.py'],
  ['data/cities/haifa/osm/manifest.json', 'scraper/cities/fetch.py'],
  ['data/cities/haifa/osm/places.json', 'scraper/cities/fetch.py'],
  ['data/cities/haifa/wikidata/entities.json', 'scraper/cities/fetch.py'],
  ['data/cities/haifa/wikidata/manifest.json', 'scraper/cities/fetch.py'],
  ['data/cities/haifa/wikivoyage/gonext.json', 'scraper/cities/fetch.py'],
  ['data/cities/haifa/wikivoyage/manifest.json', 'scraper/cities/fetch.py'],
  ['data/cities/jerusalem/amenities/manifest.json', 'scraper/cities/fetch.py'],
  ['data/cities/jerusalem/amenities/places.json', 'scraper/cities/fetch.py'],
  ['data/cities/jerusalem/osm/manifest.json', 'scraper/cities/fetch.py'],
  ['data/cities/jerusalem/osm/places.json', 'scraper/cities/fetch.py'],
  ['data/cities/jerusalem/wikidata/entities.json', 'scraper/cities/fetch.py'],
  ['data/cities/jerusalem/wikidata/manifest.json', 'scraper/cities/fetch.py'],
  ['data/cities/jerusalem/wikivoyage/gonext.json', 'scraper/cities/fetch.py'],
  ['data/cities/jerusalem/wikivoyage/manifest.json', 'scraper/cities/fetch.py'],
  ['data/cities/leicester/amenities/manifest.json', 'scraper/cities/fetch.py'],
  ['data/cities/leicester/amenities/places.json', 'scraper/cities/fetch.py'],
  ['data/cities/leicester/osm/manifest.json', 'scraper/cities/fetch.py'],
  ['data/cities/leicester/osm/places.json', 'scraper/cities/fetch.py'],
  ['data/cities/leicester/wikidata/entities.json', 'scraper/cities/fetch.py'],
  ['data/cities/leicester/wikidata/manifest.json', 'scraper/cities/fetch.py'],
  ['data/cities/leicester/wikivoyage/gonext.json', 'scraper/cities/fetch.py'],
  ['data/cities/leicester/wikivoyage/manifest.json', 'scraper/cities/fetch.py'],
  ['data/cities/melbourne/amenities/manifest.json', 'scraper/cities/fetch.py'],
  ['data/cities/melbourne/amenities/places.json', 'scraper/cities/fetch.py'],
  ['data/cities/melbourne/osm/manifest.json', 'scraper/cities/fetch.py'],
  ['data/cities/melbourne/osm/places.json', 'scraper/cities/fetch.py'],
  ['data/cities/melbourne/wikidata/entities.json', 'scraper/cities/fetch.py'],
  ['data/cities/melbourne/wikidata/manifest.json', 'scraper/cities/fetch.py'],
  ['data/cities/melbourne/wikivoyage/gonext.json', 'scraper/cities/fetch.py'],
  ['data/cities/melbourne/wikivoyage/manifest.json', 'scraper/cities/fetch.py'],
  ['data/cities/mitzpe-gvulot/amenities/manifest.json', 'scraper/cities/fetch.py'],
  ['data/cities/mitzpe-gvulot/amenities/places.json', 'scraper/cities/fetch.py'],
  ['data/cities/mitzpe-gvulot/osm/manifest.json', 'scraper/cities/fetch.py'],
  ['data/cities/mitzpe-gvulot/osm/places.json', 'scraper/cities/fetch.py'],
  ['data/cities/mitzpe-gvulot/wikidata/entities.json', 'scraper/cities/fetch.py'],
  ['data/cities/mitzpe-gvulot/wikidata/manifest.json', 'scraper/cities/fetch.py'],
  ['data/cities/mitzpe-gvulot/wikivoyage/gonext.json', 'scraper/cities/fetch.py'],
  ['data/cities/mitzpe-gvulot/wikivoyage/manifest.json', 'scraper/cities/fetch.py'],
  ['data/cities/north-berwick/amenities/manifest.json', 'scraper/cities/fetch.py'],
  ['data/cities/north-berwick/amenities/places.json', 'scraper/cities/fetch.py'],
  ['data/cities/north-berwick/osm/manifest.json', 'scraper/cities/fetch.py'],
  ['data/cities/north-berwick/osm/places.json', 'scraper/cities/fetch.py'],
  ['data/cities/north-berwick/wikidata/entities.json', 'scraper/cities/fetch.py'],
  ['data/cities/north-berwick/wikidata/manifest.json', 'scraper/cities/fetch.py'],
  ['data/cities/north-berwick/wikivoyage/gonext.json', 'scraper/cities/fetch.py'],
  ['data/cities/north-berwick/wikivoyage/manifest.json', 'scraper/cities/fetch.py'],
  ['data/cities/tel-aviv/amenities/manifest.json', 'scraper/cities/fetch.py'],
  ['data/cities/tel-aviv/amenities/places.json', 'scraper/cities/fetch.py'],
  ['data/cities/tel-aviv/osm/manifest.json', 'scraper/cities/fetch.py'],
  ['data/cities/tel-aviv/osm/places.json', 'scraper/cities/fetch.py'],
  ['data/cities/tel-aviv/wikidata/entities.json', 'scraper/cities/fetch.py'],
  ['data/cities/tel-aviv/wikidata/manifest.json', 'scraper/cities/fetch.py'],
  ['data/cities/tel-aviv/wikivoyage/gonext.json', 'scraper/cities/fetch.py'],
  ['data/cities/tel-aviv/wikivoyage/manifest.json', 'scraper/cities/fetch.py'],
  ['data/cities/wellington/amenities/manifest.json', 'scraper/cities/fetch.py'],
  ['data/cities/wellington/amenities/places.json', 'scraper/cities/fetch.py'],
  ['data/cities/wellington/osm/manifest.json', 'scraper/cities/fetch.py'],
  ['data/cities/wellington/osm/places.json', 'scraper/cities/fetch.py'],
  ['data/cities/wellington/wikidata/entities.json', 'scraper/cities/fetch.py'],
  ['data/cities/wellington/wikidata/manifest.json', 'scraper/cities/fetch.py'],
  ['data/cities/wellington/wikivoyage/gonext.json', 'scraper/cities/fetch.py'],
  ['data/cities/wellington/wikivoyage/manifest.json', 'scraper/cities/fetch.py'],
]);

// Committed files under the data trees written by a generator in this repo that
// is NOT normalize.py: the festival and city converters' serving files and registries.
//
// Named, not shaped: a new festival's or edition's file is exactly the moment a
// human should confirm the producer really writes what is in it, so a file that
// merely sits beside an allowed one still trips the rule.
const ALLOWED_OUTPUTS = new Map([
  ['site/data/festivals/index.json', 'scraper/convert/to_serving.py'],
  ['site/data/festivals/jerusalem-comedy/2026.json', 'scraper/convert/to_serving.py'],
  ['site/data/festivals/acco/2026.json', 'scraper/convert/to_serving.py'],
  ['site/data/festivals/jerusalem-oud/2026.json', 'scraper/convert/to_serving.py'],
  ['site/data/festivals/haifa-iff/2026.json', 'scraper/convert/to_serving.py'],
  ['site/data/festivals/indnegev/2026.json', 'scraper/convert/to_serving.py'],
  ['site/data/festivals/abu-gosh/2026.json', 'scraper/convert/to_serving.py'],
  ['site/data/festivals/tel-aviv-festival/2026.json', 'scraper/convert/to_serving.py'],
  ['site/data/festivals/isra/2026.json', 'scraper/convert/to_serving.py'],
  ['site/data/festivals/ais-conference/2026.json', 'scraper/convert/to_serving.py'],
  ['site/data/festivals/tlvfest/2026.json', 'scraper/convert/to_serving.py'],
  ['site/data/festivals/kol-hamusica/2026.json', 'scraper/convert/to_serving.py'],
  ['site/data/festivals/red-sea-jazz/2026.json', 'scraper/convert/to_serving.py'],
  ['site/data/festivals/icisa/2026.json', 'scraper/convert/to_serving.py'],
  ['site/data/festivals/seeei-electricity-energy/2026.json', 'scraper/convert/to_serving.py'],
  ['site/data/festivals/israel-neurological-association/2026.json', 'scraper/convert/to_serving.py'],
  ['site/data/festivals/iaem/2026.json', 'scraper/convert/to_serving.py'],
  ['site/data/festivals/israman/2027.json', 'scraper/convert/to_serving.py'],
  ['site/data/festivals/brighton-fringe/2026.json', 'scraper/convert/to_serving.py'],
  ['site/data/festivals/edinburgh-art-festival/2026.json', 'scraper/convert/to_serving.py'],
  ['site/data/festivals/edinburgh-book-festival/2026.json', 'scraper/convert/to_serving.py'],
  ['site/data/festivals/edinburgh-deaf-festival/2026.json', 'scraper/convert/to_serving.py'],
  ['site/data/festivals/edinburgh-tattoo/2027.json', 'scraper/convert/to_serving.py'],
  ['site/data/festivals/eif/2026.json', 'scraper/convert/to_serving.py'],
  ['site/data/festivals/eiff/2026.json', 'scraper/convert/to_serving.py'],
  ['site/data/festivals/fringe-by-the-sea/2026.json', 'scraper/convert/to_serving.py'],
  ['site/data/festivals/leicester-comedy/2026.json', 'scraper/convert/to_serving.py'],
  ['site/data/festivals/litquake/2026.json', 'scraper/convert/to_serving.py'],
  ['site/data/festivals/hack-lu/2026.json', 'scraper/convert/to_serving.py'],
  ['site/data/festivals/scala-days/2026.json', 'scraper/convert/to_serving.py'],
  ['site/data/festivals/swiss-python-summit/2026.json', 'scraper/convert/to_serving.py'],
  ['site/data/festivals/matrix-conference/2026.json', 'scraper/convert/to_serving.py'],
  ['site/data/festivals/marxismnl-conference/2026.json', 'scraper/convert/to_serving.py'],
  ['site/data/festivals/pycon-greece/2026.json', 'scraper/convert/to_serving.py'],
  ['site/data/festivals/new-orleans-film-festival/2026.json', 'scraper/convert/to_serving.py'],
  ['site/data/festivals/singapore-international-film-festival/2026.json', 'scraper/convert/to_serving.py'],
  ['site/data/festivals/tallgrass-film-festival/2026.json', 'scraper/convert/to_serving.py'],
  ['site/data/festivals/tryon-international-film-festival/2026.json', 'scraper/convert/to_serving.py'],
  ['site/data/festivals/viet-film-fest/2026.json', 'scraper/convert/to_serving.py'],
  ['site/data/festivals/santa-fe-international-film-festival/2026.json', 'scraper/convert/to_serving.py'],
  ['site/data/festivals/london-latino-film-festival/2026.json', 'scraper/convert/to_serving.py'],
  ['site/data/festivals/outshine-lgbtq-film-festival/2026.json', 'scraper/convert/to_serving.py'],
  ['site/data/festivals/silicon-valley-jewish-film-festival/2026.json', 'scraper/convert/to_serving.py'],
  ['site/data/cities/abu-ghosh.json', 'scraper/cities/to_serving.py'],
  ['site/data/cities/akko.json', 'scraper/cities/to_serving.py'],
  ['site/data/cities/auckland.json', 'scraper/cities/to_serving.py'],
  ['site/data/cities/brighton.json', 'scraper/cities/to_serving.py'],
  ['site/data/cities/capernaum.json', 'scraper/cities/to_serving.py'],
  ['site/data/cities/edinburgh.json', 'scraper/cities/to_serving.py'],
  ['site/data/cities/haifa.json', 'scraper/cities/to_serving.py'],
  ['site/data/cities/index.json', 'scraper/cities/to_serving.py'],
  ['site/data/cities/jerusalem.json', 'scraper/cities/to_serving.py'],
  ['site/data/cities/leicester.json', 'scraper/cities/to_serving.py'],
  ['site/data/cities/melbourne.json', 'scraper/cities/to_serving.py'],
  ['site/data/cities/mitzpe-gvulot.json', 'scraper/cities/to_serving.py'],
  ['site/data/cities/north-berwick.json', 'scraper/cities/to_serving.py'],
  ['site/data/cities/tel-aviv.json', 'scraper/cities/to_serving.py'],
  ['site/data/cities/wellington.json', 'scraper/cities/to_serving.py'],
]);

// The bulky raw scrape caches are git-ignored (`.gitignore`) precisely because
// each is regenerable by the scraper that fills it. One reaches the tree only
// via a deliberate `git add -f`, so it gets its own finding: the fix is to
// un-stage it, not to delete data the site needs.
const RAW_CACHES = new Map([
  ['data/raw_pages/', 'scraper/fetch_shows.py'],
  ['data/festivals/.cache/', 'the festival fetchers under scraper/festivals/'],
]);

const rule = {
  id: 'edfringe-data-dir-is-generator-output',
  on_fail: 'block',
  description: "Every committed file under site/data/ or data/ is one of scraper/normalize.py's outputs — no hand-made files, no probe dumps, no raw cache",
  why:
    'both data trees are generator output — site/data/ is fetched by the browser and the next refresh-shows run rewrites them wholesale, so a file that the normalizer does not produce is either silently served to users or silently destroyed — and either way the thing that produced it is not in the repo',
  doc: '.claudinite/local/packs/edfringe-now/RULES.md',

  run(ctx) {
    const out = [];
    for (const f of ctx.files.filter((p) => DATA_ROOTS.some((r) => p.startsWith(r))).sort()) {
      const cache = [...RAW_CACHES].find(([prefix]) => f.startsWith(prefix));
      if (cache) {
        out.push(finding(f,
          `${f} is a git-ignored raw scrape cache — un-track it (\`git rm --cached ${f}\`); ${cache[1]} regenerates it, so it is never committed`,
        ));
        continue;
      }
      if (ALLOWED_FILES.has(f) || ALLOWED_INPUTS.has(f) || ALLOWED_OUTPUTS.has(f)) continue;
      if (ALLOWED_PATTERNS.some((re) => re.test(f))) continue;
      out.push(finding(f,
        `delete ${f} — everything under site/data/ and data/ is scraper/normalize.py's output (site/data/venues.json, site/data/normalized/*.json, site/data/days/*.json, data/normalized/shows.json), plus the named scraper inputs (${[...ALLOWED_INPUTS.keys()].join(', ')}) and the named outputs of this repo's other generators (${[...ALLOWED_OUTPUTS.keys()].join(', ')}). A probe informs the normalizer, it does not feed it: fix scraper/normalize.py and re-run it instead. If normalize.py genuinely writes ${f} now, add its shape to this check's allowlist in the same commit; if another scraper in this repo produces it, add it to ALLOWED_INPUTS or ALLOWED_OUTPUTS naming that script`,
      ));
    }
    return out;
  },
};

function finding(file, fix) {
  return {
    rule: rule.id,
    severity: rule.on_fail === 'block' ? 'blocking' : 'advisory',
    file,
    line: null,
    what: `${file} is under a data tree but is not something a generator in this repo produces`,
    why: rule.why,
    fix,
    doc: rule.doc,
  };
}

export default rule;
