#!/usr/bin/env python3
"""One-off probe: dump ONE show with every GraphQL field, focused on pricing.

Fetches a single event by slug with an introspection-built selection covering
every scalar/enum field of EventDetail and its nested objects (two levels), then
chases the pricing surface: the `performancePrices` query for individual
performances (per-seat / price-band amounts), plus the `priceTypes` reference.

Needs open network — run via the probe workflow on a GitHub runner. Throwaway
scaffolding; delete once reviewed.

Usage: python3 probe_show.py [slug]   (default: daniel-sloss-bitter)
"""

from __future__ import annotations

import json
import sys

from fetch_shows import (
    DEFAULT_PASSWORD,
    DEFAULT_USERNAME,
    GRAPHQL_URL,
    get_token,
    post_json,
)

DEFAULT_SLUG = "daniel-sloss-bitter"

_TYPE_CACHE: dict[str, dict] = {}


def introspect_type(token: str, name: str) -> dict:
    if name in _TYPE_CACHE:
        return _TYPE_CACHE[name]
    q = """
    query T($n:String!){
      __type(name:$n){
        name kind
        enumValues{ name }
        fields{
          name
          args{ name type{ ...TR } }
          type{ ...TR }
        }
      }
    }
    fragment TR on __Type { name kind ofType{ name kind ofType{ name kind ofType{ name kind } } } }
    """
    data = post_json(GRAPHQL_URL, {"query": q, "variables": {"n": name}}, token=token)
    t = (data.get("data") or {}).get("__type") or {}
    _TYPE_CACHE[name] = t
    return t


def base_type(type_ref: dict) -> dict:
    t = type_ref or {}
    while t.get("ofType"):
        t = t["ofType"]
    return {"name": t.get("name"), "kind": t.get("kind")}


def build_selection(token: str, type_name: str, depth: int, path: tuple = ()) -> str:
    """A GraphQL selection of every scalar/enum field of a type, recursing into
    object fields up to `depth` levels (cycle-guarded)."""
    t = introspect_type(token, type_name)
    parts: list[str] = []
    for f in t.get("fields") or []:
        if f.get("args"):
            continue  # skip fields that need arguments
        b = base_type(f.get("type"))
        if b["kind"] in ("SCALAR", "ENUM"):
            parts.append(f["name"])
        elif b["kind"] == "OBJECT" and depth > 0 and b["name"] not in path:
            sub = build_selection(token, b["name"], depth - 1, path + (type_name,))
            if sub.strip():
                parts.append(f"{f['name']} {{ {sub} }}")
    return " ".join(parts)


def query_field_args(token: str, field_name: str) -> list[dict]:
    q = introspect_type(token, "Query")
    for f in q.get("fields") or []:
        if f["name"] == field_name:
            return [{"name": a["name"], "type": base_type(a["type"])} for a in f.get("args") or []]
    return []


def query_field_return(token: str, field_name: str) -> dict:
    q = introspect_type(token, "Query")
    for f in q.get("fields") or []:
        if f["name"] == field_name:
            return base_type(f["type"])
    return {}


def hr(title: str) -> None:
    print("\n" + "=" * 72 + f"\n{title}\n" + "=" * 72)


def main() -> int:
    slug = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_SLUG
    token = get_token(DEFAULT_USERNAME, DEFAULT_PASSWORD)

    # --- Pricing surface: how do you call it, and what comes back? --------------
    hr("Query args for the pricing-relevant roots")
    for fname in ("event", "performance", "performancePrices", "performancePrice",
                  "priceTypes", "transactionFeeInfo"):
        args = query_field_args(token, fname)
        ret = query_field_return(token, fname)
        if args or ret:
            print(f"  {fname}(", ", ".join(f"{a['name']}:{a['type']['name']}" for a in args),
                  f") -> {ret.get('name')} [{ret.get('kind')}]")

    for pt in ("PerformancePrice", "PriceBand", "Price", "SeatPrice", "TicketPrice",
               "PerformancePriceDetail"):
        t = introspect_type(token, pt)
        if t:
            print(f"  type {pt} fields:", [f["name"] for f in t.get("fields") or []])

    # priceTypes reference list.
    ret = query_field_return(token, "priceTypes")
    if ret.get("name"):
        sel = build_selection(token, ret["name"], 0) or "value label"
        try:
            data = post_json(GRAPHQL_URL, {"query": f"query{{ priceTypes {{ {sel} }} }}"}, token=token)
            print("\n  priceTypes:", json.dumps((data.get("data") or {}).get("priceTypes"), ensure_ascii=False)[:2000])
        except Exception as exc:  # noqa: BLE001
            print("  priceTypes query failed:", exc)

    # --- The show itself, every field ------------------------------------------
    hr(f"Full event dump: {slug}")
    ev_args = query_field_args(token, "event")
    print("  event args:", [(a["name"], a["type"]["name"]) for a in ev_args])
    selection = build_selection(token, "EventDetail", 2)

    # The site's URLs are slugs, so fetch by id with isSlug:true.
    event = None
    q = f"query($v:String!){{ event(id:$v, isSlug:true){{ {selection} }} }}"
    try:
        data = post_json(GRAPHQL_URL, {"query": q, "variables": {"v": slug}}, token=token)
        if data.get("errors"):
            print("  event() errors:", json.dumps(data["errors"])[:2000])
        event = (data.get("data") or {}).get("event")
    except Exception as exc:  # noqa: BLE001
        print("  event() request failed:", exc)

    if not event:
        print("  Could not locate the show. Dumping nothing.")
        return 1

    print(json.dumps(event, ensure_ascii=False, indent=1))

    # --- Per-performance pricing ------------------------------------------------
    hr("performancePrices per performance")
    pp_args = query_field_args(token, "performancePrices")
    pp_ret = query_field_return(token, "performancePrices")
    print("  performancePrices args:", [(a["name"], a["type"]["name"], a["type"]["kind"]) for a in pp_args])
    print("  returns:", pp_ret)
    for tn in (pp_ret.get("name"), "PerformancePriceDto", "Price", "Concession", "Seat"):
        if tn:
            t = introspect_type(token, tn)
            if t.get("fields"):
                print(f"  type {tn} fields:", [f["name"] for f in t["fields"]])
    # Deep selection so we reach the nested Price bands / concessions.
    pp_sel = build_selection(token, pp_ret["name"], 3) if pp_ret.get("name") and pp_ret["kind"] == "OBJECT" else None

    perfs = (event.get("performances") or [])[:2]
    candidates_for = lambda p: [p.get("boxOfficeId"), p.get("boxOfficeRef"),
                                str(p.get("id")) if p.get("id") is not None else None,
                                event.get("boxOfficeId"), event.get("boxOfficeRef")]
    if pp_args:
        arg = pp_args[0]
        for p in perfs:
            got = False
            for cand in candidates_for(p):
                if cand is None:
                    continue
                val = int(cand) if arg["type"]["name"] in ("Int", "Long") and str(cand).isdigit() else cand
                inner = f"{{ {pp_sel} }}" if pp_sel else ""
                q = f"query($v:{arg['type']['name']}!){{ performancePrices({arg['name']}:$v) {inner} }}"
                try:
                    data = post_json(GRAPHQL_URL, {"query": q, "variables": {"v": val}}, token=token)
                except Exception as exc:  # noqa: BLE001
                    continue
                if data.get("errors"):
                    continue
                res = (data.get("data") or {}).get("performancePrices")
                if res:
                    print(f"\n  perf {p.get('dateTime')} via {arg['name']}={val!r}:")
                    print("   ", json.dumps(res, ensure_ascii=False)[:3000])
                    got = True
                    break
            if not got:
                print(f"\n  perf {p.get('dateTime')}: no pricing returned for any id candidate")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
