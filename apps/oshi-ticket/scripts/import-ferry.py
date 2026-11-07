"""Aggregate anonymized Project LINKS ferry samples; do not identify routes or operators."""
import csv
import json
from collections import Counter
from pathlib import Path
APP=Path(__file__).resolve().parents[1]
with (APP/'public/data/links/ferry/01_ippanryokyakuteikikourojigyoukyokashinseisyo.csv').open(encoding='utf-8-sig',newline='') as f:
    rows=list(csv.DictReader(f))
pairs=Counter((r['Starting_Point_Area'].strip(),r['End_Point_Area'].strip()) for r in rows if r['Starting_Point_Area'].strip() and r['End_Point_Area'].strip())
payload={'sourceUrl':'https://www.geospatial.jp/ckan/dataset/links-ippanryokyakuteikikourojigyou-2024','totalSamples':len(rows),'period':'2007〜2024年度の申請サンプル','connections':[{'from':a,'to':b,'samples':n} for (a,b),n in sorted(pairs.items())]}
(APP/'src/data/ferry.json').write_text(json.dumps(payload,ensure_ascii=False,separators=(',',':'))+'\n',encoding='utf-8')
print('Imported',sum(pairs.values()),'samples with both regional endpoints, from',len(rows),'source records')
