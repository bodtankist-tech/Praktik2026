"""Збір відкритих зображень з Wikimedia Commons (ліцензії CC / public domain).

Для кожного класу виконується кілька пошукових запитів; зберігаються
мініатюри шириною 480 px і файл data/credits.csv з автором і ліцензією.
"""
import csv, json, re, ssl, sys, time, urllib.parse, urllib.request
import certifi
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / "data" / "raw"
UA = {"User-Agent": "NUOU-edu-practice/1.0 (study project; contact via GitHub bodtankist-tech)"}
# Перевірка сертифікатів через актуальний набір certifi (системний набір Windows може бути застарілим)
CTX = ssl.create_default_context(cafile=certifi.where())
PER_CLASS = int(sys.argv[1]) if len(sys.argv) > 1 else 45

QUERIES = {
    "uav": ["Bayraktar TB2", "MQ-9 Reaper drone", "RQ-4 Global Hawk", "MQ-1 Predator",
            "Heron UAV", "ScanEagle UAV", "Hermes 450 UAV", "RQ-7 Shadow", "Wing Loong drone",
            "Orlan-10 UAV", "unmanned aerial vehicle military"],
    "armor": ["T-64 tank", "T-72 tank", "Leopard 2 tank", "M1 Abrams tank", "BMP-2",
              "M2 Bradley", "BTR-4", "Challenger 2 tank", "CV90 infantry fighting vehicle",
              "T-80 tank", "Stryker armored vehicle"],
    "truck": ["KrAZ-6322", "KamAZ military truck", "Ural-4320", "M35 truck",
              "MAN HX military truck", "Oshkosh FMTV", "Tatra 815 military", "HEMTT truck",
              "KrAZ-255", "ZIL-131", "military cargo truck"],
}
# «Складний» набір: техніка, якої немає в навчальних запитах (перевірка узагальнення)
CHALLENGE = {
    "uav": ["DJI Mavic quadcopter", "DJI Phantom drone", "Bayraktar Akinci"],
    "armor": ["BTR-80", "MaxxPro MRAP", "BMP-1", "Kozak armored vehicle"],
    "truck": ["Unimog military", "Iveco military truck", "GAZ-66"],
}
MODE = sys.argv[2] if len(sys.argv) > 2 else "train"
if MODE == "challenge":
    QUERIES, RAW = CHALLENGE, ROOT / "data" / "challenge"
API = "https://commons.wikimedia.org/w/api.php"
BAD = re.compile(r"(diagram|scheme|model|toy|museum plan|drawing|map|logo|svg|interior|cockpit|engine|insignia|patch|crash|wreck)", re.I)

def api(params):
    url = API + "?" + urllib.parse.urlencode({**params, "format": "json"})
    with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=30, context=CTX) as r:
        return json.load(r)

def strip_html(s):
    return re.sub(r"<[^>]+>", "", s or "").strip()

def main():
    rows, seen = [], set()
    for cls, queries in QUERIES.items():
        out = RAW / cls
        out.mkdir(parents=True, exist_ok=True)
        n = 0
        for q in queries:
            if n >= PER_CLASS:
                break
            try:
                data = api({"action": "query", "generator": "search", "gsrnamespace": 6,
                            "gsrsearch": f"{q} filetype:bitmap", "gsrlimit": 12 if MODE == "train" else 4,
                            "prop": "imageinfo", "iiprop": "url|mime|extmetadata", "iiurlwidth": 480})
            except Exception as e:
                print("search error", q, e); continue
            pages = sorted(data.get("query", {}).get("pages", {}).values(), key=lambda p: p.get("index", 0))
            for p in pages:
                if n >= PER_CLASS:
                    break
                title = p["title"]
                if title in seen or BAD.search(title):
                    continue
                ii = (p.get("imageinfo") or [{}])[0]
                if ii.get("mime") not in ("image/jpeg", "image/png"):
                    continue
                meta = ii.get("extmetadata", {})
                lic = strip_html(meta.get("LicenseShortName", {}).get("value", ""))
                if not re.search(r"CC|Public domain|PD", lic, re.I):
                    continue
                fname = f"{cls}_{n+1:03d}.jpg"
                try:
                    req = urllib.request.Request(ii["thumburl"], headers=UA)
                    with urllib.request.urlopen(req, timeout=60, context=CTX) as r:
                        (out / fname).write_bytes(r.read())
                except Exception as e:
                    print("download error", title, e); continue
                seen.add(title); n += 1
                rows.append({"file": f"{cls}/{fname}", "class": cls, "query": q, "title": title,
                             "source": ii.get("descriptionurl", ""),
                             "author": strip_html(meta.get("Artist", {}).get("value", ""))[:120],
                             "license": lic})
                time.sleep(0.3)
        print(cls, n, "images", flush=True)
    if not rows:
        sys.exit("Не вдалося завантажити жодного зображення")
    with open(ROOT / "data" / ("credits.csv" if MODE == "train" else "credits_challenge.csv"), "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
        w.writeheader(); w.writerows(rows)
    print("DONE", len(rows))

if __name__ == "__main__":
    main()
