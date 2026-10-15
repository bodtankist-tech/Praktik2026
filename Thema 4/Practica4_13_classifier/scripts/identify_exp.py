"""Порівняння способів визначення зразка (експеримент)."""
import csv, json, sys
from collections import defaultdict
from pathlib import Path
import torch
from PIL import Image
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
from common import CLASSES, EVAL_TF, load_trained, build_model  # noqa
from torchvision import transforms
TTX = json.loads((ROOT / "data" / "ttx.json").read_text(encoding="utf-8"))
Q2ID = {m["query"]: k for k, m in TTX["models"].items()}
split = json.loads((ROOT / "data" / "split.json").read_text(encoding="utf-8"))
cred = {r["file"]: r for r in csv.DictReader(open(ROOT / "data" / "credits.csv", encoding="utf-8"))}
def mid(f): return Q2ID.get(cred[f.replace("data/clean/", "")]["query"])
ft = load_trained(); base = build_model(pretrained=True).eval()
FLIP = transforms.functional.hflip
@torch.no_grad()
def feat(m, img, mode):
    x = EVAL_TF(img.convert("RGB")).unsqueeze(0)
    if mode.endswith("tta"):
        x = torch.cat([x, FLIP(x)])
    x = m.maxpool(m.relu(m.bn1(m.conv1(x)))); x = m.layer2(m.layer1(x)); l3 = m.layer3(x); l4 = m.layer4(l3)
    v4 = torch.flatten(m.avgpool(l4), 1); v3 = torch.flatten(m.avgpool(l3), 1)
    v = torch.cat([v3 / v3.norm(dim=1, keepdim=True), v4 / v4.norm(dim=1, keepdim=True)], 1) if "cat" in mode else v4
    v = v.mean(0)
    return v / v.norm()
imgs = {f: Image.open(ROOT / f) for f, _ in split["train"] + split["val"] + split["test"]}
gal = [f for f, _ in split["train"] + split["val"]]; tst = [f for f, _ in split["test"]]
cls_of = lambda i: TTX["models"][i]["class"]
for name, m in [("finetuned", ft), ("imagenet", base)]:
    for mode in ["l4", "cat", "l4tta", "cattta"]:
        G = torch.stack([feat(m, imgs[f], mode) for f in gal]); gid = [mid(f) for f in gal]
        res = {}
        for k in [1, 3, 5]:
            ok = 0
            for f in tst:
                v = feat(m, imgs[f], mode); s = G @ v; c = cls_of(mid(f))
                cand = sorted([(float(si), i) for si, i in zip(s, gid) if cls_of(i) == c], reverse=True)
                vote = defaultdict(float)
                for si, i in cand[:k]: vote[i] += si
                ok += max(vote, key=vote.get) == mid(f)
            res[f"k{k}"] = round(ok / len(tst), 3)
        # centroid
        cen = defaultdict(list)
        for v, i in zip(G, gid): cen[i].append(v)
        C = {i: torch.stack(v).mean(0) for i, v in cen.items()}
        ok = 0
        for f in tst:
            v = feat(m, imgs[f], mode); c = cls_of(mid(f))
            best = max((i for i in C if cls_of(i) == c), key=lambda i: float(C[i] @ v)); ok += best == mid(f)
        res["centroid"] = round(ok / len(tst), 3)
        print(name, mode, res, flush=True)
