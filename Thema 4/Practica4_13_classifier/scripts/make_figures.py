"""Графіки для звіту: криві навчання, матриця помилок, демонстрація на нових знімках, помилки."""
import json

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
from PIL import Image

from common import CLASS_UA, CLASSES, ROOT

R = ROOT / "results"
m = json.load(open(R / "metrics.json", encoding="utf-8"))
plt.rcParams.update({"font.size": 11, "figure.dpi": 150})

# 1. Криві навчання для двох режимів
fig, ax = plt.subplots(1, 2, figsize=(10, 3.6))
names = {"feature_extraction": "Лише новий шар fc", "fine_tuning": "fc + розморожений layer4"}
for mode, s in m["modes"].items():
    ep = [h["epoch"] for h in s["history"]]
    ax[0].plot(ep, [h["loss"] for h in s["history"]], marker="o", ms=3, label=names[mode])
    ax[1].plot(ep, [h["val_acc"] for h in s["history"]], marker="o", ms=3, label=names[mode])
ax[0].set_title("Втрати на навчальній вибірці"); ax[0].set_xlabel("Епоха")
ax[1].set_title("Точність на валідації"); ax[1].set_xlabel("Епоха"); ax[1].set_ylim(0, 1.05)
for a in ax: a.grid(alpha=.3); a.legend()
fig.tight_layout(); fig.savefig(R / "training_curves.png"); plt.close(fig)

# 2. Матриця помилок
cm = np.array(m["confusion_matrix"]); lab = [CLASS_UA[c] for c in CLASSES]
fig, ax = plt.subplots(figsize=(4.8, 4.2))
ax.imshow(cm, cmap="Greens")
for i in range(3):
    for j in range(3):
        ax.text(j, i, cm[i, j], ha="center", va="center", fontsize=14,
                color="white" if cm[i, j] > cm.max() / 2 else "black")
ax.set_xticks(range(3), lab, rotation=15); ax.set_yticks(range(3), lab)
ax.set_xlabel("Прогноз моделі"); ax.set_ylabel("Справжній клас")
ax.set_title(f"Тест: точність {m['test_accuracy']:.0%}")
fig.tight_layout(); fig.savefig(R / "confusion_matrix.png"); plt.close(fig)

# 3. Демонстрація: по одному-два правильних прогнози кожного класу + помилки
preds = m["test_predictions"]
def tile(items, fname, title):
    if not items:
        return
    fig, axs = plt.subplots(1, len(items), figsize=(3.2 * len(items), 3.6))
    axs = np.atleast_1d(axs)
    for a, p in zip(axs, items):
        a.imshow(Image.open(ROOT / p["file"]).convert("RGB")); a.axis("off")
        ok = p["true"] == p["pred"]
        a.set_title(f"{CLASS_UA[p['pred']]} — {p['confidence']:.0%}\n(справжній: {CLASS_UA[p['true']]})",
                    color="green" if ok else "red", fontsize=10)
    fig.suptitle(title); fig.tight_layout(); fig.savefig(R / fname); plt.close(fig)

correct = [p for p in preds if p["true"] == p["pred"]]
demo = []
for c in CLASSES:
    demo += sorted([p for p in correct if p["true"] == c], key=lambda p: p["file"])[:2]
tile(demo[:5], "demo_new_images.png", "Нові знімки (не брали участі в навчанні): фото → клас → впевненість")
errors = [p for p in preds if p["true"] != p["pred"]]
fe_err = [p for p in m["modes"]["feature_extraction"]["test_predictions"] if p["true"] != p["pred"]]
tile(fe_err[:3], "errors_feature_extraction.png", "Помилки режиму «лише новий шар» на тестових знімках")

# 4. Складний набір (техніка інших типів, ніж у навчальній вибірці)
ch_path = R / "challenge.json"
if ch_path.exists():
    ch = json.load(open(ch_path, encoding="utf-8"))
    ch_err = [p for p in ch[m["selected_mode"]]["predictions"] if p["true"] != p["pred"]]
    tile(ch_err[:4], "errors_challenge.png", "Складний набір: помилки обраної моделі")
    fig, ax = plt.subplots(figsize=(6, 3.4))
    modes = ["feature_extraction", "fine_tuning"]
    x = np.arange(2)
    ax.bar(x - .18, [m["modes"][k]["test_acc"] for k in modes], .36, label="Тест (типові знімки)", color="#2f6b3a")
    ax.bar(x + .18, [ch[k]["accuracy"] for k in modes], .36, label="Складний набір", color="#c08a2b")
    ax.set_xticks(x, [names[k] for k in modes]); ax.set_ylim(0, 1.1); ax.set_ylabel("Точність")
    for i, k in enumerate(modes):
        ax.text(i - .18, m["modes"][k]["test_acc"] + .02, f"{m['modes'][k]['test_acc']:.0%}", ha="center")
        ax.text(i + .18, ch[k]["accuracy"] + .02, f"{ch[k]['accuracy']:.0%}", ha="center")
    ax.legend(loc="lower right"); ax.grid(axis="y", alpha=.3)
    fig.tight_layout(); fig.savefig(R / "accuracy_comparison.png"); plt.close(fig)
print("FIGURES_DONE", len(demo), "demo,", len(errors), "errors,", len(fe_err), "fe errors")
