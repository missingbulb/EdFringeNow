#!/usr/bin/env python3
"""OpenStreetMap `opening_hours` strings -> rules a planner can evaluate for any date.

    parse("Apr-Oct Mo-Fr 10:00-18:00; Nov-Mar Mo-Sa 09:00-17:00; Dec 25 off")
    -> [{"dates": [["04-01", "10-31"]], "days": ["mo", ..., "fr"], "spans": [["10:00", "18:00"]]},
        {"dates": [["11-01", "03-31"]], "days": [...], "spans": [["09:00", "17:00"]]},
        {"dates": [["12-25", "12-25"]], "days": None, "spans": []}]

Each rule is `{dates, days, spans}`: `dates` a list of inclusive month-day
ranges (a range may wrap the year end) or None for every date, `days` weekdays
or None for every day, `spans` the open hours (empty: closed). `spans_on(rules,
date)` applies them in order, a later matching rule replacing the day's hours,
as the OSM specification says — seasonal hours matter here, because a planner
asks about one festival's dates and the best-known sights (castles, gardens)
publish summer and winter hours.

Read: weekday ranges and lists, month ranges and lists (`Apr-Oct,Dec`),
month-day ranges and single dates (`Apr 01-Sep 30`, `Dec 25`, `Dec 27-31`),
time spans, `off`/`closed`, `24/7`. Public-holiday rules (`PH ...`) say nothing
about an ordinary day and are dropped.

Anything else — nth weekdays (`Tu[1]`), open ends (`14:00+`), sunrise/sunset,
week numbers, `||` fallbacks, quoted comments — makes the whole string unparsed
(None). A partial read would publish a confident timetable for a place whose
real hours hang on the part that was skipped; unknown is the honest answer, and
the raw string is always served beside it.
"""

import calendar
import re
import sys
from datetime import date

DAYS = ("mo", "tu", "we", "th", "fr", "sa", "su")
MONTHS = ("Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec")
_TIME = r"(?:[01]\d|2[0-4]):[0-5]\d"
_SPAN_RE = re.compile(r"^(%s)-(%s)$" % (_TIME, _TIME))
_DAY_RE = re.compile(r"^(Mo|Tu|We|Th|Fr|Sa|Su)(?:-(Mo|Tu|We|Th|Fr|Sa|Su))?$")
_M = "(%s)" % "|".join(MONTHS)
# "Apr", "Apr-Oct", "Apr 01", "Apr 01-Sep 30", "Dec 27-31", "Dec 25"
_DATE_RE = re.compile(r"^%s(?:\s+(\d{1,2}))?(?:-(?:%s)?\s*(\d{1,2})?)?$" % (_M, _M))


def _last_day(month):
    # A non-leap year: "Feb" as a range end means through the 28th, and a
    # 29 February is read as inside any range that covers the 28th and 1 March.
    return calendar.monthrange(2027, month)[1]


def _dates(selector):
    """'Apr-Oct,Dec 25' -> [['04-01','10-31'], ['12-25','12-25']]; None when not a date selector."""
    ranges = []
    for part in (p.strip() for p in selector.split(",")):
        m = _DATE_RE.match(part)
        if not m:
            return None
        m1 = MONTHS.index(m.group(1)) + 1
        d1 = int(m.group(2)) if m.group(2) else 1
        if m.group(3) is None and m.group(4) is None:
            # A single month, or a single date.
            end = (m1, d1) if m.group(2) else (m1, _last_day(m1))
        else:
            m2 = MONTHS.index(m.group(3)) + 1 if m.group(3) else m1
            d2 = int(m.group(4)) if m.group(4) else _last_day(m2)
            end = (m2, d2)
        if not (1 <= d1 <= 31 and 1 <= end[1] <= 31):
            return None
        ranges.append(["%02d-%02d" % (m1, d1), "%02d-%02d" % end])
    return ranges


def _days(selector):
    """'Mo-Fr,Su' -> ['mo','tu','we','th','fr','su']; None when not a weekday selector."""
    out = []
    parts = selector.split(",")
    # "Sa,Su,PH": the public-holiday member says nothing about an ordinary
    # week, so it is dropped like a whole PH rule is.
    if "PH" in parts and len(parts) > 1:
        parts = [p for p in parts if p != "PH"]
    for part in parts:
        m = _DAY_RE.match(part)
        if not m:
            return None
        a = DAYS.index(m.group(1).lower())
        b = DAYS.index((m.group(2) or m.group(1)).lower())
        span = range(a, b + 1) if a <= b else list(range(a, 7)) + list(range(0, b + 1))
        out.extend(DAYS[i] for i in span if DAYS[i] not in out)
    return out


def _spans(text):
    """'09:00-12:00,13:00-17:00' -> [['09:00','12:00'], ['13:00','17:00']]; None when not spans."""
    spans = []
    for part in text.split(","):
        m = _SPAN_RE.match(part.strip())
        if not m:
            return None
        spans.append([m.group(1), m.group(2)])
    return spans


def _rule(text):
    """One `;`-separated rule -> {dates, days, spans}; None when outside the subset."""
    tokens = text.replace(": ", " ").rstrip(":").split()
    # Peel a leading date selector (it may hold spaces: "Apr 01-Sep 30"), then
    # a weekday selector, and read what is left as the hours.
    dates = None
    for n in range(len(tokens), 0, -1):
        candidate = " ".join(tokens[:n]).rstrip(":")
        if candidate[:3] in MONTHS:
            dates = _dates(candidate)
            if dates is not None:
                tokens = tokens[n:]
                break
    if dates is None and tokens and tokens[0][:3] in MONTHS:
        return None
    days = _days(tokens[0]) if tokens else None
    if days is not None:
        tokens = tokens[1:]
    rest = "".join(tokens)
    if rest in ("off", "closed"):
        spans = []
    elif rest == "" and (dates or days):
        return None  # a selector with no hours is not something we read
    else:
        spans = _spans(rest)
        if spans is None:
            return None
    return {"dates": dates, "days": days, "spans": spans}


def parse(value):
    if value is None:
        return None
    text = value.strip()
    if text == "24/7":
        return [{"dates": None, "days": None, "spans": [["00:00", "24:00"]]}]
    if not text or "||" in text or '"' in text:
        return None
    rules = []
    for part in (r.strip() for r in text.split(";")):
        if not part or part.startswith("PH"):
            continue
        rule = _rule(part)
        if rule is None:
            return None
        rules.append(rule)
    return rules or None


def _in(md, ranges):
    return any((a <= md <= b) if a <= b else (md >= a or md <= b) for a, b in ranges)


def spans_on(rules, on):
    """The open hours on date `on` ([] closed); None when the rules are unknown."""
    if rules is None:
        return None
    md, day = on.strftime("%m-%d"), DAYS[on.weekday()]
    spans = []
    for rule in rules:
        if rule["dates"] is not None and not _in(md, rule["dates"]):
            continue
        if rule["days"] is not None and day not in rule["days"]:
            continue
        spans = rule["spans"]
    return spans


def open_at(rules, on, hhmm):
    """Is the place open on date `on` at 'HH:MM'? None when unknown."""
    spans = spans_on(rules, on)
    if spans is None:
        return None
    return any(a <= hhmm < b for a, b in spans)


def selftest():
    thu, sat, sun = date(2026, 8, 13), date(2026, 8, 15), date(2026, 8, 16)
    rules = parse("Mo-Fr 09:00-17:00; Sa 10:00-16:00; Su off")
    assert spans_on(rules, thu) == [["09:00", "17:00"]] and spans_on(rules, sat) == [["10:00", "16:00"]]
    assert spans_on(rules, sun) == []
    # Later rules override earlier ones for the days they name.
    rules = parse("Mo-Su 10:00-17:00; Th 10:00-19:00")
    assert spans_on(rules, thu) == [["10:00", "19:00"]] and spans_on(rules, sat) == [["10:00", "17:00"]]
    assert spans_on(parse("08:00-22:00"), sun) == [["08:00", "22:00"]]
    assert spans_on(parse("24/7"), sun) == [["00:00", "24:00"]]
    assert spans_on(parse("Mo-Sa 11:00-18:00;Su 12:00-17:00"), sun) == [["12:00", "17:00"]]
    assert spans_on(parse("Mo-Fr 09:00-12:00,13:00-17:00"), thu) == [["09:00", "12:00"], ["13:00", "17:00"]]
    assert spans_on(parse("Fr-Mo 10:00-16:00"), sun) == [["10:00", "16:00"]]
    assert spans_on(parse("Mo,Su off; Tu-Fr 10:00-17:00; PH off"), sun) == []
    assert spans_on(parse("Mo,Su off; Tu-Fr 10:00-17:00; Sa,PH 13:00-17:00"), sat) == [["13:00", "17:00"]]

    # Seasonal hours, from the Edinburgh sights that publish them.
    castle = parse("Apr 01-Sep 30 09:30-18:00; Oct 01-Dec 23,Dec 27-31,Jan 02-Mar 31 09:30-17:00; "
                   "Dec 24 09:30-16:00; Jan 01 11:00-17:00; Dec 25-26 off")
    assert spans_on(castle, thu) == [["09:30", "18:00"]]
    assert spans_on(castle, date(2026, 11, 3)) == [["09:30", "17:00"]]
    assert spans_on(castle, date(2026, 12, 25)) == [] and spans_on(castle, date(2027, 1, 1)) == [["11:00", "17:00"]]
    garden = parse("Feb-Oct 10:00-17:00; Nov,Jan 10:00-16:00; Dec 10:00-15:30")
    assert spans_on(garden, thu) == [["10:00", "17:00"]] and spans_on(garden, date(2026, 12, 1)) == [["10:00", "15:30"]]
    church = parse("Apr-Oct Mo-Fr 10:00-18:00; Apr-Oct Sa 09:00-17:00; Apr-Oct,Nov-Mar Su 13:00-17:00; Nov-Mar Mo-Sa 09:00-17:00")
    assert spans_on(church, sat) == [["09:00", "17:00"]] and spans_on(church, sun) == [["13:00", "17:00"]]
    ship = parse("Nov-Dec,Jan-Mar 10:00-17:00; Apr-Aug 09:30-18:00; Sep 10:00-18:00; Oct 10:00-17:30")
    assert spans_on(ship, thu) == [["09:30", "18:00"]] and spans_on(ship, date(2027, 2, 2)) == [["10:00", "17:00"]]
    park = parse("Jan 01-Mar 24: 07:00-18:00; May 27-Aug 25: 07:00-22:00; Aug 26-Sep 22: 07:00-20:00")
    assert spans_on(park, thu) == [["07:00", "22:00"]] and spans_on(park, date(2026, 8, 30)) == [["07:00", "20:00"]]
    # A season the string does not mention is closed, per the specification.
    assert spans_on(park, date(2026, 4, 1)) == []
    national = parse("Mo-Su 10:00-17:00; Jan 01 12:00-17:00; Dec 25 off; Dec 26 12:00-17:00")
    assert spans_on(national, date(2026, 12, 25)) == [] and spans_on(national, thu) == [["10:00", "17:00"]]

    for unparsed in ('Mo-Fr off || "wider garden opening hours"', "Tu[1] 14:00+", "sunrise-sunset",
                     "Sa[-1] 10:00-16:00; Jun-Jul off", "week 1-53 Mo 10:00-12:00", "Apr", "", None):
        assert parse(unparsed) is None, unparsed
    assert open_at(parse("Mo-Fr 09:00-17:00"), thu, "16:59") is True
    assert open_at(parse("Mo-Fr 09:00-17:00"), thu, "17:00") is False
    assert open_at(None, thu, "12:00") is None
    print("opening_hours selftest: ok")


if __name__ == "__main__":
    if sys.argv[1:] != ["--selftest"]:
        sys.exit("usage: opening_hours.py --selftest")
    selftest()
