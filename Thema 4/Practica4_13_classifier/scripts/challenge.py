"""Перевірка узагальнення на «складному» наборі: техніка інших типів, ніж у навчальній вибірці
(квадрокоптери, БТР/MRAP на колесах, легкі вантажівки). Оцінюються обидві моделі."""
import json

import torch
from PIL import Image

from common import CLASSES, EVAL_TF, ROOT, build_model

res = {}
files = [(f, y) for y, c in enumerate(CLASSES) for f in sorted((ROOT / "data" / "challenge" / c).glob("*.jpg"))]
for mode in ["feature_extraction", "fine_tuning"]:
    model = build_model(pretrained=False, unfreeze_layer4=False)
    model.load_state_dict(torch.load(ROOT / "models" / f"resnet18_{mode}.pt", map_location="cpu")); model.eval()
    out = []
    for f, y in files:
        with torch.no_grad():
            p = torch.softmax(model(EVAL_TF(Image.open(f).convert("RGB")).unsqueeze(0)), 1)[0]
        out.append({"file": str(f.relative_to(ROOT)).replace("\\", "/"), "true": CLASSES[y],
                    "pred": CLASSES[int(p.argmax())], "confidence": float(p.max())})
    acc = sum(o["true"] == o["pred"] for o in out) / len(out)
    res[mode] = {"accuracy": acc, "n": len(out), "predictions": out}
    print(mode, "CHALLENGE ACC", round(acc, 3), "n", len(out))
json.dump(res, open(ROOT / "results" / "challenge.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print("CHALLENGE_DONE")
