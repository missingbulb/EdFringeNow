#!/usr/bin/env python3
"""Write each country's public holidays into site/holidays/<CC>.json.

The PlanNG year strip marks the holidays where the reader lives (spec
section 31). The dates and names come from the `holidays` package, run here
once rather than shipped: the page reads a small file per country instead.

    python3 -m pip install holidays
    python3 scripts/build-holidays.py 2026 2030

Run it again with later years when product/requirements' 31.4 goes red, a
year before the files would run out.
"""

import json
import sys
from datetime import date
from pathlib import Path

import holidays

OUT = Path(__file__).resolve().parent.parent / "site" / "holidays"
# The languages the page speaks (site/planNG/i18n/). English is every file's
# fallback; the others are kept only where the package translates them.
# The weekend's days, by name, so the page can tell a holiday that makes a
# long weekend from one that stands alone (spec 31.6).
DAY_NAMES = ("mon", "tue", "wed", "thu", "fri", "sat", "sun")
PAGE_LANGUAGES = {"en": ("en_US", "en_GB", "en"), "he": ("he",), "ru": ("ru",), "ja": ("ja",)}


def names(code, years, supported):
    """{date: {lang: name}} for one country, in each page language it has."""
    out = {}
    for lang, candidates in PAGE_LANGUAGES.items():
        pick = next((c for c in candidates if c in supported), None)
        if pick is None and lang != "en":
            continue
        cal = holidays.country_holidays(code, years=years, language=pick) if pick else holidays.country_holidays(code, years=years)
        for day, name in cal.items():
            out.setdefault(day, {})[lang] = name
    return out


def main(first, last):
    years = range(first, last + 1)
    OUT.mkdir(parents=True, exist_ok=True)
    written = 0
    for code in sorted(holidays.list_supported_countries()):
        if len(code) != 2:
            continue
        cls = holidays.country_holidays(code).__class__
        supported = getattr(cls, "supported_languages", ()) or ()
        by_day = names(code, years, supported)
        weekend = sorted(holidays.country_holidays(code).weekend)
        doc = {
            "country": code,
            "weekend": [DAY_NAMES[d] for d in weekend],
            "covers": {"from": date(first, 1, 1).isoformat(), "to": date(last, 12, 31).isoformat()},
            "source": f"holidays {holidays.__version__}",
            "holidays": [{"date": d.isoformat(), "name": by_day[d]} for d in sorted(by_day)],
        }
        (OUT / f"{code}.json").write_text(json.dumps(doc, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
        written += 1
    print(f"wrote {written} countries, {first}-{last}, to {OUT}")


if __name__ == "__main__":
    main(int(sys.argv[1]), int(sys.argv[2]))
