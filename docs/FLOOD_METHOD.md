# FloodWatch: technical approach

## Principle

Ghana floods for four different reasons, and no single API covers them. FloodWatch uses open forecasts, then applies a rule set chosen for each district's flood type. The code is in `tools/flood_engine.py`; parameters are in `data/flood/parameters.json`.

| Flood type | Places | Forecast input | How the limit is set |
|---|---|---|---|
| Rain and drains | Accra, Kumasi, Tamale, Sekondi-Takoradi, Cape Coast | Open-Meteo rainfall, soil moisture | Rain limits per district, scaled by drainage factor and wetness |
| River overflow | White Volta, Black Volta, Oti | GloFAS v4 discharge and ensemble | Each point's own 2-, 5- and 20-year flows |
| Dam spillage | White Volta below Bagre, Lower Volta below Akosombo and Kpong, Densu below Weija | VRA, SONABEL and NADMO notices | Duty officer enters status; downstream districts are linked |
| Sea and tide | Keta, Anloga, Ketu South, Ada, coastal cities | Open-Meteo marine waves | Wave limits per stretch of coast |

GloFAS returns the largest river within a 5 km area, so it cannot see the Odaw or a street drain. Urban districts therefore depend on rain rules.

## Levels

| Level | River flow | Rain (Accra-type example, before factor) | Meaning |
|---|---|---|---|
| Advisory | 80% of 2-year flow | 30 mm | Stay informed |
| Watch | 2-year flow | 50 mm | Prepare |
| Warning | 5-year flow | 80 mm | Act |
| Severe | 20-year flow | 120 mm | Life-threatening |

The final level is the highest of the district's drivers. Three adjustments make limits local:

1. **Drainage factor** lowers the limit where drains overflow easily (for example 0.75 for Korle Klottey).
2. **Wetness multiplier** counts rain at 0.9× on dry ground and up to 1.25× on saturated ground.
3. **Ensemble step** raises a river level by one when at least half the ensemble members exceed the 5-year flow.

A three-day total is checked against 1.6× the 24-hour limits, which catches slow, soaking events.

Because thresholds come from the model's own 40-year history, much of the model's bias cancels out. Absolute flow values should still not be published as measurements.

## Calibration before use

The rainfall limits, drainage factors, wave limits and the 1.6 and wetness factors are expert starting values. They are not validated.

1. Build an event list per district from NADMO records, EM-DAT, news archives and Sentinel-1 flood maps, for example 3 June 2015 Accra, the 2018 and 2020 Bagre floods, and the 2023 Lower Volta flood.
2. Include non-flood days.
3. Replay rainfall (CHIRPS, IMERG or ERA5) and GloFAS reanalysis through the rules.
4. For each district, choose limits that maximise the Critical Success Index, with a ceiling on false alarms.
5. Hold out recent years, and publish hit rate, false-alarm ratio and lead time.
6. Replace the discharge ratio with gauge readings where Ghana Hydro can share them.
7. Measure Bagre and Akosombo travel times from gauge records so spill alerts can state when water will arrive.

## Districts

55 named districts have hand-set rules. The rest use a default for their climate belt. The source boundaries contain 260 districts, while official counts give 261, so the boundary file needs updating with Ghana Statistical Service.

River points and intake positions are approximate. Each needs checking against the GloFAS river network before use.

## Status

`tools/fetch_flood_live.py` was tested only against a local imitation of the API, because this build environment cannot reach Open-Meteo. Check its first GitHub run.
