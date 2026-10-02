#!/usr/bin/env python3
"""Give every [[edition]] that names no tool set the festival's current one.

    python3 scraper/festivals/migrate_edition_tools.py            # every festival.toml
    python3 scraper/festivals/migrate_edition_tools.py <dir>...   # just these festival folders

Mechanical and idempotent: an edition that already says `sources = [...]` is left
alone, and one that does not gets every [[source]] id of its festival, in
festival.toml order, inserted as the last key of its table. Comments and layout
are kept, so it is safe to re-run over a festival written to the older contract.
Then it rewrites the editions plan (registry.py --write) the tasks read.

A festival whose editions really use different tools is edited by hand after
this: the script only states what was true before tool sets existed.
"""

import os
import re
import subprocess
import sys
import tomllib

HERE = os.path.dirname(os.path.abspath(__file__))

TABLE_RE = re.compile(r"^\s*\[")
KEY_RE = re.compile(r"^\s*[A-Za-z0-9_-]+\s*=")


def migrate_text(text):
    """The festival.toml text with a tool set on every edition lacking one."""
    festival = tomllib.loads(text)
    ids = [src["id"] for src in festival.get("source") or []]
    line = "sources = [%s]\n" % ", ".join('"%s"' % i for i in ids)
    lines = text.splitlines(keepends=True)
    out, block = [], None
    for raw in lines + [None]:
        starts_table = raw is None or TABLE_RE.match(raw)
        if starts_table and block is not None:
            out.extend(_with_tools(block, line))
            block = None
        if raw is None:
            break
        if raw.strip() == "[[edition]]":
            block = [raw]
        elif block is not None:
            block.append(raw)
        else:
            out.append(raw)
    result = "".join(out)
    if result != text:
        tomllib.loads(result)
    return result


def _with_tools(block, line):
    if any(re.match(r"^\s*sources\s*=", raw) for raw in block):
        return block
    last_key = max(i for i, raw in enumerate(block) if i == 0 or KEY_RE.match(raw))
    if not block[last_key].endswith("\n"):
        block[last_key] += "\n"
    return block[: last_key + 1] + [line] + block[last_key + 1:]


def selftest():
    before = (
        'id = "x"\n\n# dates from the site\n[[edition]]\nid = "2026"\nformat = "block"\n'
        'first = "2026-01-01"\nlast = "2026-01-02"\n\n# next year\n[[edition]]\nid = "2027"\n'
        'format = "block"\nfirst = "2027-01-01"\nlast = "2027-01-02"\nsources = ["a"]\n\n'
        '# the site\n[[source]]\nid = "a"\n\n[[source]]\nid = "b"\n'
    )
    after = migrate_text(before)
    parsed = tomllib.loads(after)
    assert parsed["edition"][0]["sources"] == ["a", "b"], parsed["edition"][0]
    assert parsed["edition"][1]["sources"] == ["a"], "an edition with a tool set is left alone"
    assert "# next year\n[[edition]]" in after, "a comment before the next table stays with it"
    assert migrate_text(after) == after, "idempotent"
    print("migrate_edition_tools selftest ok")


def main(argv):
    if argv == ["--selftest"]:
        selftest()
        return 0
    folders = argv or sorted(
        os.path.join(HERE, name) for name in os.listdir(HERE)
        if os.path.isfile(os.path.join(HERE, name, "festival.toml"))
    )
    for folder in folders:
        path = os.path.join(folder, "festival.toml")
        with open(path, encoding="utf-8") as handle:
            text = handle.read()
        result = migrate_text(text)
        if result != text:
            with open(path, "w", encoding="utf-8") as handle:
                handle.write(result)
            print("tool sets added: %s" % os.path.relpath(path))
    return subprocess.run([sys.executable, os.path.join(HERE, "registry.py"), "--write"]).returncode


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
