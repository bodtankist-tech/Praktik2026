"""Орієнтовне визначення конкретного зразка техніки (для картки ТТХ) без перенавчання.

Як працює. Класифікатор (донавчена ResNet18) визначає клас: БПЛА / бронетехніка /
вантажівка. Далі вихідна ResNet18 з ImageNet (без донавчання) перетворює фото на вектор
ознак: середні значення шарів layer3 і layer4 (256 + 512 чисел), також для дзеркального
відображення фото. Цей вектор порівнюється (косинусна схожість) з «галереєю» — фото з
нашого набору, для яких відомо, що це за зразок (поле query у data/credits.csv). Зразки
впорядковуються за схожістю найближчого фото; застосунок показує ТОП-3 як підказку
оператору, а ТТХ — для обраного.

Чому ImageNet-ознаки, а не донавчені: донавчена мережа вчилася лише розрізняти 3 класи і
«стирає» відмінності між зразками всередині класу. Порівняння на 27 тестових фото
(scripts/identify_exp.py): донавчені ознаки — 41 %, ImageNet layer3+layer4 — 56 %
правильних зразків першим варіантом і 96 % — серед трьох (випадкове вгадування першим
серед 4 зразків класу — 25 %). Тому результат ОРІЄНТОВНИЙ і в застосунку позначений як
підказка, яку підтверджує оператор. Техніку, якої немає серед 12 зразків бази, програма
може прийняти за схожий зразок; поріг THRESHOLD відсікає лише частину таких випадків.

Запуск: python scripts/identify.py — перевірка на тестових фото (галерея без них) і
побудова робочої галереї з усіх 99 фото → models/gallery.pt, звіт → results/identify.json.
"""
import csv
import json
import sys
from pathlib import Path

import torch
from PIL import Image
from torchvision.transforms import functional as TF

sys.path.insert(0, str(Path(__file__).resolve().parent))
from common import CLASSES, EVAL_TF, ROOT, build_model, load_trained  # noqa: E402

GALLERY = ROOT / "models" / "gallery.pt"
TTX = json.loads((ROOT / "data" / "ttx.json").read_text(encoding="utf-8"))
QUERY_TO_ID = {m["query"]: k for k, m in TTX["models"].items()}
# Найменша схожість серед тестових фото відомих зразків — 0,844; у фото техніки, якої немає
# в базі (data/challenge), схожість 0,76–0,93. Нижче порогу зразок не називаємо (відсікає
# ≈ 30 % «чужих» фото, жодного «свого»; scripts/identify_check.py).
THRESHOLD = 0.84


def load_backbone():
    """ResNet18 з ImageNet без змін (ваги з кешу torchvision; перший раз — з інтернету)."""
    return build_model(pretrained=True).eval()


@torch.no_grad()
def features(backbone, img: Image.Image) -> torch.Tensor:
    m = backbone
    x = EVAL_TF(img.convert("RGB")).unsqueeze(0)
    x = torch.cat([x, TF.hflip(x)])
    x = m.layer2(m.layer1(m.maxpool(m.relu(m.bn1(m.conv1(x))))))
    l3 = m.layer3(x)
    l4 = m.layer4(l3)
    v3 = torch.flatten(m.avgpool(l3), 1)
    v4 = torch.flatten(m.avgpool(l4), 1)
    v = torch.cat([v3 / v3.norm(dim=1, keepdim=True), v4 / v4.norm(dim=1, keepdim=True)], 1).mean(0)
    return v / v.norm()


def _labelled(files):
    credits = {r["file"]: r for r in csv.DictReader(open(ROOT / "data" / "credits.csv", encoding="utf-8"))}
    out = []
    for f in files:
        mid = QUERY_TO_ID.get(credits.get(f.replace("data/clean/", ""), {}).get("query"))
        if mid:
            out.append((f, mid))
    return out


def build_gallery(backbone, files) -> dict:
    items = _labelled(files)
    return {"vecs": torch.stack([features(backbone, Image.open(ROOT / f)) for f, _ in items]),
            "ids": [m for _, m in items], "files": [f for f, _ in items]}


def load_gallery(backbone) -> dict:
    if GALLERY.exists():
        return torch.load(GALLERY)
    split = json.loads((ROOT / "data" / "split.json").read_text(encoding="utf-8"))
    g = build_gallery(backbone, [f for part in split.values() for f, _ in part])
    torch.save(g, GALLERY)
    return g


def rank_models(backbone, gallery, img: Image.Image, cls: str, top: int = 3):
    """→ [(id зразка, схожість найближчого фото цього зразка), …] у межах класу cls."""
    v = features(backbone, img)
    best = {}
    for s, i in zip((gallery["vecs"] @ v).tolist(), gallery["ids"]):
        if TTX["models"][i]["class"] == cls and s > best.get(i, -1):
            best[i] = s
    return sorted(best.items(), key=lambda t: -t[1])[:top]


def main():
    clf, backbone = load_trained(), load_backbone()
    split = json.loads((ROOT / "data" / "split.json").read_text(encoding="utf-8"))
    g = build_gallery(backbone, [f for f, _ in split["train"] + split["val"]])
    rows, top1, top3 = [], 0, 0
    for f, mid in _labelled([f for f, _ in split["test"]]):
        img = Image.open(ROOT / f)
        with torch.no_grad():
            cls = CLASSES[int(clf(EVAL_TF(img.convert("RGB")).unsqueeze(0)).argmax())]
        r = rank_models(backbone, g, img, cls)
        ids = [i for i, _ in r]
        top1 += ids[:1] == [mid]
        top3 += mid in ids
        rows.append({"file": f, "true": mid, "top3": [[i, round(s, 3)] for i, s in r]})
    n = len(rows)
    summary = {"test_photos": n, "gallery_photos": len(g["ids"]), "top1": round(top1 / n, 3), "top3": round(top3 / n, 3),
               "note": "тестові фото не входили в галерею; випадкове вгадування top1 = 25 % (4 зразки на клас)"}
    (ROOT / "results" / "identify.json").write_text(json.dumps({"summary": summary, "test": rows}, ensure_ascii=False, indent=1),
                                                    encoding="utf-8")
    full = build_gallery(backbone, [f for part in split.values() for f, _ in part])
    torch.save(full, GALLERY)
    print(json.dumps(summary, ensure_ascii=False))
    print("Робоча галерея:", len(full["ids"]), "фото →", GALLERY.name)


if __name__ == "__main__":
    main()
