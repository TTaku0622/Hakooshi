"""Regenerate site data from the bundled, unmodified Project LINKS CSVs."""

import csv
import json
from decimal import Decimal
from pathlib import Path


APP = Path(__file__).resolve().parents[1]
SOURCES = APP / "public/data/links"
METRICS = {
    "total": "TOTAL_SPENDING", "package": "PACKAGE_TOUR", "accommodation": "ACCOMMODATION",
    "food": "FOOD", "transportation": "TRANSPORTATION", "entertainment": "ENTERTAINMENT",
    "shopping": "SHOPPING", "other": "OTHER",
}


def read_csv(name):
    with (SOURCES / name).open(encoding="utf-8-sig", newline="") as source:
        return list(csv.DictReader(source))


records = []
for trip_type, filename, kind in [
    ("daytrip", "03_ryokoukankousyouhidoukou_higaeri.csv", "DAY"),
    ("overnight", "02_ryokoukankousyouhidoukou_syukuhaku.csv", "STAY"),
]:
    rows = read_csv(filename)
    keys = {(int(row["YEAR"]), int(row["PREFECTURE_CODE"])) for row in rows}
    if len(keys) != len(rows):
        raise ValueError(f"Duplicate year/prefecture key in {filename}")
    for year in {key[0] for key in keys}:
        if {code for row_year, code in keys if row_year == year} != set(range(1, 48)):
            raise ValueError(f"Incomplete prefecture coverage in {filename}, {year}")
    for row in rows:
        record = {"year": int(row["YEAR"]), "prefectureCode": int(row["PREFECTURE_CODE"]), "tripType": trip_type}
        for key, column in METRICS.items():
            value = row[f"AVG_{kind}_TRIP_{column}_COST_PER_PERSON"]
            if not value:
                record[key] = None
                continue
            amount = Decimal(value) * 10000
            if amount < 0 or amount != amount.to_integral_value():
                raise ValueError(f"Invalid yen amount: {filename}, {column}, {value}")
            record[key] = int(amount)
        records.append(record)

guests = [
    {"year": int(row["YEAR"]), "prefectureCode": int(row["PREFECTURE_CODE"]),
     "total": None if not row["TOTAL_GUEST_COUNT"] else int(row["TOTAL_GUEST_COUNT"])}
    for row in read_csv("01_syukuhakuryokoutoukeityousa.csv")
]
payload = {
    "dataset": "Project LINKS 観光統計データ（2025年度）",
    "sourceUrl": "https://www.geospatial.jp/ckan/dataset/links_kankoutoukei_2025",
    "years": sorted({row["year"] for row in records}, reverse=True),
    "unit": "JPY per person per trip", "records": records, "guestCounts": guests,
}
target = APP / "src/data/links-tourism.json"
target.parent.mkdir(parents=True, exist_ok=True)
target.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
print(f"Imported {len(records)} cost records and {len(guests)} guest-count records.")
