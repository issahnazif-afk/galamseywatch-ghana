"""Transparent parametric flood rules, used for both the sample data and the live open-model data.
Levels: 0 none, 1 advisory, 2 watch, 3 warning, 4 severe."""
LEVELS = ["none", "advisory", "watch", "warning", "severe"]

def band(value, thresholds):
    """How many of the ascending thresholds are met or exceeded."""
    return sum(1 for t in thresholds if t is not None and value is not None and value >= t)

def wetness_multiplier(soil_pct):
    """Wet ground makes the same rain count for more: 0.9 when dry (<=30%), 1.25 when saturated (>=90%)."""
    s = 50 if soil_pct is None else max(30, min(90, soil_pct))
    return round(0.9 + (s - 30) / 60 * 0.35, 3)

def rain_level(p, rain24, rain72, soil):
    effective = (rain24 or 0) * wetness_multiplier(soil)
    # a three-day total counts at 1.6 x the 24 h thresholds
    return max(band(effective, p["rain24"]), band((rain72 or 0) * wetness_multiplier(soil), [t * 1.6 for t in p["rain24"]]))

def river_level(p, q, prob_q5=None):
    t = p.get("q")
    if not t or q is None:
        return 0
    lvl = band(q, [t["q2"] * .8, t["q2"], t["q5"], t["q20"]])
    # ensemble raises the level one step when a warning-size flow is likely but not in the central forecast
    if prob_q5 is not None and prob_q5 >= .5 and lvl < 3:
        lvl += 1
    return lvl

def dam_level(p, spill_state):
    if not p.get("dam"):
        return 0
    return {"normal": 0, "watch": 1, "notice": 2, "spilling": 3, "major": 4}.get(spill_state, 0)

def coast_level(p, wave_m):
    return band(wave_m, p["wave"]) if p.get("wave") and wave_m is not None else 0

def assess(p, rain24=0, rain72=0, soil=None, q=None, prob_q5=None, spill=None, wave=None):
    """Return final level and each driver's level so the app can explain why."""
    d = {}
    if "urban" in p["mech"] or "river" in p["mech"]:
        d["rain"] = rain_level(p, rain24, rain72, soil)
    if "river" in p["mech"]:
        d["river"] = river_level(p, q, prob_q5)
    if "dam" in p["mech"]:
        d["dam"] = dam_level(p, spill)
    if "coast" in p["mech"]:
        d["coast"] = coast_level(p, wave)
    if not d:
        d["rain"] = rain_level(p, rain24, rain72, soil)
    level = max(d.values())
    driver = max(d, key=d.get) if level else None
    return level, driver, d

def gumbel_thresholds(annual_maxima):
    """Q2/Q5/Q20 by method of moments. Taken from the model's own climatology, so model bias largely cancels."""
    import math, statistics as st
    x = [v for v in annual_maxima if v is not None]
    if len(x) < 15:
        return None
    beta = st.stdev(x) * math.sqrt(6) / math.pi
    mu = st.mean(x) - .5772 * beta
    f = lambda T: round(mu - beta * math.log(-math.log(1 - 1 / T)), 1)
    return {"q2": f(2), "q5": f(5), "q20": f(20), "years": len(x), "method": "gumbel-moments"}
