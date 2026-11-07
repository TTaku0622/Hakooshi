"""Import venue candidates from user-supplied OSM CSV. No external requests."""
import csv
import json
import math
from pathlib import Path

APP = Path(__file__).resolve().parents[1]
features = json.loads((APP / 'public/data/prefectures.geojson').read_text())['features']
polygons = []
for feature in features:
    shapes = feature['geometry']['coordinates']
    if feature['geometry']['type'] == 'Polygon': shapes = [shapes]
    for shape in shapes:
        xs = [p[0] for p in shape[0]]; ys = [p[1] for p in shape[0]]
        polygons.append((feature['properties']['N03_001'], min(xs), min(ys), max(xs), max(ys), shape))

def in_ring(x, y, ring):
    inside = False
    for i, (xi, yi) in enumerate(ring):
        xj, yj = ring[i - 1]
        if (yi > y) != (yj > y) and x < (xj-xi)*(y-yi)/(yj-yi)+xi: inside = not inside
    return inside

def prefecture(x, y):
    for name, x1, y1, x2, y2, shape in polygons:
        if x1 <= x <= x2 and y1 <= y <= y2 and in_ring(x,y,shape[0]) and not any(in_ring(x,y,hole) for hole in shape[1:]): return name
    return None

allowed_amenities = {'music_venue','theatre','events_venue','arts_centre','conference_centre','community_centre'}
allowed_leisure = {'stadium','sports_hall','sports_centre'}
venues = []
seen = set()
with (APP / 'public/data/venues/raibu.csv').open(encoding='utf-8-sig', newline='') as file:
    for row in csv.DictReader(file):
        if row['@type'] not in {'node','way','relation'} or not row['@id'].isdigit(): continue
        if row['amenity'] not in allowed_amenities and row['leisure'] not in allowed_leisure and row['building'] != 'stadium': continue
        name = (row['name:ja'] or row['name']).strip()
        if not name: continue
        try: lat, lon = float(row['@lat']), float(row['@lon'])
        except ValueError: continue
        if not math.isfinite(lat) or not math.isfinite(lon) or not 20 <= lat <= 46 or not 122 <= lon <= 154: continue
        pref = prefecture(lon,lat)
        if not pref: continue
        key = row['@type']+'/'+row['@id']
        if key in seen: continue
        seen.add(key)
        venues.append({'id':key,'name':name,'aliases':list({row['name'],row['name:ja']} - {name,''}), 'address':row['addr:full'].strip(), 'prefecture':pref, 'latitude':lat,'longitude':lon,'source':'osm', 'cultural':row['amenity'] in {'theatre','arts_centre'}})
(APP/'src/data/venues.json').write_text(json.dumps(venues,ensure_ascii=False,separators=(',',':'))+'\n',encoding='utf-8')
print(f'Imported {len(venues)} venue candidates; ignored unrelated facility categories and repeated CSV header.')
