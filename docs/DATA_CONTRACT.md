# Data contract (schema 2)

The tools read static files only. A real pipeline replaces them with the same structure, and `tools/validate_data.py` checks them.

| File | Contents |
|---|---|
| `data/shared/districts.geojson` | `id`, `name`, `region`, `label [lon, lat]` |
| `data/<tool>/meta.json` | `dataset.kind` (`sample`, `open-model`, `operational`), `dates`, `layers`, `priority` |
| `data/<tool>/grid.json` | `n`, `lon[]`, `lat[]`, `zone[]` (district index) for public cells |
| `data/<tool>/layers/public/<layer>/<date>.json` | Pixel layer: `v[]` values, `t[]` type 0 to 3. Table layer: `status{}` |
| `data/galamsey/grid_agency.json`, `layers/agency/...` | Fine cells. Must move behind sign-in in production |
| `data/galamsey/candidates.json` | Case records. Must move behind sign-in in production |
| `data/flood/parameters.json` | One rule set per district |
| `data/flood/drivers.json` | Per day and district: `rain24`, `rain72`, `soil`, `flow` |
| `data/flood/dam_status.json` (optional) | Duty officer entry: `{"bagre": "spilling"}`. Values: normal, watch, notice, spilling, major |

A production case must add: exact geometry, scene IDs, acquisition and processing times, model version, calibrated score, uncertainty, cloud fraction, licence and reserve results, reviewer, decision and timestamp.

`t` is the sensor for GalamseyWatch (optical, radar, both, gap-filled) and the main driver for FloodWatch (rain, river, dam, coast).
