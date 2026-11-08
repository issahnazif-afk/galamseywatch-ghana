#!/usr/bin/env python3
"""Generate SYNTHETIC data for both tools. Nothing here is an observation or a forecast."""
import argparse, json, math, shutil, datetime as dt
from pathlib import Path
import numpy as np
from shapely.geometry import shape, Point
from shapely.strtree import STRtree
from shapely import contains_xy
import places as P, flood_engine as E
ROOT = Path(__file__).resolve().parents[1]; D = ROOT / "data"
ap = argparse.ArgumentParser(); ap.add_argument("--start"); ap.add_argument("--only"); a = ap.parse_args()
today = dt.date.fromisoformat(a.start) if a.start else dt.date.today()
NOW = dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%dT%H:%MZ")
rng = np.random.default_rng(int(today.strftime("%Y%m%d")) % 100000)
def dump(p, o):
    p.parent.mkdir(parents=True, exist_ok=True); p.write_text(json.dumps(o, separators=(",", ":"), ensure_ascii=False))
dist = json.load(open(D / "shared/districts.geojson"))["features"]
polys = [shape(f["geometry"]) for f in dist]; names = [f["properties"]["name"] for f in dist]
index = {n: i for i, n in enumerate(names)}
tree = STRtree(polys); ghana = shape(json.load(open(D / "shared/ghana.geojson"))["geometry"])
def lattice(step, only=None):
    lo, la, z = [], [], []
    for y in np.arange(4.7, 11.2, step):
        for x in np.arange(-3.3, 1.25, step):
            if only is not None:
                hit = [i for i in only if contains_xy(polys[i], x, y)]
            else:
                if not contains_xy(ghana, x, y): continue
                c = tree.query(Point(x, y)); hit = [int(i) for i in c if contains_xy(polys[int(i)], x, y)]
            if hit: lo.append(round(float(x), 3)); la.append(round(float(y), 3)); z.append(hit[0])
    if only is None:   # small city districts can fall between cells, so each one gets a cell at its label point
        seen = set(z)
        for i, f in enumerate(dist):
            if i not in seen: lo.append(f["properties"]["label"][0]); la.append(f["properties"]["label"][1]); z.append(i)
    return {"n": len(z), "lon": lo, "lat": la, "zone": z}
grid = lattice(.045)   # about 5 km
lon, lat, zone = np.array(grid["lon"]), np.array(grid["lat"]), np.array(grid["zone"])
def noise(x, y, seed, scale=.12):
    r = np.random.default_rng(seed); k = r.uniform(1 / scale * .4, 1 / scale, (10, 2)) * r.choice([-1, 1], (10, 2)); ph = r.uniform(0, 6.28, 10)
    return sum(np.sin(k[i, 0] * x + k[i, 1] * y + ph[i]) for i in range(10)) / 3.2
def cls(*rows):
    return [dict(id=i, label_en=l, min=lo, max=hi, color=c) for i, l, lo, hi, c in rows]
RISK = ["#ef4444", "#f59e0b", "#facc15", "#34d058", "#14b8a6"]
def meta_common(tool, dates, extra):
    return {"schema": 2, "tool": tool, "dataset": {"kind": "sample", "name": "Synthetic demonstration data", "generated_at": NOW,
      "note": "All values are synthetic and exist to demonstrate the interface. Not for operational or safety decisions."},
      "dates": dates, "map": {"center": [-1.05, 7.95], "zoom": 6.3, "bounds": [[-3.4, 4.65], [1.3, 11.2]]}, **extra}

def current(tool, day):
    """True when today's sample already exists, so scheduled runs do not create needless commits."""
    f = D / tool / "meta.json"
    if a.start or not f.exists(): return False
    m = json.loads(f.read_text()); return m["dataset"]["kind"] == "sample" and day in m["dates"] and m["dates"].index(day) in (0, len(m["dates"]) - 1) and m["dates"][0 if tool == "flood" else -1] == day

def galamsey():
    O = D / "galamsey"; dates = [(today - dt.timedelta(days=6 * k)).isoformat() for k in (3, 2, 1, 0)]
    if current("galamsey", today.isoformat()): print("galamsey sample already current"); return
    shutil.rmtree(O / "layers", ignore_errors=True)
    zi = [index[m[0]] for m in P.MINING]; wt = {index[m[0]]: m[3] for m in P.MINING}
    fine = lattice(.0135, zi)   # about 1.5 km; agency only
    lz = [dict(id=l, type="pixels", summary="p90", unit=u, decimals=dd, label_en=n, legend_title_en=t, tooltip_en=n, footnote_en=f, classes=c) for l, u, dd, n, t, f, c in [
      ("disturb", "%", 0, "Mining disturbance", "Likelihood of new disturbance", "Combines optical, radar and river signals. A high value means \"send someone to check\", not \"illegal mining confirmed\".",
       cls(("very_high", "Very high", 80, None, RISK[0]), ("high", "High", 60, 80, RISK[1]), ("moderate", "Moderate", 40, 60, RISK[2]), ("low", "Low", 20, 40, RISK[3]), ("very_low", "Very low", None, 20, RISK[4]))),
      ("veg", "%", 0, "Vegetation loss", "Green cover lost vs. last year", "Share of green cover lost against the same season last year.",
       cls(("a", "Severe", 40, None, RISK[0]), ("b", "High", 25, 40, RISK[1]), ("c", "Moderate", 12, 25, RISK[2]), ("d", "Slight", 5, 12, RISK[3]), ("e", "Stable", None, 5, RISK[4]))),
      ("water", "", 0, "River muddiness", "Sediment index (0 to 100)", "Satellite colour index. It does not measure mercury, cyanide or whether water is safe to drink.",
       cls(("a", "Extreme", 75, None, "#b45309"), ("b", "Very muddy", 55, 75, "#d97706"), ("c", "Muddy", 35, 55, "#facc15"), ("d", "Slightly cloudy", 15, 35, "#34d058"), ("e", "Clear", None, 15, "#22d3ee"))),
      ("radar", "dB", 1, "Radar ground change", "Radar change vs. baseline", "Radar sees through cloud, so this layer keeps working in the rainy season.",
       cls(("a", "Very strong", 6, None, RISK[0]), ("b", "Strong", 4, 6, RISK[1]), ("c", "Moderate", 2.5, 4, RISK[2]), ("d", "Weak", 1, 2.5, RISK[3]), ("e", "None", None, 1, RISK[4])))]]
    lz.insert(0, dict(id="intakes", type="table", label_en="Water intakes", footnote_en="Intake names are real and positions approximate. Status is synthetic. Real status must come from Ghana Water Limited and the Water Resources Commission.", updated=NOW, source="SAMPLE (synthetic)"))
    meta = meta_common("galamsey", dates, {"product": "GalamseyWatch", "default_layer": "disturb", "date_kind": "pass", "pixel_m": 5000, "pixel_m_agency": 1500,
      "pixel_types": ["Optical", "Radar", "Both", "Gap-filled"], "pixel_types_short": ["OPT", "SAR", "FUS", "GAP"], "pixel_types_title": "Which satellite saw it",
      "alert_layer": "disturb", "layers": lz,
      "priority": [dict(zone=index[m[0]], code=m[1], river=m[2]) for m in P.MINING]})
    def field(x, y, zn, t, seed):
        z = np.zeros_like(x, float)
        for n in range(len(zn)):
            z[n] = wt.get(int(zn[n]), 0)
        # belt: elevated background in the south-west, low in the north
        belt = np.clip((8.2 - y) / 2.6, 0, 1) * .16
        tx = noise(x, y, seed, .1); fx = noise(x, y, seed + 1, .035)
        hot = np.clip(z * (.42 + .35 * tx + .32 * fx) + belt * (.5 + .5 * tx), 0, 1)
        return hot * (1 + .10 * t) + .015 * (np.sin(x * 40 + t) + 1)
    def write(mode, x, y, zn):
        out = O / "layers" / mode
        for t, d in enumerate(dates):
            h = np.clip(field(x, y, zn, t, 11), 0, 1.05)
            cloud = noise(x, y, 40 + t, .3) > .1
            ty = np.where(cloud, np.where(noise(x, y, 70 + t, .05) > .25, 3, 1), np.where(noise(x, y, 90, .05) > 0, 2, 0))
            jitter = rng.normal(0, 1, len(x))
            vals = {"disturb": np.clip(h * 92 + jitter * 3, 0, 99), "veg": np.clip(h ** 1.2 * 62 + jitter * 2.2, 0, 90),
                    "water": np.clip(h ** .85 * 88 + 10 * noise(x, y, 5, .2) + jitter * 3, 0, 100), "radar": np.clip(h * 8.2 + jitter * .35, 0, 12)}
            for k, v in vals.items():
                dump(out / k / f"{d}.json", {"v": [round(float(q), 1 if k == "radar" else 0) for q in v], "t": [int(q) for q in ty]})
    write("public", lon, lat, zone); write("agency", np.array(fine["lon"]), np.array(fine["lat"]), np.array(fine["zone"]))
    dump(O / "grid.json", grid); dump(O / "grid_agency.json", fine)
    # water intakes table
    rows = [dict(name=n, river=r, lat=la, lon=lo, district=dd) for n, r, la, lo, dd in P.INTAKES]
    for t, d in enumerate(dates):
        st = {}
        for i, q in enumerate(P.INTAKES):
            s = float(np.clip(.25 + .75 * (.5 + .5 * math.sin(i * 2.3 + 1)) + .07 * t, 0, 1)); st[q[0]] = int(min(3, s * 4))
        dump(O / "layers/public/intakes" / f"{d}.json", {"status": st})
    meta["intakes"] = rows; meta["intake_status"] = ["Normal", "Raised", "High", "Treatment at risk"]
    dump(O / "meta.json", meta)
    # candidates: agency only
    cand = []; st = ["New", "New", "New", "In review", "In review", "Field team sent", "Confirmed", "Dismissed"]
    for k in range(46):
        z = int(rng.choice(zi, p=np.array([wt[q] for q in zi]) / sum(wt.values()))); p = polys[z]; x0, y0, x1, y1 = p.bounds
        while True:
            x, y = rng.uniform(x0, x1), rng.uniform(y0, y1)
            if contains_xy(p, x, y): break
        score = int(rng.integers(42, 97)); n = 12; ch = int(rng.integers(5, 10)); s = lambda a, b, nz: [round(float((a if i < ch else b) + rng.normal(0, nz)), 2) for i in range(n)]
        m = next(q for q in P.MINING if index[q[0]] == z)
        cand.append(dict(id=f"GW-{today:%y%m}-{k+1:03d}", zone=z, district=names[z], river=m[2], lon=round(x, 4), lat=round(y, 4), area_ha=round(float(rng.gamma(2.2, 7)) + 1.5, 1), score=score,
          uncertainty=int(rng.integers(5, 22)), first_seen=(today - dt.timedelta(days=6 * int(rng.integers(0, 8)))).isoformat(), status=str(rng.choice(st)), sensors=str(rng.choice(["Sentinel-2 + Sentinel-1", "Sentinel-1 only (cloud)", "Sentinel-2 only"])),
          licence="Not checked: licence data pending", forest="Not checked: reserve data pending", dist_water_km=round(float(rng.gamma(1.4, .6)) + .05, 1),
          series=dict(ndvi=s(.74, .24, .03), bare=s(-.18, .24, .03), vh=s(-14.4, -19.2, .4))))
    dump(O / "candidates.json", dict(sample=True, note="Synthetic. Points do not mark real sites.", items=cand))

def flood():
    O = D / "flood"; dates = [(today + dt.timedelta(days=k)).isoformat() for k in range(5)]
    if current("flood", today.isoformat()): print("flood sample already current"); return
    shutil.rmtree(O / "layers", ignore_errors=True)
    tier1 = {f[0]: f for f in P.FLOOD}; params = []
    # one synthetic 40-year climatology per district gives thresholds the same shape as real calibration
    for i, f in enumerate(dist):
        n = names[i]; p = f["properties"]; belt = P.BELT_BY_REGION[p["region"]]
        t = tier1.get(n); mech = t[2] if t else ["urban"]; fac = t[3] if t else 1.0
        q = None
        if "river" in mech:
            base = {"White Volta": 900, "Lower Volta": 2500, "Lower Volta estuary": 2500, "Black Volta": 700, "Oti": 800}.get(t[4], 90)
            am = np.random.default_rng(i).gumbel(base, base * .3, 40).tolist(); q = E.gumbel_thresholds(am)
        ptype = "named" if t else "default"
        params.append(dict(zone=i, district=n, region=p["region"], tier=1 if t else 2, code=t[1] if t else None, mech=mech, belt=belt, drainage_factor=fac,
          rain24=[round(v * fac) for v in P.BELT[belt]], q=q, river=t[4] if t else None, river_point=list(t[5]) if t and t[5] else None, dam=t[6] if t else None, wave=[2.0, 2.5, 3.2, 4.0] if "coast" in mech else None,
          note=t[7] if t else None, status="starting value" if t else "regional default", thresholds_source="synthetic climatology (sample)"))
    dump(O / "parameters.json", dict(note="Starting values. See docs/FLOOD_METHOD.md for calibration.", levels=E.LEVELS, items=params))
    dams = [dict(id="bagre", name="Bagre (Burkina Faso)", river="White Volta", ref="Maximum spill level 235 m"), dict(id="kompienga", name="Kompienga (Burkina Faso)", river="Oti", ref="Level to be confirmed"),
            dict(id="akosombo", name="Akosombo and Kpong", river="Lower Volta", ref="Operating 276 ft, max. 277.5 ft"), dict(id="weija", name="Weija", river="Densu", ref="Level to be confirmed")]
    spill_plan = {"bagre": ["notice", "notice", "spilling", "spilling", "spilling"], "kompienga": ["normal"] * 5, "akosombo": ["normal", "normal", "watch", "watch", "watch"], "weija": ["notice", "spilling", "notice", "watch", "watch"]}
    # storm tracks moving over the coast and the north
    storms = [(-0.25, 5.65, .55, [96, 58, 18, 6, 4]), (-1.6, 6.7, .7, [44, 58, 26, 10, 6]), (-.85, 10.4, .9, [46, 66, 44, 22, 12]), (.75, 5.85, .55, [40, 55, 30, 10, 6]), (-1.75, 5.0, .5, [30, 22, 12, 6, 4])]
    rain = []
    for t in range(5):
        r = 5 + 4 * np.abs(noise(lon, lat, 200 + t, .4))
        for x0, y0, s, amp in storms:
            r += amp[t] * np.exp(-((lon - x0 - .1 * t) ** 2 + (lat - y0) ** 2) / (2 * s ** 2)) * (1 + .25 * noise(lon, lat, 300 + t, .12))
        rain.append(np.clip(r, 0, 220))
    rain = np.array(rain); soil = np.clip(38 + np.cumsum(rain, 0) * .16 + 8 * noise(lon, lat, 500, .5), 8, 100)
    flowf = {}
    days = []
    pz = {p["zone"]: p for p in params}
    types = {"rain": 0, "river": 1, "dam": 2, "coast": 3}
    waves = [2.4, 3.3, 2.7, 1.9, 1.5]
    zone_days = []
    for t, d in enumerate(dates):
        al, fl, ty = [], [], []
        r72 = rain[t] + (rain[t - 1] if t > 0 else rain[t] * .3) + (rain[t - 2] if t > 1 else rain[t] * .2)
        for c in range(len(zone)):
            p = pz[int(zone[c])]; ratio = None; q = None
            if p["q"]:
                upstream = {"bagre": 1.0 + .22 * t}.get(p["dam"], 1.0)
                ratio = float(np.clip(.55 + r72[c] / 260 + (.25 * t if p["dam"] == "bagre" else 0) + (.12 * t if p["dam"] == "akosombo" else 0), .1, 3)) * upstream ** .3
                q = p["q"]["q2"] * ratio
            lv, drv, _ = E.assess(p, rain[t][c], r72[c], soil[t][c], q=q, spill=spill_plan.get(p["dam"], ["normal"] * 5)[t], wave=waves[t])
            al.append(lv); fl.append(round(ratio if ratio is not None else min(r72[c] / 130, 2.4), 2)); ty.append(types.get(drv, 0))
        zs = []
        for i in range(len(polys)):
            m = zone == i
            pp = pz[i]
            zs.append(dict(rain24=round(float(rain[t][m].max())) if m.any() else None, rain72=round(float(r72[m].max())) if m.any() else None, soil=round(float(soil[t][m].mean())) if m.any() else None, flow=round(float(np.array(fl)[m].max()), 2) if m.any() else None))
        zone_days.append(zs)
        out = O / "layers/public"
        dump(out / "alert" / f"{d}.json", {"v": al, "t": ty}); dump(out / "rain" / f"{d}.json", {"v": [round(float(v)) for v in rain[t]], "t": ty})
        dump(out / "flow" / f"{d}.json", {"v": fl, "t": ty}); dump(out / "soil" / f"{d}.json", {"v": [round(float(v)) for v in soil[t]], "t": ty})
        dump(out / "dams" / f"{d}.json", {"status": {k: v[t] for k, v in spill_plan.items()}})
    dump(O / "drivers.json", dict(sample=True, dates=dates, wave=waves, zones=zone_days))
    ALERT = ["#ef4444", "#f97316", "#facc15", "#60a5fa", "#14b8a6"]
    lz = [dict(id="dams", type="table", label_en="Dams and spillage", footnote_en="Reference levels are from public VRA and NADMO statements. Status is synthetic.", updated=NOW, source="SAMPLE (synthetic)"),
      dict(id="alert", type="pixels", summary="max", unit="", decimals=0, label_en="Flood alert", legend_title_en="Flood alert level", tooltip_en="Alert level", footnote_en="Each district is judged against its own limits. Official warnings come from NADMO, GMet and the Ghana Hydrological Authority.", value_labels=["None", "Advisory", "Watch", "Warning", "Severe"],
        classes=cls(("severe", "Severe", 4, None, ALERT[0]), ("warning", "Warning", 3, 4, ALERT[1]), ("watch", "Watch", 2, 3, ALERT[2]), ("advisory", "Advisory", 1, 2, ALERT[3]), ("none", "No alert", None, 1, ALERT[4]))),
      dict(id="rain", type="pixels", summary="max", unit="mm", decimals=0, label_en="Rain in 24 hours", legend_title_en="Rain in 24 hours", tooltip_en="Rain", footnote_en="Forecast rainfall for the day shown.", classes=cls(("a", "Extreme", 100, None, "#c026d3"), ("b", "Very heavy", 60, 100, "#7c3aed"), ("c", "Heavy", 30, 60, "#2563eb"), ("d", "Moderate", 10, 30, "#38bdf8"), ("e", "Light", None, 10, "#a7f3d0"))),
      dict(id="flow", type="pixels", summary="max", unit="×", decimals=2, label_en="River and runoff pressure", legend_title_en="Flow vs. 2-year flood", tooltip_en="Flow ratio", footnote_en="1× equals this location's own 2-year flood flow.", classes=cls(("a", "Very high", 1.8, None, RISK[0]), ("b", "High", 1.2, 1.8, RISK[1]), ("c", "Elevated", .8, 1.2, RISK[2]), ("d", "Normal", .4, .8, RISK[3]), ("e", "Low", None, .4, RISK[4]))),
      dict(id="soil", type="pixels", summary="mean", unit="%", decimals=0, label_en="Soil wetness", legend_title_en="Soil wetness", tooltip_en="Wetness", footnote_en="Wet ground lowers the amount of rain needed to cause flooding.", classes=cls(("a", "Saturated", 85, None, "#1d4ed8"), ("b", "Very wet", 65, 85, "#3b82f6"), ("c", "Wet", 45, 65, "#60a5fa"), ("d", "Moist", 25, 45, "#fde68a"), ("e", "Dry", None, 25, "#d97706")))]
    meta = meta_common("flood", dates, {"product": "FloodWatch", "default_layer": "alert", "date_kind": "forecast", "pixel_m": 5000, "pixel_types": ["Rain", "River", "Dam", "Coast"], "pixel_types_short": ["RAIN", "RIV", "DAM", "SEA"], "pixel_types_title": "Main driver", "alert_layer": "alert", "layers": lz, "dams": dams, "dam_status": {"normal": "Normal", "watch": "Watching", "notice": "Spill notice", "spilling": "Spilling", "major": "Major spill"},
      "priority": [dict(zone=index[f[0]], code=f[1], river=f[4]) for f in P.FLOOD]})
    dump(O / "meta.json", meta); dump(O / "grid.json", grid)
if a.only != "flood": galamsey()
if a.only != "galamsey": flood()
print("ok", today, "cells", grid["n"])
