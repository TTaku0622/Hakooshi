"""Extract 2024 prefecture/month totals from JTA's original annual workbook (stdlib only)."""
import json
import re
import zipfile
import xml.etree.ElementTree as ET
from pathlib import Path

APP = Path(__file__).resolve().parents[1]
NS = {"m": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
R = "{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id"
records = [{"prefectureCode": code, "months": []} for code in range(1, 48)]
with zipfile.ZipFile(APP / "public/data/jta/stays-2024.xlsx") as archive:
    strings = ["".join(n.itertext()) for n in ET.fromstring(archive.read("xl/sharedStrings.xml")).findall("m:si", NS)]
    relations = {n.attrib["Id"]: n.attrib["Target"] for n in ET.fromstring(archive.read("xl/_rels/workbook.xml.rels"))}
    sheets = {n.attrib["name"]: relations[n.attrib[R]] for n in ET.fromstring(archive.read("xl/workbook.xml")).findall("m:sheets/m:sheet", NS)}
    def cells(name):
        target = sheets[name]
        location = target.lstrip("/") if target.startswith("/") else "xl/" + target
        result = {}
        for node in ET.fromstring(archive.read(location)).findall(".//m:sheetData/m:row/m:c", NS):
            val = node.find("m:v", NS)
            if val is not None and val.text is not None:
                result[node.attrib["r"]] = strings[int(val.text)] if node.attrib.get("t") == "s" else float(val.text)
        return result
    def number(value, maximum=None):
        if value is None or isinstance(value, str):
            return None
        if value < 0 or (maximum is not None and value > maximum):
            raise ValueError(f"Invalid value: {value}")
        return value
    for month in range(1, 13):
        occupancy = cells(f"第8表({month}月)")
        guests = cells(f"第2表({month}月)")
        for code in range(1, 48):
            row = code + 7
            label = str(occupancy.get(f"A{row}", "")).strip()
            if not re.match(f"{code:02d}", label):
                raise ValueError(f"Unexpected prefecture at {month}/{row}: {label}")
            if guests.get(f"A{row}") != occupancy.get(f"A{row}"):
                raise ValueError("Mismatched prefecture rows")
            records[code - 1]["months"].append({"month": month, "occupancy": number(occupancy.get(f"B{row}"), 100), "guestNights": number(guests.get(f"B{row}"))})
payload = {
    "year": 2024, "sourceName": "観光庁 宿泊旅行統計調査 2024年・年間値（確定値）",
    "sourceUrl": "https://www.mlit.go.jp/kankocho/tokei_hakusyo/shukuhakutokei.html",
    "downloadUrl": "https://www.mlit.go.jp/kankocho/content/002026764.xlsx", "records": records,
}
(APP / "src/data/stay-seasonality.json").write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
print(f"Imported {len(records)} prefectures x 12 months; Osaka January occupancy={records[26]['months'][0]['occupancy']}%")
