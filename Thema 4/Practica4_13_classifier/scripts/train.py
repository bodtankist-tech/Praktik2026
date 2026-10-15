"""Донавчання ResNet18 для трьох класів техніки: БПЛА, бронетехніка, вантажівки.

Порівнюються два режими transfer learning:
  A) feature extraction — навчається лише новий фінальний шар fc;
  B) fine-tuning — додатково розморожено останній блок layer4.
Найкраща модель за якістю на валідації зберігається в models/.
"""
import json, random, time
from pathlib import Path

import numpy as np
import torch
from PIL import Image
from sklearn.metrics import accuracy_score, classification_report, confusion_matrix
from torch import nn
from torch.utils.data import DataLoader, Dataset

from common import CLASSES, EVAL_TF, ROOT, TRAIN_TF, build_model

SEED = 42
random.seed(SEED); np.random.seed(SEED); torch.manual_seed(SEED)
DATA = ROOT / "data" / "clean"
N_TRAIN, N_VAL = 20, 4          # на клас; решта — тест (нові, не бачені моделлю знімки)
EPOCHS = 12


class Images(Dataset):
    def __init__(self, items, tf):
        self.items, self.tf = items, tf
    def __len__(self):
        return len(self.items)
    def __getitem__(self, i):
        path, y = self.items[i]
        return self.tf(Image.open(ROOT / path).convert("RGB")), y


def make_split():
    split = {"train": [], "val": [], "test": []}
    for y, cls in enumerate(CLASSES):
        files = sorted((DATA / cls).glob("*.jpg"))
        random.Random(SEED).shuffle(files)
        rel = [str(f.relative_to(ROOT)).replace("\\", "/") for f in files]
        split["train"] += [(p, y) for p in rel[:N_TRAIN]]
        split["val"] += [(p, y) for p in rel[N_TRAIN:N_TRAIN + N_VAL]]
        split["test"] += [(p, y) for p in rel[N_TRAIN + N_VAL:]]
    return split


@torch.no_grad()
def predict(model, items):
    model.eval()
    probs = []
    for x, _ in DataLoader(Images(items, EVAL_TF), batch_size=16):
        probs.append(torch.softmax(model(x), 1))
    return torch.cat(probs).numpy()


def train(mode, split):
    model = build_model(unfreeze_layer4=(mode == "fine_tuning"))
    params = [{"params": model.fc.parameters(), "lr": 1e-3}]
    if mode == "fine_tuning":
        params.append({"params": model.layer4.parameters(), "lr": 1e-4})
    opt = torch.optim.Adam(params)
    loss_fn = nn.CrossEntropyLoss()
    loader = DataLoader(Images(split["train"], TRAIN_TF), batch_size=16, shuffle=True,
                        generator=torch.Generator().manual_seed(SEED))
    y_val = [y for _, y in split["val"]]
    hist, best, best_state = [], -1, None
    for ep in range(1, EPOCHS + 1):
        model.train()
        tot = 0.0
        for x, y in loader:
            opt.zero_grad()
            loss = loss_fn(model(x), y)
            loss.backward(); opt.step()
            tot += loss.item() * len(y)
        val_acc = accuracy_score(y_val, predict(model, split["val"]).argmax(1))
        hist.append({"epoch": ep, "loss": tot / len(split["train"]), "val_acc": val_acc})
        print(f"{mode:16s} epoch {ep:2d} loss {hist[-1]['loss']:.3f} val_acc {val_acc:.3f}", flush=True)
        if val_acc >= best:
            best, best_state = val_acc, {k: v.clone() for k, v in model.state_dict().items()}
    model.load_state_dict(best_state)
    return model, hist


def main():
    t0 = time.time()
    split = make_split()
    (ROOT / "results").mkdir(exist_ok=True); (ROOT / "models").mkdir(exist_ok=True)
    json.dump(split, open(ROOT / "data" / "split.json", "w"), indent=1)
    print({k: len(v) for k, v in split.items()})
    y_test = np.array([y for _, y in split["test"]])
    summary, runs = {}, {}
    for mode in ["feature_extraction", "fine_tuning"]:
        model, hist = train(mode, split)
        p = predict(model, split["test"])
        acc = accuracy_score(y_test, p.argmax(1))
        summary[mode] = {"test_acc": acc, "best_val_acc": max(h["val_acc"] for h in hist), "history": hist}
        runs[mode] = (model, p)
        torch.save(model.state_dict(), ROOT / "models" / f"resnet18_{mode}.pt")
        summary[mode]["test_predictions"] = [
            {"file": f, "true": CLASSES[y], "pred": CLASSES[int(pr.argmax())], "confidence": float(pr.max())}
            for (f, y), pr in zip(split["test"], p)]
        print(mode, "TEST ACC", round(acc, 3))
    best_mode = max(summary, key=lambda m: (summary[m]["best_val_acc"], summary[m]["test_acc"]))
    model, p = runs[best_mode]
    torch.save(model.state_dict(), ROOT / "models" / "resnet18_vehicles.pt")
    pred = p.argmax(1)
    report = {
        "classes": CLASSES,
        "split_sizes": {k: len(v) for k, v in split.items()},
        "modes": summary,
        "selected_mode": best_mode,
        "test_accuracy": float(accuracy_score(y_test, pred)),
        "confusion_matrix": confusion_matrix(y_test, pred, labels=[0, 1, 2]).tolist(),
        "report": classification_report(y_test, pred, target_names=CLASSES, output_dict=True, zero_division=0),
        "test_predictions": [
            {"file": f, "true": CLASSES[y], "pred": CLASSES[int(pr.argmax())],
             "confidence": float(pr.max()), "probs": [float(v) for v in pr]}
            for (f, y), pr in zip(split["test"], p)],
        "train_time_sec": round(time.time() - t0, 1),
    }
    json.dump(report, open(ROOT / "results" / "metrics.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print("SELECTED", best_mode, "TEST_ACC", round(report["test_accuracy"], 3), "TIME", report["train_time_sec"])
    print("TRAIN_DONE")


if __name__ == "__main__":
    main()
