"""Перевірка: чи можна відрізнити «зразок є в базі» від «зразка немає в базі»."""
import json, sys
from pathlib import Path
import torch
from PIL import Image
sys.path.insert(0, str(Path(__file__).resolve().parent))
from common import CLASSES, EVAL_TF, ROOT, load_trained
import identify as I
clf, bb = load_trained(), I.load_backbone()
split = json.loads((ROOT / "data" / "split.json").read_text(encoding="utf-8"))
g = I.build_gallery(bb, [f for f, _ in split["train"] + split["val"]])
def stats(paths):
    out = []
    for p in paths:
        img = Image.open(p)
        with torch.no_grad():
            cls = CLASSES[int(clf(EVAL_TF(img.convert("RGB")).unsqueeze(0)).argmax())]
        r = I.rank_models(bb, g, img, cls, top=4)
        out.append((round(r[0][1], 3), round(r[0][1] - r[1][1], 3)))
    return out
t = stats([ROOT / f for f, _ in split["test"]])
c = stats(sorted((ROOT / "data" / "challenge").rglob("*.jpg")))
print("TEST top/margin:", sorted(t))
print("CHAL top/margin:", sorted(c))
