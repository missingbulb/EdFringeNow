"""Pure transforms over the Tattoo's ticketing API (book.edintattoo.co.uk's backend).

No network and no filesystem: fetch.py does the talking and hands the decoded
JSON here, which is what lets `--selftest` prove the shape offline.

What the API carries, as read on 2026-09-25 (api.book.edintattoo.co.uk, a
SecuTix-backed gateway the booking site's own bundle calls):

  * `GET /catalog` lists the seasons on sale; the show is the `SINGLE_ENTRY`
    product named "<year> Tattoo - <title>" (code `<yy>TAT`), with every
    performance's id, local start (ISO, +01:00) and seat-category prices;
  * `GET /event/<productId>/availability` gives per performance the seats left,
    an `availabilityLevel`, and the cheapest and dearest price on sale;
  * amounts are integers in thousandths of a pound (a £1 donation is 1000).

A past season drops out of the catalogue and its product and performances stop
resolving, so only the season on sale can be fetched.
"""

import html as _html
import re
import sys

# "2027 Tattoo - The Same Heart Beat"; not "2027 Tattoo Backstage Tours", a
# ticketed product of its own with performances of its own.
SHOW_NAME_RE = re.compile(r"^(\d{4}) Tattoo - ")


def clean_text(raw):
    if raw is None:
        return ""
    text = re.sub(r"<(br|/p|/div)\s*/?>", "\n", raw)
    text = re.sub(r"<[^>]+>", " ", text)
    text = _html.unescape(text).replace("\xa0", " ")
    lines = [re.sub(r"[ \t\r]+", " ", line).strip() for line in text.split("\n")]
    return "\n".join(line for line in lines if line)


def find_show(catalog, year):
    """The one ticketed show product of `year` in the catalogue, or None."""
    found = [
        product
        for season in catalog.get("seasons", [])
        for product in season.get("products", [])
        if product.get("productFamilyType") == "SINGLE_ENTRY"
        and (SHOW_NAME_RE.match(product.get("externalName") or "") or [None, None])[1] == str(year)
        and product.get("event")
    ]
    if len(found) > 1:
        raise ValueError("more than one %s show product: %s" % (year, [p["code"] for p in found]))
    return found[0] if found else None


def other_shows(catalog):
    """The show products the catalogue does list, for a refusal message."""
    return sorted(
        p.get("externalName")
        for s in catalog.get("seasons", [])
        for p in s.get("products", [])
        if p.get("productFamilyType") == "SINGLE_ENTRY"
    )


def local_date_start(iso):
    """("2027-08-14T18:15:00+01:00") -> ("2027-08-14", "18:15").

    The API writes Edinburgh wall clock, with the BST offset or none at all; the
    digits are the local time either way, so nothing is converted.
    """
    m = re.match(r"^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})", iso or "")
    if not m:
        raise ValueError("unreadable start %r" % (iso,))
    return m.group(1), "%s:%s" % (m.group(2), m.group(3))


def performances(product, availability):
    """The show's performances in the API's own vocabulary, one record each."""
    by_id = {a["performanceId"]: a for a in availability}
    records = []
    for perf in product["event"]["performances"]:
        day, start = local_date_start(perf["start"])
        avail = by_id.get(perf["id"])
        amounts = [p["amount"] for p in perf.get("prices", []) if p.get("amount") is not None]
        records.append({
            "id": perf["id"],
            "code": perf["code"],
            "date": day,
            "start": start,
            "name": perf.get("externalName"),
            "priceAmounts": sorted(set(amounts)),
            # Unknown stays null: a performance the availability call does not
            # list has no published level, which is not the same as none left.
            "availabilityLevel": avail["availabilityLevel"] if avail else None,
            "availability": avail["availability"] if avail else None,
            "minPrice": avail["minPrice"] if avail else None,
            "maxPrice": avail["maxPrice"] if avail else None,
        })
    records.sort(key=lambda r: (r["date"], r["start"]))
    return records


# --- self-test: fragments copied from the live responses of 2026-09-25 -------

SAMPLE_CATALOG = {"seasons": [
    {"products": [
        {"id": 10229369422709, "code": "CAN_INS", "productFamilyType": "SERVICE",
         "externalName": "Ticket Protection", "event": None},
        {"id": 10229369303405, "code": "27TAT", "productFamilyType": "SINGLE_ENTRY",
         "externalName": "2027 Tattoo - The Same Heart Beat",
         "externalDescription": "<div class=\"component-rich-text\">\r\n<div class=\"rich-text-content\">\r\n"
                                "<p>The 2027 show takes place from 6-28 August 2027.&nbsp;</p>\r\n",
         "event": {"performances": [
             {"id": 10229370677647, "code": "27TAT", "start": "2027-08-14T18:15:00+01:00",
              "externalName": "The Same Heart Beat (filmed for broadcast at a later date)",
              "prices": [{"seatCatId": 10229369630204, "amount": 121000, "minQty": 2},
                         {"seatCatId": 10229369215372, "amount": 68000, "minQty": 1}]},
             {"id": 10229370677626, "code": "27TAT", "start": "2027-08-06T21:30:00+01:00",
              "externalName": None, "prices": []},
         ]}},
        {"id": 10229369210680, "code": "BST", "productFamilyType": "SINGLE_ENTRY",
         "externalName": "2027 Tattoo Backstage Tours",
         "event": {"performances": [{"id": 10229369210700, "code": "BST", "start": "2027-08-07T10:00:00+01:00"}]}},
    ]},
    {"products": [{"id": 10229021739164, "code": "26PROG", "productFamilyType": "SERVICE",
                   "externalName": "2026 Programme: A Call to Gather", "event": None}]},
]}
SAMPLE_AVAILABILITY = [
    {"performanceId": 10229370677647, "eventName": "The Same Heart Beat (filmed for broadcast at a later date)",
     "start": "2027-08-14T18:15:00", "availabilityLevel": "GOOD", "minPrice": 47000, "maxPrice": 830000,
     "availability": 4776},
]


def selftest():
    assert local_date_start("2027-08-14T18:15:00+01:00") == ("2027-08-14", "18:15")
    assert local_date_start("2027-08-06T21:30:00") == ("2027-08-06", "21:30")
    show = find_show(SAMPLE_CATALOG, 2027)
    assert show["code"] == "27TAT", show
    # The 2026 season is still in the catalogue, but only as a programme to
    # buy: no show product, so a 2026 fetch has nothing to read.
    assert find_show(SAMPLE_CATALOG, 2026) is None
    assert other_shows(SAMPLE_CATALOG) == ["2027 Tattoo - The Same Heart Beat", "2027 Tattoo Backstage Tours"]
    assert clean_text(show["externalDescription"]) == "The 2027 show takes place from 6-28 August 2027."

    perfs = performances(show, SAMPLE_AVAILABILITY)
    assert [(p["date"], p["start"]) for p in perfs] == [("2027-08-06", "21:30"), ("2027-08-14", "18:15")]
    assert perfs[1]["priceAmounts"] == [68000, 121000] and perfs[1]["minPrice"] == 47000, perfs[1]
    assert perfs[0]["availabilityLevel"] is None and perfs[0]["minPrice"] is None, perfs[0]
    print("edinburgh-tattoo ticketing-api parse selftest: ok")


if __name__ == "__main__":
    if sys.argv[1:] != ["--selftest"]:
        sys.exit("usage: parse.py --selftest")
    selftest()
