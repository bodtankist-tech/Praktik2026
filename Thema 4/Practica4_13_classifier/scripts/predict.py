"""Класифікація одного або кількох знімків: python predict.py фото1.jpg [фото2.jpg ...]"""
import sys

import torch
from PIL import Image

from common import CLASS_UA, CLASSES, EVAL_TF, load_trained

model = load_trained()
for path in sys.argv[1:]:
    x = EVAL_TF(Image.open(path).convert("RGB")).unsqueeze(0)
    with torch.no_grad():
        p = torch.softmax(model(x), 1)[0]
    k = int(p.argmax())
    probs = ", ".join(f"{CLASS_UA[c]} {v:.0%}" for c, v in zip(CLASSES, p.tolist()))
    print(f"{path}: {CLASS_UA[CLASSES[k]]} (впевненість {p[k]:.0%}) | {probs}")
