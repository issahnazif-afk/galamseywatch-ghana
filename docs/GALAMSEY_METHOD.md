# GalamseyWatch: technical approach

## What can be detected

Mining changes the ground in a recognisable sequence: forest or farm is cleared, soil is exposed, pits fill with water, and sediment reaches rivers. No single index identifies it, so the method combines change over time from several sensors.

| Signal | Source | Strength | Limit |
|---|---|---|---|
| Vegetation loss | Sentinel-2 NDVI, EVI | Early clearing | Farming and logging look similar |
| Bare soil | SWIR, BSI | Excavation | Roads and construction |
| New pit water | MNDWI, Sentinel-1 VV | Distinctive pond clusters | Fish ponds |
| Surface change in cloud | Sentinel-1 VH, coherence loss | Works in the rainy season | Speckle, terrain |
| River sediment | Sentinel-2 red and green, NDTI | Points upstream | Needs a channel several pixels wide. Not a toxicity measure |
| Context | Rivers, roads, licences, reserves | Removes false alarms and sets priority | Licence data access |

Satellites cannot sense drilling vibration. Radar coherence loss is the closest practical proxy for ground disturbance.

## Three tiers

**Tier 0: transparent rules (ready now).** `pipeline/gee/galamsey_screen.js` compares recent conditions with the same season last year within 1 km of mapped water. It serves as the benchmark and proposes areas to label.

**Tier 1: trained segmentation (pilot).** Start with a U-Net on Sentinel-2. Gallwey et al. (2020) showed this works for Ghana, mapping 6 million hectares of the south. Add a Sentinel-1 time-series branch, because Forkuor et al. (2020) demonstrated radar monitoring of small-scale mining in Ghana and cloud is the main operational gap. Late fusion lets the model run when only radar is available.

**Tier 2: temporal change model (scale-up).** Use the image sequence as input, with attention over passes, to separate a new site from an old scar or harvest cycle.

## Labels

- Digitise polygons from dated high-resolution imagery, with confidence and date
- Field-verify a sample with Minerals Commission, Forestry Commission or university teams
- Include hard negatives: farms, quarries, roads, construction, licensed mines, river bars and burn scars
- Use Tier 0 and active learning to direct effort to uncertain areas
- Treat analyst decisions in the app as new labels

## Validation

Random pixel splits overstate accuracy here because neighbouring pixels are nearly identical. Hold out whole districts and basins, and report by basin, season and sensor availability.

| Metric | Why it matters |
|---|---|
| Precision, recall, IoU on held-out basins | Mapping quality |
| False alerts per 1,000 km² per month | Analyst workload and public trust |
| Days from first disturbance to alert | The real early-warning value |
| Area bias | Reported hectares |

Calibrate scores on separate basins. Conformal prediction can set alert thresholds with a stated false-alert rate per basin and gives each case an honest uncertainty range.

## Alert rule

A candidate needs all of these before reaching an analyst: score above the calibrated limit, seen on two passes or two sensors, at least about 0.5 ha, and not an already known and unchanged scar. Priority rises with proximity to water and intakes and with overlap of forest reserves.

The public layer is produced from reviewed records and generalised on the server. Hiding detail in the browser is not sufficient.

## Keep these separate

- **Disturbance candidate:** the ground changed.
- **Environmental exposure:** that change drains towards people or ecosystems.
- **Illegal mining:** decided only by regulators and field evidence.
- **Unsafe water:** decided only by laboratory tests.
