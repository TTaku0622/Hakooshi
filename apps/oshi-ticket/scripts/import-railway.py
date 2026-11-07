"""Extract passenger operating kilometers from the supplied Project LINKS rail CSV."""
import csv
import json
from pathlib import Path
APP = Path(__file__).resolve().parents[1]
with (APP / 'public/data/links/railway/03_tetsudou_eigyoukiro.csv').open(encoding='utf-8-sig', newline='') as f:
    rows = list(csv.DictReader(f))
year = max(int(r['YEAR']) for r in rows)
records = []
for i, row in enumerate(rows):
    if int(row['YEAR']) != year: continue
    value = row['FISCAL_YEAR_TOTAL_OPERATING_KILOMETERS_PASSENGER']
    if not value: continue
    try: km = float(value)
    except ValueError: continue
    if km <= 0: continue
    records.append({'id':str(i), 'name':row['CORPORATION_NAME'], 'jurisdiction':row['JURISDICTION'], 'year':year, 'kilometers':km})
records.sort(key=lambda r:r['name'])
(APP / 'src/data/railway.json').write_text(json.dumps(records,ensure_ascii=False,separators=(',',':'))+'\n',encoding='utf-8')
print('Imported',len(records),'railway entries from',year)
