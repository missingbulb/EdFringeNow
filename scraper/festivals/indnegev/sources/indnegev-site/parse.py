"""Pure transforms that turn indnegev.co.il's schedule into programme records.

No network and no filesystem, except that `--selftest` reads the committed
samples/. `fetch.py` fetches the page and its scripts and passes their text in.

What the site carries, and where:

  * `/schedule` is a Next.js page. Its server HTML renders only the first day's
    grid; the day tabs (חמישי / שישי / שבת, each with a "15.10" date) switch
    the others in on the client. So the HTML is read only for the script
    chunks it loads;
  * one of those chunks holds the whole timetable as literals: a list of sets
    `{id:"e0",name:"…",day:1,stage:"kof",start:1080,end:1120}` (optional
    `tag:"…"`, and `scheduleOnly:!0` on the side programme), the stages
    `kof:{name:"במת הקוף",short:"קוף",…}` with their column order
    `["kof","pil",…]`, and the days `1:{label:"חמישי",date:"15.10",iso:"2026-10-15",…}`.
    `start`/`end` are minutes after midnight of the set's festival day, and run
    past 1440 for sets after midnight.

The samples are the page and its programme chunk as fetch.py captured them on
2026-09-27.
"""

import json
import os
import re
import sys
from datetime import date, timedelta

HERE = os.path.dirname(os.path.abspath(__file__))
SAMPLES = os.path.join(HERE, "samples")

_SCRIPT_RE = re.compile(r'<script[^>]*\ssrc="(/_next/static/chunks/[^"?]+\.js)')
_SET_START_RE = re.compile(r'\{id:"[^"]*",name:"')
_STAGE_RE = re.compile(r'([a-z]+):\{name:"((?:[^"\\]|\\.)*)",short:"((?:[^"\\]|\\.)*)"')
_STAGE_ORDER_RE = re.compile(r'=\[((?:"[a-z]+",?)+)\],[a-zA-Z_$]+=\{[a-z]+:\{name:')
_DAY_RE = re.compile(r'(\d+):\{label:"((?:[^"\\]|\\.)*)",date:"(\d{1,2}\.\d{1,2})",iso:"(\d{4}-\d{2}-\d{2})"')
_NUMBER_RE = re.compile(r"-?\d+(?:e\d+)?")
_TAB_RE = re.compile(r'tabLabel[^>]*>([^<]+)</span><span[^>]*tabDate[^>]*>(\d{1,2}\.\d{1,2})</span>')


def script_paths(page):
    """The chunk paths a page loads, in order, without their cache-busting query."""
    return list(dict.fromkeys(_SCRIPT_RE.findall(page)))


def has_programme(js):
    return _SET_START_RE.search(js) is not None and _DAY_RE.search(js) is not None


def _js_string(text, i):
    """The JS string literal opening at text[i] (a double quote) -> (value, index after it)."""
    j = i + 1
    while text[j] != '"':
        j += 2 if text[j] == "\\" else 1
    body = text[i + 1:j]
    body = re.sub(r"\\x([0-9a-fA-F]{2})", lambda m: "\\u00" + m.group(1), body)
    return json.loads('"' + body + '"'), j + 1


def _object(text, i):
    """The flat object literal opening at text[i] ('{') -> (dict, index after it).

    Values are strings, integers or the minifier's booleans (`!0`, `!1`); that
    is every value a set carries, and anything else is refused.
    """
    record, j = {}, i + 1
    while text[j] != "}":
        m = re.compile(r"([A-Za-z_$][\w$]*):").match(text, j)
        if not m:
            raise ValueError("unexpected %r in a set literal" % text[j:j + 40])
        key, j = m.group(1), m.end()
        if text[j] == '"':
            value, j = _js_string(text, j)
        elif text.startswith("!0", j) or text.startswith("!1", j):
            value, j = text[j + 1] == "0", j + 2
        else:
            n = _NUMBER_RE.match(text, j)
            if not n:
                raise ValueError("unexpected value %r for %s" % (text[j:j + 40], key))
            # The minifier writes 1000 as `1e3`.
            value, j = int(float(n.group(0))), n.end()
        record[key] = value
        if text[j] == ",":
            j += 1
    return record, j + 1


_HIDE_RE = re.compile(r'let ([\w$]+)=([\w$]+)=>([^\n]+?),[\w$]+=\[\{id:"')
_TERM_RE = re.compile(r'^(?:(?P<lit>"[^"]*"|-?\d+)(?P<lop>===|!==)(?P<lvar>[\w$]+)\.(?P<lkey>\w+)'
                      r'|(?P<rvar>[\w$]+)\.(?P<rkey>\w+)(?P<rop>===|!==|<=|>=|<|>)(?P<rlit>"[^"]*"|-?\d+))$')


def hiding_rule(js):
    """The predicate the chunk filters its set list through before showing it.

    The list is written `n=[…].filter(a=>!d(a))`, with `d` a disjunction of
    conjunctions of comparisons on a set's fields, e.g.
    `"adama"===a.stage||1===a.day&&"raket"===a.stage&&a.start<1320`. Returns it
    as `[[(key, op, value), …], …]` (any clause true hides the set), or [] when
    the list is not filtered. Anything outside that grammar is refused rather
    than guessed at.
    """
    m = _HIDE_RE.search(js)
    if not m:
        return []
    name, arg, body = m.groups()
    if not re.search(r"\]\.filter\(([\w$]+)=>!%s\(\1\)\)" % re.escape(name), js):
        return []
    rule = []
    for clause in body.split("||"):
        terms = []
        for term in clause.split("&&"):
            t = _TERM_RE.match(term.strip())
            if not t or (t.group("lvar") or t.group("rvar")) != arg:
                raise ValueError("unreadable hiding rule term %r in %r" % (term, body))
            if t.group("lit"):
                lit, op, key = t.group("lit"), t.group("lop"), t.group("lkey")
            else:
                lit, op, key = t.group("rlit"), t.group("rop"), t.group("rkey")
            terms.append((key, op, json.loads(lit)))
        rule.append(terms)
    return rule


_OPS = {
    "===": lambda a, b: a == b, "!==": lambda a, b: a != b,
    "<": lambda a, b: a is not None and a < b, ">": lambda a, b: a is not None and a > b,
    "<=": lambda a, b: a is not None and a <= b, ">=": lambda a, b: a is not None and a >= b,
}


def hidden(record, rule):
    return any(all(_OPS[op](record.get(key), value) for key, op, value in clause) for clause in rule)


def parse_programme(js):
    """The programme chunk -> {days, stages, stageOrder, sets} in the site's own vocabulary."""
    sets = []
    for m in _SET_START_RE.finditer(js):
        record, _ = _object(js, m.start())
        sets.append(record)
    stages = {code: {"name": _js_string('"%s"' % name, 0)[0], "short": _js_string('"%s"' % short, 0)[0]}
              for code, name, short in _STAGE_RE.findall(js)}
    order = _STAGE_ORDER_RE.search(js)
    days = {int(n): {"label": _js_string('"%s"' % label, 0)[0], "date": d, "iso": iso}
            for n, label, d, iso in _DAY_RE.findall(js)}
    ids = [s["id"] for s in sets]
    if len(set(ids)) != len(ids):
        raise ValueError("the programme repeats set ids")
    for s in sets:
        for key in ("name", "day", "stage", "start", "end"):
            if key not in s:
                raise ValueError("set %s has no %s" % (s.get("id"), key))
        if s["day"] not in days:
            raise ValueError("set %s is on day %r, which the programme does not date" % (s["id"], s["day"]))
        if s["stage"] not in stages:
            raise ValueError("set %s is on stage %r, which the programme does not name" % (s["id"], s["stage"]))
    rule = hiding_rule(js)
    for s in sets:
        s["shown"] = not hidden(s, rule)
    return {
        "days": days,
        "stages": stages,
        "stageOrder": json.loads("[%s]" % order.group(1)) if order else None,
        "sets": sets,
    }


def schedule_tabs(page):
    """The day tabs the server HTML renders: [(label, "15.10")]."""
    return [(label.strip(), d) for label, d in _TAB_RE.findall(page)]


def wall_clock(day_iso, minutes):
    """A festival day and minutes after its midnight -> (date, "HH:MM"), rolling past midnight."""
    when = date.fromisoformat(day_iso) + timedelta(days=minutes // 1440)
    minutes %= 1440
    return when.isoformat(), "%02d:%02d" % (minutes // 60, minutes % 60)


def _sample(name):
    with open(os.path.join(SAMPLES, name), encoding="utf-8") as handle:
        return handle.read()


def selftest():
    page, js = _sample("schedule.html"), _sample("programme-chunk.txt")

    paths = script_paths(page)
    assert "/_next/static/chunks/520-3dd8d178ec72bfd6.js" in paths, paths
    assert all("?" not in p for p in paths)
    assert has_programme(js)
    assert not has_programme("self.webpackChunk_N_E=[]")

    tabs = schedule_tabs(page)
    assert tabs == [("חמישי", "15.10"), ("שישי", "16.10"), ("שבת", "17.10")], tabs

    programme = parse_programme(js)
    assert programme["days"] == {
        1: {"label": "חמישי", "date": "15.10", "iso": "2026-10-15"},
        2: {"label": "שישי", "date": "16.10", "iso": "2026-10-16"},
        3: {"label": "שבת", "date": "17.10", "iso": "2026-10-17"},
    }, programme["days"]
    assert programme["stageOrder"] == ["kof", "pil", "inditronics", "raket", "soundsystem"], programme["stageOrder"]
    assert programme["stages"]["kof"] == {"name": "במת הקוף", "short": "קוף"}
    assert programme["stages"]["adama"] == {"name": "מתחם אדמה", "short": "אדמה"}
    sets = programme["sets"]
    assert len(sets) == 135, len(sets)
    assert sets[0] == {"id": "e0", "name": "אתי רומנו", "day": 1, "stage": "kof", "start": 1080, "end": 1120, "shown": True}
    assert sets[3] == {"id": "e3", "name": "AVIV SIEGAL", "day": 1, "stage": "inditronics", "start": 1140,
                       "end": 1290, "tag": "SPACE JAM TAKEOVER", "shown": True}
    assert sets[4]["scheduleOnly"] is True and sets[4]["stage"] == "adama" and sets[4]["shown"] is False
    # Thursday's early Raket sets are hidden, its later ones shown.
    raket_thu = [(s["start"], s["shown"]) for s in sets if s["day"] == 1 and s["stage"] == "raket"]
    assert (1260, False) in raket_thu and any(shown for start, shown in raket_thu if start >= 1320), raket_thu
    assert not any(s["shown"] for s in sets if s["stage"] == "adama")
    assert sets[-1]["end"] == 1080 and any(s["end"] == 1000 for s in sets)

    assert hiding_rule('let d=a=>"adama"===a.stage||1===a.day&&"raket"===a.stage&&a.start<1320,n=[{id:"e0"}].filter(a=>!d(a))') == [
        [("stage", "===", "adama")], [("day", "===", 1), ("stage", "===", "raket"), ("start", "<", 1320)]]
    assert hiding_rule('n=[{id:"e0"}]') == []
    try:
        hiding_rule('let d=a=>a.name.startsWith("x"),n=[{id:"e0"}].filter(a=>!d(a))')
        raise AssertionError("an unreadable rule must be refused")
    except ValueError:
        pass
    assert {s["day"] for s in sets} == {1, 2, 3}
    assert any(s["start"] >= 1440 for s in sets), "expected sets after midnight"

    assert wall_clock("2026-10-15", 1080) == ("2026-10-15", "18:00")
    assert wall_clock("2026-10-15", 1440) == ("2026-10-16", "00:00")
    assert wall_clock("2026-10-17", 1530) == ("2026-10-18", "01:30")

    record, end = _object('{id:"x",name:"a \\"b\\" \\xe9",day:2,stage:"kof",start:5,end:-1,flag:!1}', 0)
    assert record == {"id": "x", "name": 'a "b" é', "day": 2, "stage": "kof", "start": 5, "end": -1, "flag": False}
    print("indnegev-site parse selftest ok (%d sets)" % len(sets))


if __name__ == "__main__":
    if sys.argv[1:] != ["--selftest"]:
        sys.exit("usage: parse.py --selftest")
    selftest()
