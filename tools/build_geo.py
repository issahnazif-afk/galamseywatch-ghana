#!/usr/bin/env python3
"""Build data/shared from geoBoundaries (CC BY 4.0, source: USAID Ghana HPNO / Ghana Statistical Service).
Usage: build_geo.py <folder holding ADM0/ADM1/ADM2 .geojson and lakes.geojson>"""
import json, sys
from pathlib import Path
from shapely.geometry import shape, mapping, box
from shapely.ops import unary_union
ROOT = Path(__file__).resolve().parents[1]; RAW = Path(sys.argv[1]); OUT = ROOT / "data/shared"; OUT.mkdir(parents=True, exist_ok=True)
def rnd(c):
    return [rnd(x) for x in c] if isinstance(c[0], (list, tuple)) else [round(c[0], 3), round(c[1], 3)]
def geom(g, tol=0.0025):
    g = g.simplify(tol, preserve_topology=True).buffer(0); m = mapping(g)
    return {"type": m["type"], "coordinates": rnd(m["coordinates"])}
def nice(n):
    n = " ".join(n.split()); t = n.replace(" Municipal", "").replace(" District", "")
    return "-".join(p[:1].upper() + p[1:] for p in t.split("-")).replace("/h", "-H").replace("/p", "-P")
adm1 = [(f["properties"]["shapeName"].replace(" Region", ""), shape(f["geometry"]).buffer(0)) for f in json.load(open(RAW / "ADM1.geojson"))["features"]]
feats = []
for f in sorted(json.load(open(RAW / "ADM2.geojson"))["features"], key=lambda f: f["properties"]["shapeName"]):
    s = shape(f["geometry"]).buffer(0); rp = s.representative_point()
    region = max(adm1, key=lambda a: a[1].intersection(s).area)[0]
    feats.append({"type": "Feature", "properties": {"id": len(feats), "source_name": f["properties"]["shapeName"], "name": nice(f["properties"]["shapeName"]), "region": region, "label": [round(rp.x, 3), round(rp.y, 3)]}, "geometry": geom(s)})
json.dump({"type": "FeatureCollection", "features": feats}, open(OUT / "districts.geojson", "w"), separators=(",", ":"))
gh = shape(json.load(open(RAW / "ADM0.geojson"))["features"][0]["geometry"]).buffer(0)
json.dump({"type": "Feature", "properties": {"name": "Ghana"}, "geometry": geom(gh, 0.004)}, open(OUT / "ghana.geojson", "w"), separators=(",", ":"))
json.dump({"type": "FeatureCollection", "features": [{"type": "Feature", "properties": {"name": n}, "geometry": geom(g, 0.004)} for n, g in adm1]}, open(OUT / "regions.geojson", "w"), separators=(",", ":"))
win = box(-3.6, 4.4, 1.6, 11.4); lakes = []
for f in json.load(open(RAW / "lakes.geojson"))["features"]:
    s = shape(f["geometry"]).buffer(0)
    if s.intersects(win): lakes.append({"type": "Feature", "properties": {"name": f["properties"].get("name")}, "geometry": geom(s, 0.003)})
json.dump({"type": "FeatureCollection", "features": lakes}, open(OUT / "water.geojson", "w"), separators=(",", ":"))
print(len(feats), "districts", len(lakes), "lakes")
