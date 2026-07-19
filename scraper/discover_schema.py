#!/usr/bin/env python3
"""One-off probe: discover where a show's *subgenre* lives in the edfringe API.

Runs against the live GraphQL API (needs open network — use the discover
workflow on a GitHub runner, not a proxied web session). It:

  1. Introspects the `EventDetail` type and prints every field + its type.
  2. Lists every schema type whose name mentions "genre" (enums, objects).
  3. Lists the Query root fields (to spot a subgenre-specific query).
  4. Fetches one page of events and dumps, for a few sample shows, their
     `genre` and full `attributes` array — the likely home of subgenre tags.

This is throwaway scaffolding; delete it once the subgenre source is known.
"""

from __future__ import annotations

import json
import sys

from fetch_shows import (
    DEFAULT_PASSWORD,
    DEFAULT_USERNAME,
    GRAPHQL_URL,
    fetch_events_page,
    get_token,
    post_json,
)

INTROSPECT_TYPE = """
query T($name: String!) {
  __type(name: $name) {
    name
    kind
    enumValues { name }
    fields {
      name
      type { name kind ofType { name kind ofType { name kind } } }
    }
  }
}
"""

INTROSPECT_SCHEMA = """
query S {
  __schema {
    types { name kind }
    queryType { fields { name } }
  }
}
"""


def introspect_type(token: str, name: str) -> dict:
    data = post_json(GRAPHQL_URL, {"query": INTROSPECT_TYPE,
                                   "variables": {"name": name}}, token=token)
    return (data.get("data") or {}).get("__type") or {}


def main() -> int:
    token = get_token(DEFAULT_USERNAME, DEFAULT_PASSWORD)

    print("=" * 70)
    print("EventDetail fields")
    print("=" * 70)
    ed = introspect_type(token, "EventDetail")
    for f in ed.get("fields") or []:
        t = f.get("type") or {}
        tname = t.get("name") or (t.get("ofType") or {}).get("name") \
            or ((t.get("ofType") or {}).get("ofType") or {}).get("name")
        print(f"  {f['name']:32s} {t.get('kind'):10s} -> {tname}")

    print("\n" + "=" * 70)
    print("Schema types mentioning 'genre'")
    print("=" * 70)
    schema = post_json(GRAPHQL_URL, {"query": INTROSPECT_SCHEMA}, token=token)
    sd = (schema.get("data") or {}).get("__schema") or {}
    for t in sd.get("types") or []:
        if "genre" in (t.get("name") or "").lower():
            print(f"  {t['name']} ({t['kind']})")
            detail = introspect_type(token, t["name"])
            if detail.get("enumValues"):
                print("    enum:", [e["name"] for e in detail["enumValues"]])
            if detail.get("fields"):
                print("    fields:", [f["name"] for f in detail["fields"]])

    print("\n" + "=" * 70)
    print("Query root fields")
    print("=" * 70)
    for f in (sd.get("queryType") or {}).get("fields") or []:
        print("  ", f["name"])

    print("\n" + "=" * 70)
    print("Sample events: genre + attributes")
    print("=" * 70)
    events = fetch_events_page(token, 1, 50, "123", "ANY")
    for ev in (events.get("results") or [])[:8]:
        print(f"\n- {ev.get('title')!r}  genre={ev.get('genre')!r}")
        for a in ev.get("attributes") or []:
            print(f"    attr key={a.get('key')!r} types={a.get('attributeTypes')!r} "
                  f"value={a.get('value')!r}")
    # Also dump one full raw event so nothing is missed.
    if events.get("results"):
        print("\n--- FULL RAW EVENT[0] ---")
        print(json.dumps(events["results"][0], ensure_ascii=False, indent=1))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
