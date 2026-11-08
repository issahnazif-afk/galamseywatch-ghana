#!/usr/bin/env python3
"""Check the data files against docs/DATA_CONTRACT.md. Exit 1 on any problem."""
import json, sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent)); import places as P
D = Path(__file__).resolve().parents[1] / "data"; bad = []
def need(c, m):
    if not c: bad.append(m)
L = lambda p: json.loads((D / p).read_text())
dist = L("shared/districts.geojson")["features"]; names = {f["properties"]["name"] for f in dist}
for label, rows in (("mining", P.MINING), ("flood", P.FLOOD), ("intake", [(q[4],) for q in P.INTAKES])):
    for r in rows: need(r[0] in names, f"{label}: unknown district {r[0]}")
for g in (P.MINING, P.FLOOD): need(len({r[1] for r in g}) == len(g), "duplicate pill code")
for t in ("galamsey", "flood"):
    m = L(f"{t}/meta.json"); g = L(f"{t}/grid.json"); need(m["schema"] == 2, "schema")
    need(m["dataset"]["kind"] in ("sample", "open-model", "operational"), "dataset kind")
    if m["dataset"]["kind"] == "sample": need("synthetic" in m["dataset"]["note"].lower(), "sample must say synthetic")
    need(max(g["zone"]) < len(dist), "zone index"); need(set(g["zone"]) == set(range(len(dist))), "every district needs a cell"); need(g["n"] == len(g["lon"]) == len(g["lat"]) == len(g["zone"]), "grid length")
    for l in m["layers"]:
        for d in m["dates"]:
            modes = ["public"] + (["agency"] if t == "galamsey" and l["type"] == "pixels" else [])
            for mode in modes:
                f = L(f"{t}/layers/{mode}/{l['id']}/{d}.json")
                if l["type"] == "pixels":
                    n = g["n"] if mode == "public" else L("galamsey/grid_agency.json")["n"]
                    need(len(f["v"]) == n == len(f["t"]), f"length {t} {l['id']} {d}")
                else: need("status" in f, "status")
if L("galamsey/candidates.json")["sample"]: need(L("galamsey/meta.json")["dataset"]["kind"] == "sample", "sample candidates need sample meta")
p = L("flood/parameters.json")["items"]; need(len(p) == len(dist), "one parameter set per district")
for x in p: need(x["rain24"] == sorted(x["rain24"]), f"thresholds not ascending {x['district']}")
print("\n".join(bad) or "data OK"); sys.exit(1 if bad else 0)
