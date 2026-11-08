/* GalamseyWatch baseline screen for the Google Earth Engine Code Editor.
   Transparent rule-based score (Tier 0): a benchmark and label-prioritiser for the trained model, not a mining classifier.
   Output means "ground changed in a way that resembles mining". It says nothing about legality.
   Edit RECENT_END, ASSET_ROOT, then Run and start the task from the Tasks tab. */
var RECENT_END = ee.Date(Date.now());
var RECENT_DAYS = 60, ASSET_ROOT = 'projects/YOUR-PROJECT/assets/galamsey';
var ghana = ee.FeatureCollection('FAO/GAUL/2015/level0').filter(ee.Filter.eq('ADM0_NAME', 'Ghana')).geometry();
var recentStart = RECENT_END.advance(-RECENT_DAYS, 'day');
// baseline: same season one year earlier, so harmattan and crop cycles largely cancel
var baseEnd = RECENT_END.advance(-1, 'year'), baseStart = baseEnd.advance(-RECENT_DAYS - 30, 'day');

function s2(start, end) {
  var cs = ee.ImageCollection('GOOGLE/CLOUD_SCORE_PLUS/V1/S2_HARMONIZED');
  return ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED').filterBounds(ghana).filterDate(start, end)
    .linkCollection(cs, ['cs_cdf']).map(function (i) {
      return i.updateMask(i.select('cs_cdf').gte(0.6)).divide(10000).select(['B2', 'B3', 'B4', 'B8', 'B11']).copyProperties(i, ['system:time_start']);
    });
}
function indices(i) {
  var ndvi = i.normalizedDifference(['B8', 'B4']).rename('ndvi');
  var mndwi = i.normalizedDifference(['B3', 'B11']).rename('mndwi');
  var ndti = i.normalizedDifference(['B4', 'B3']).rename('ndti');            // water turbidity proxy
  var bsi = i.expression('((S+R)-(N+B))/((S+R)+(N+B))', { S: i.select('B11'), R: i.select('B4'), N: i.select('B8'), B: i.select('B2') }).rename('bsi');
  return ndvi.addBands([mndwi, ndti, bsi]);
}
function s1(start, end) {
  return ee.ImageCollection('COPERNICUS/S1_GRD').filterBounds(ghana).filterDate(start, end)
    .filter(ee.Filter.eq('instrumentMode', 'IW')).filter(ee.Filter.listContains('transmitterReceiverPolarisation', 'VH')).select('VH');
}
var rec = indices(s2(recentStart, RECENT_END).median()), base = indices(s2(baseStart, baseEnd).median());
var dNdvi = base.select('ndvi').subtract(rec.select('ndvi')), dBsi = rec.select('bsi').subtract(base.select('bsi'));
var dVh = s1(baseStart, baseEnd).median().subtract(s1(recentStart, RECENT_END).median());      // a drop in VH after clearance
var unit = function (img, lo, hi) { return img.subtract(lo).divide(hi - lo).clamp(0, 1); };
// weights are starting values; replace with the calibrated model
var score = unit(dNdvi, 0.1, 0.45).multiply(0.35).add(unit(dBsi, 0.03, 0.25).multiply(0.3)).add(unit(dVh.unmask(0), 1, 6).multiply(0.35)).multiply(100).rename('disturb');
// galamsey concentrates near water; limit to 1 km of mapped water and exclude established built-up land
var water = ee.Image('JRC/GSW1_4/GlobalSurfaceWater').select('occurrence').gt(10).unmask(0);
var near = water.focal_max({ radius: 1000, units: 'meters' });
var built = ee.ImageCollection('ESA/WorldCover/v200').first().eq(50);
var out = score.updateMask(near).updateMask(built.not()).clip(ghana);
Map.centerObject(ee.Geometry.Point(-1.8, 6.1), 9);
Map.addLayer(out, { min: 30, max: 90, palette: ['14b8a6', '34d058', 'facc15', 'f59e0b', 'ef4444'] }, 'Disturbance screen');
Export.image.toAsset({ image: out.toFloat(), description: 'galamsey_screen', assetId: ASSET_ROOT + '/screen_latest', region: ghana.bounds(), scale: 20, maxPixels: 1e13 });
