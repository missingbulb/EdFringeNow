#!/usr/bin/env python3
"""Convert one festival edition's raw into its serving block, or prove the committed ones current.

    python3 scraper/convert/to_serving.py <festival-id> <edition>   # write that edition
    python3 scraper/convert/to_serving.py --check                   # re-derive everything, diff, exit 1 on drift
    python3 scraper/convert/to_serving.py --selftest

Writing converts exactly the edition asked for: it assembles the block from all
of that edition's sources (merge.py), validates it (schema.py) and refuses to
write anything if a single problem is found. Only then are its files replaced,
each atomically: `site/data/festivals/<festival>/<edition>.json`, the registry
`site/data/festivals/index.json` (rebuilt from every festival.toml), and the
edition's declared legacy file, if any. No other festival's or edition's data
is read or written.

`--check` is the gate verify.sh runs: every committed serving file must be
exactly what the committed raw converts to today, and nothing may sit under
site/data/festivals/ that no edition produces.
"""

import json
import os
import shutil
import sys
import tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
sys.path.insert(0, os.path.join(os.path.dirname(HERE), "festivals"))
import merge
import registry
import schema

SERVING_ROOT = os.path.join(registry.REPO_ROOT, "site", "data", "festivals")
INDEX = os.path.join(SERVING_ROOT, "index.json")


class ConvertError(Exception):
    pass


def serving_path(festival_id, edition_id):
    return os.path.join(SERVING_ROOT, festival_id, "%s.json" % edition_id)


def data_url(festival_id, edition_id):
    """The URL the browser fetches, root-relative (site/ is the web root)."""
    return "/data/festivals/%s/%s.json" % (festival_id, edition_id)


def render(obj):
    # Written through as the source's own script: an escaped file is valid JSON
    # but unreviewable in a diff, which is where this data is read.
    return json.dumps(obj, ensure_ascii=False, indent=1) + "\n"


def build_index(festivals):
    entries = []
    for fid in sorted(festivals):
        f = festivals[fid]
        entries.append({
            "id": fid,
            "name": f["name"],
            "nameLocal": f.get("name_local"),
            "city": f["city"],
            "country": f["country"],
            "lat": f["lat"],
            "lng": f["lng"],
            "timezone": f["timezone"],
            "lang": f["lang"],
            "dir": f["dir"],
            "kind": f["kind"],
            "defaultGenre": f["default_genre"],
            "site": f["site"],
            "editions": [
                {
                    "id": ed["id"],
                    "ordinal": ed["ordinal"],
                    "firstDate": ed["first"],
                    "lastDate": ed["last"],
                    # Declared but not yet fetched: listed, with nothing to load.
                    "dataUrl": data_url(fid, ed["id"]) if merge.edition_ready(f, ed["id"]) else None,
                }
                for ed in sorted(f["edition"], key=lambda e: e["id"])
            ],
        })
    return {"v": schema.VERSION, "festivals": entries}


def build_edition(festival, edition_id):
    """{absolute path: text} for one edition — raises before returning anything invalid."""
    block, _ = merge.assemble(festival, edition_id)
    problems = schema.validate(block)
    if problems:
        raise ConvertError(
            "%s %s does not validate; nothing written:\n  %s"
            % (festival["id"], edition_id, "\n  ".join(problems[:40]))
        )
    outputs = {serving_path(festival["id"], edition_id): render(block)}
    legacy = registry.edition(festival, edition_id).get("legacy")
    if legacy:
        writer = merge.load_module(legacy["writer"], "build")
        outputs[os.path.join(registry.REPO_ROOT, legacy["path"])] = render(writer.build(block))
    return outputs


def atomic_write(path, text):
    """Write beside the target, then rename over it: a reader never sees half a file."""
    os.makedirs(os.path.dirname(path), exist_ok=True)
    fd, tmp = tempfile.mkstemp(dir=os.path.dirname(path), prefix=".tmp-", suffix=".json")
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as handle:
            handle.write(text)
        os.replace(tmp, path)
    except BaseException:
        if os.path.exists(tmp):
            os.unlink(tmp)
        raise


def write(festival_id, edition_id):
    festivals = registry.load_all()
    if festival_id not in festivals:
        raise ConvertError("unknown festival %r (have %s)" % (festival_id, sorted(festivals)))
    festival = festivals[festival_id]
    registry.edition(festival, edition_id)
    outputs = build_edition(festival, edition_id)
    outputs[INDEX] = render(build_index(festivals))
    # Everything is built and validated before the first byte is written.
    for path, text in outputs.items():
        atomic_write(path, text)
        print("wrote %s" % os.path.relpath(path, registry.REPO_ROOT))


def expected_outputs():
    festivals = registry.load_all()
    outputs = {INDEX: render(build_index(festivals))}
    for festival in festivals.values():
        for ed in festival["edition"]:
            if merge.edition_ready(festival, ed["id"]):
                outputs.update(build_edition(festival, ed["id"]))
    return outputs


def check():
    try:
        expected = expected_outputs()
    except (ConvertError, merge.MergeError, registry.RegistryError) as error:
        print("festival data: %s" % error, file=sys.stderr)
        return 1
    committed = set()
    for root, _, files in os.walk(SERVING_ROOT):
        committed.update(os.path.join(root, f) for f in files)
    problems = []
    for path, text in sorted(expected.items()):
        rel = os.path.relpath(path, registry.REPO_ROOT)
        if not os.path.exists(path):
            problems.append("%s is missing — run to_serving.py for its edition" % rel)
            continue
        with open(path, encoding="utf-8") as handle:
            if handle.read() != text:
                problems.append("%s differs from what its committed raw converts to" % rel)
    for path in sorted(committed - set(expected)):
        problems.append("%s is not produced by any declared edition" % os.path.relpath(path, registry.REPO_ROOT))
    if problems:
        print("festival data drift:\n  " + "\n  ".join(problems), file=sys.stderr)
        print("regenerate with: python3 scraper/convert/to_serving.py <festival> <edition>", file=sys.stderr)
        return 1
    print("festival data: %d serving file(s) match their raw" % len(expected))
    return 0


def selftest():
    schema.selftest()
    merge.selftest()
    scratch = tempfile.mkdtemp()
    try:
        target = os.path.join(scratch, "a", "b.json")
        atomic_write(target, "one\n")

        try:
            atomic_write(target, None)  # a failed write must leave the previous file whole
        except TypeError:
            pass
        with open(target, encoding="utf-8") as handle:
            assert handle.read() == "one\n"
        assert os.listdir(os.path.dirname(target)) == ["b.json"], os.listdir(os.path.dirname(target))
    finally:
        shutil.rmtree(scratch)
    print("convert to_serving selftest: ok")


def main(argv):
    if argv == ["--check"]:
        return check()
    if argv == ["--selftest"]:
        selftest()
        return 0
    if len(argv) == 2 and not argv[0].startswith("-"):
        try:
            write(argv[0], argv[1])
        except (ConvertError, merge.MergeError, registry.RegistryError) as error:
            print(error, file=sys.stderr)
            return 1
        return 0
    print(__doc__, file=sys.stderr)
    return 2


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
