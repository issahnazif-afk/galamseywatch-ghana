#!/usr/bin/env python3
"""Replace FloodWatch samples with open-model data from Open-Meteo (GloFAS v4 river discharge, weather, marine).
Output is the same files the app already reads. Output is NOT an official warning.
Open-Meteo is free for non-commercial use; check its terms and pass a key for commercial use.
Base URLs can be overridden for tests with OM_FLOOD, OM_WEATHER and OM_MARINE."""
import json, os, sys, time, datetime as dt, urllib.parse, urllib.request
from pathlib import Path
import numpy as np
import flood_engine as E
ROOT = Path(__file__).resolve().parents[1]; O = ROOT / "data/flood"
FLOOD = os.environ.get("OM_FLOOD", "https://flood-api.open-meteo.com/v1/flood")
WEATHER = os.environ.get("OM_WEATHER", "https://api.open-meteo.com/v1/forecast")
MARINE = os.environ.get("OM_MARINE", "https://marine-api.open-meteo.com/v1/marine")
BATCH = 40; DAYS = 5

def get(url, q):
    u = url + "?" + urllib.parse.urlencode(q, safe=",")
    for attempt in range(4):
        try:
            with urllib.request.urlopen(urllib.request.Request(u, headers={"User-Agent": "ghana-watch-prototype"}), timeout=120) as r:
                d = json.load(r)
            return d if isinstance(d, list) else [d]
        except Exception as e:
            if attempt == 3: raise
            print("retry", e, file=sys.stderr); time.sleep(8 * (attempt + 1))

def batched(url, pts, q):
    out = []
    for i in range(0, len(pts), BATCH):
        part = pts[i:i + BATCH]
        out += get(url, {**q, "latitude": ",".join(f"{p[0]:.3f}" for p in part), "longitude": ",".join(f"{p[1]:.3f}" for p in part)}); time.sleep(.6)
    return out

def point(p, labels):
    return tuple(p["river_point"]) if p.get("river_point") else (labels[p["zone"]][1], labels[p["zone"]][0])

def calibrate(items, labels, year):
    """Annual maxima 1984..last full year at each river point, once. Cached so it is not repeated."""
    path = O / "thresholds.json"
    cache = json.loads(path.read_text()) if path.exists() else {}
    todo = [p for p in items if "river" in p["mech"] and str(p["zone"]) not in cache]
    if todo:
        res = batched(FLOOD, [point(p, labels) for p in todo], {"daily": "river_discharge", "start_date": "1984-01-01", "end_date": f"{year - 1}-12-31"})
        for p, r in zip(todo, res):
            by = {}
            for t, v in zip(r["daily"]["time"], r["daily"]["river_discharge"]):
                if v is not None: by[t[:4]] = max(by.get(t[:4], 0), v)
            cache[str(p["zone"])] = E.gumbel_thresholds(list(by.values()))
        path.write_text(json.dumps(cache, separators=(",", ":")))
    return cache

def main():
    today = dt.datetime.now(dt.timezone.utc).date()
    meta = json.loads((O / "meta.json").read_text()); grid = json.loads((O / "grid.json").read_text()); par = json.loads((O / "parameters.json").read_text())
    dist = json.loads((ROOT / "data/shared/districts.geojson").read_text())["features"]; labels = [f["properties"]["label"] for f in dist]
    items = par["items"]; cal = calibrate(items, labels, today.year)
    for p in items:
        if "river" in p["mech"]:
            t = cal.get(str(p["zone"]))
            p["q"] = t if t and t["q2"] > 1 else None
            p["thresholds_source"] = "GloFAS v4 reanalysis annual maxima" if p["q"] else "unavailable at this point"
    # river forecast
    rz = [p for p in items if p.get("q")]
    fl = batched(FLOOD, [point(p, labels) for p in rz], {"daily": "river_discharge", "forecast_days": DAYS, "ensemble": "true"}) if rz else []
    river = {}
    for p, r in zip(rz, fl):
        d = r["daily"]; base = d.get("river_discharge") or d.get("river_discharge_member01")
        mem = [v for k, v in d.items() if k.startswith("river_discharge_member")]
        q, pr = [], []
        for t in range(DAYS):
            vals = [m[t] for m in mem if m[t] is not None]
            q.append(base[t] if base and base[t] is not None else (float(np.median(vals)) if vals else None))
            pr.append(sum(v >= p["q"]["q5"] for v in vals) / len(vals) if vals else None)
        river[p["zone"]] = (q, pr)
    # rainfall and soil on a 0.25 degree mesh, nearest neighbour to cells
    lon, lat = np.array(grid["lon"]), np.array(grid["lat"]); gx, gy = np.round(lon * 4) / 4, np.round(lat * 4) / 4
    mesh = sorted({(float(y), float(x)) for x, y in zip(gx, gy)}); mi = {m: i for i, m in enumerate(mesh)}
    w = batched(WEATHER, mesh, {"daily": "precipitation_sum", "hourly": "soil_moisture_0_to_7cm", "forecast_days": DAYS, "past_days": 2, "timezone": "GMT"})
    P = np.array([[v or 0 for v in r["daily"]["precipitation_sum"]] for r in w], float)          # mesh x (2+DAYS)
    SM = []
    for r in w:
        a = np.array([np.nan if v is None else v for v in r["hourly"]["soil_moisture_0_to_7cm"]], float); SM.append([np.nanmean(a[48 + 24 * t:72 + 24 * t]) for t in range(DAYS)])
    SM = np.clip((np.array(SM) - .08) / .32 * 100, 0, 100)                                        # relative wetness; range to calibrate
    cell = np.array([mi[(float(y), float(x))] for x, y in zip(gx, gy)])
    # waves
    cz = [p for p in items if p.get("wave")]; wave = {}
    if cz:
        for p, r in zip(cz, batched(MARINE, [(labels[p["zone"]][1] - .12, labels[p["zone"]][0]) for p in cz], {"daily": "wave_height_max", "forecast_days": DAYS})):
            wave[p["zone"]] = r["daily"]["wave_height_max"]
    # dam status is entered by a duty officer from VRA / SONABEL notices
    sp = O / "dam_status.json"; spill = json.loads(sp.read_text()) if sp.exists() else {}
    ids = [d["id"] for d in meta["dams"]]
    dates = [(today + dt.timedelta(days=k)).isoformat() for k in range(DAYS)]; pz = {p["zone"]: p for p in items}; zone = np.array(grid["zone"]); typ = {"rain": 0, "river": 1, "dam": 2, "coast": 3}
    zones_days = []; layers = {k: [] for k in ("alert", "rain", "flow", "soil")}; types = []
    for t in range(DAYS):
        r24 = P[:, 2 + t][cell]; r72 = (P[:, t] + P[:, t + 1] + P[:, t + 2])[cell]; s = SM[:, t][cell]; al, fw, ty = [], [], []
        for c in range(len(zone)):
            p = pz[int(zone[c])]; q, pr = river.get(p["zone"], ([None] * DAYS, [None] * DAYS))
            ratio = (q[t] / p["q"]["q2"]) if p.get("q") and q[t] is not None else None
            sv = None if np.isnan(s[c]) else float(s[c]); wv = wave.get(p["zone"], [None] * DAYS)[t]
            lv, drv, _ = E.assess(p, float(r24[c]), float(r72[c]), sv, q=q[t], prob_q5=pr[t], spill=spill.get(p.get("dam"), "normal"), wave=wv)
            al.append(lv); ty.append(typ.get(drv, 0)); fw.append(round(ratio if ratio is not None else min(float(r72[c]) / 130, 2.4), 2))
        layers["alert"].append(al); layers["rain"].append([round(float(v)) for v in r24]); layers["flow"].append(fw); layers["soil"].append([0 if np.isnan(v) else round(float(v)) for v in s]); types.append(ty)
        zs = []
        for i in range(len(dist)):
            m = zone == i
            zs.append(dict(rain24=round(float(r24[m].max())) if m.any() else None, rain72=round(float(r72[m].max())) if m.any() else None, soil=round(float(np.nanmean(s[m]))) if m.any() and not np.all(np.isnan(s[m])) else None, flow=round(float(np.array(fw)[m].max()), 2) if m.any() else None))
        zones_days.append(zs)
    out = O / "layers/public"
    for f in out.glob("*/*.json"): f.unlink()
    wr = lambda p, o: (p.parent.mkdir(parents=True, exist_ok=True), p.write_text(json.dumps(o, separators=(",", ":"))))
    for t, d in enumerate(dates):
        for k in layers: wr(out / k / f"{d}.json", {"v": layers[k][t], "t": types[t]})
        wr(out / "dams" / f"{d}.json", {"status": {i: spill.get(i, "normal") for i in ids}})
    wr(O / "drivers.json", dict(sample=False, dates=dates, wave=[max([v[t] or 0 for v in wave.values()], default=0) for t in range(DAYS)], zones=zones_days))
    wr(O / "parameters.json", par)
    now = dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%dT%H:%MZ")
    meta["dates"] = dates; meta["dataset"] = dict(kind="open-model", name="GloFAS v4 and Open-Meteo forecasts", generated_at=now, note="Open global model data run through uncalibrated district limits. Not an official warning. Follow NADMO, GMet and Ghana Hydro.")
    for l in meta["layers"]:
        if l["id"] == "dams": l.update(source="Duty officer entry", updated=now)
    wr(O / "meta.json", meta)
    print("live data written for", dates[0], "river points", len(rz))
if __name__ == "__main__":
    main()
