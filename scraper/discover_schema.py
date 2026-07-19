#!/usr/bin/env python3
"""One-off probe: inspect the edfringe API's subgenre fields and their values.

Runs against the live GraphQL API (needs open network — use the discover
workflow on a GitHub runner, not a proxied web session).

`EventDetail` exposes `subGenre: String` and `subgenres: [String]` (plus a
`subgenreOptions` query root). This probe fetches those for a page of real
shows and dumps the reference `subgenreOptions` list, so we can see the exact
values and pick what to display.

Throwaway scaffolding; delete once the format is known.
"""

from __future__ import annotations

import json

from fetch_shows import (
    DEFAULT_PASSWORD,
    DEFAULT_USERNAME,
    GRAPHQL_URL,
    get_token,
    post_json,
)

EVENTS_WITH_SUBGENRE = """
query EventsSearch($criteria: SearchCriteriaInput!) {
  events(input: $criteria) {
    total
    results { title genre subGenre subgenres }
  }
}
"""

# Introspect the return type of `subgenreOptions` so we can select its fields.
INTROSPECT_QUERY = """
query {
  __type(name: "Query") {
    fields { name type { name kind ofType { name kind ofType { name } } } }
  }
}
"""


def field_type_name(f: dict) -> str:
    t = f.get("type") or {}
    return t.get("name") or (t.get("ofType") or {}).get("name") \
        or ((t.get("ofType") or {}).get("ofType") or {}).get("name") or "?"


def introspect_type(token: str, name: str) -> dict:
    q = ("query T($n:String!){__type(name:$n){name kind "
         "enumValues{name} fields{name type{name kind ofType{name}}}}}")
    data = post_json(GRAPHQL_URL, {"query": q, "variables": {"n": name}}, token=token)
    return (data.get("data") or {}).get("__type") or {}


def main() -> int:
    token = get_token(DEFAULT_USERNAME, DEFAULT_PASSWORD)

    # 1. Figure out subgenreOptions' return type + fields, then query it.
    q = post_json(GRAPHQL_URL, {"query": INTROSPECT_QUERY}, token=token)
    qfields = ((q.get("data") or {}).get("__type") or {}).get("fields") or []
    sub_field = next((f for f in qfields if f["name"] == "subgenreOptions"), None)
    print("subgenreOptions ->", field_type_name(sub_field) if sub_field else "MISSING")
    if sub_field:
        tname = field_type_name(sub_field)
        detail = introspect_type(token, tname)
        scalar_fields = [f["name"] for f in (detail.get("fields") or [])
                         if (f.get("type") or {}).get("kind") in ("SCALAR", "NON_NULL")]
        print(f"  {tname} fields: {[f['name'] for f in detail.get('fields') or []]}")
        sel = " ".join(scalar_fields) or "value label"
        opt_q = f"query {{ subgenreOptions {{ {sel} }} }}"
        try:
            data = post_json(GRAPHQL_URL, {"query": opt_q}, token=token)
            opts = (data.get("data") or {}).get("subgenreOptions")
            print(f"  subgenreOptions ({len(opts or [])}):")
            print("   ", json.dumps(opts, ensure_ascii=False)[:4000])
        except Exception as exc:  # noqa: BLE001
            print("  subgenreOptions query failed:", exc)

    # 2. Real shows with subGenre + subgenres.
    print("\n" + "=" * 60)
    print("Sample shows: genre / subGenre / subgenres")
    print("=" * 60)
    payload = {"query": EVENTS_WITH_SUBGENRE,
               "variables": {"criteria": {"page": 1, "per": 60, "sortBy": "TITLE",
                                          "sortBySeed": "123", "recentlyAdded": "ANY"}}}
    data = post_json(GRAPHQL_URL, payload, token=token)
    if "errors" in data:
        print("ERRORS:", json.dumps(data["errors"])[:2000])
        return 1
    results = data["data"]["events"]["results"]
    n_sg = sum(1 for r in results if r.get("subGenre"))
    n_sgs = sum(1 for r in results if r.get("subgenres"))
    print(f"{len(results)} shows: {n_sg} have subGenre, {n_sgs} have subgenres\n")
    for r in results:
        print(f"- {r.get('genre'):16s} subGenre={r.get('subGenre')!r:28s} "
              f"subgenres={r.get('subgenres')!r}  | {r.get('title')}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
