"""«Розпізнавач техніки» — навчальний застосунок: фото → клас → впевненість.

Запуск: python app.py   (або подвійний клік на run_app.bat)
Кнопка «Відкрити фото» — вибрати власний знімок; «Наступний приклад» — перегорнути
знімки з тестового та «складного» наборів, які модель не бачила під час навчання.
"""
import ctypes
import json
import sys
import tkinter as tk
from pathlib import Path
from tkinter import filedialog

import torch
from PIL import Image, ImageTk

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT / "scripts"))
from common import CLASS_UA, CLASSES, EVAL_TF, load_trained  # noqa: E402

try:  # чіткий текст на екранах з масштабуванням Windows
    ctypes.windll.shcore.SetProcessDpiAwareness(1)
except Exception:
    pass

BG, PANEL, FG, MUTED = "#151a14", "#1f261d", "#e9eee4", "#9aa58f"
COLORS = {"uav": "#5aa9e6", "armor": "#c9a227", "truck": "#7fb069"}

model = load_trained()
split = json.load(open(ROOT / "data" / "split.json"))
examples = [ROOT / f for f, _ in split["test"]]
examples += sorted((ROOT / "data" / "challenge").rglob("*.jpg"))
truth = {str(ROOT / f): CLASSES[y] for f, y in split["test"]}
truth.update({str(p): p.parent.name for p in (ROOT / "data" / "challenge").rglob("*.jpg")})
state = {"i": -1}


def classify(path):
    img = Image.open(path).convert("RGB")
    with torch.no_grad():
        p = torch.softmax(model(EVAL_TF(img).unsqueeze(0)), 1)[0].tolist()
    return img, p


def show(path):
    img, probs = classify(path)
    view = img.copy(); view.thumbnail((560, 340))
    photo = ImageTk.PhotoImage(view)
    pic.configure(image=photo); pic.image = photo
    k = max(range(3), key=lambda i: probs[i])
    verdict.configure(text=CLASS_UA[CLASSES[k]], fg=COLORS[CLASSES[k]])
    conf.configure(text=f"впевненість {probs[k]:.0%}" + ("  ·  низька — потрібна перевірка оператором" if probs[k] < 0.7 else ""))
    t = truth.get(str(Path(path).resolve()))
    src.configure(text=f"{Path(path).name}" + (f"   |   справжній клас: {CLASS_UA[t]}" if t else ""))
    bars.delete("all")
    for i, c in enumerate(CLASSES):
        y = 18 + i * 34
        bars.create_text(0, y, text=CLASS_UA[c], anchor="w", fill=FG, font=("Segoe UI", 11))
        bars.create_rectangle(190, y - 9, 190 + 260, y + 9, fill="#2b3428", outline="")
        bars.create_rectangle(190, y - 9, 190 + 260 * probs[i], y + 9, fill=COLORS[c], outline="")
        bars.create_text(460, y, text=f"{probs[i]:.0%}", anchor="w", fill=FG, font=("Segoe UI", 11, "bold"))


def open_file():
    path = filedialog.askopenfilename(filetypes=[("Зображення", "*.jpg *.jpeg *.png *.bmp *.webp")])
    if path:
        show(path)


def next_example():
    state["i"] = (state["i"] + 1) % len(examples)
    show(examples[state["i"]])


root = tk.Tk()
root.title("Розпізнавач техніки · ResNet18 transfer learning")
root.configure(bg=BG)
tk.Label(root, text="РОЗПІЗНАВАЧ ТЕХНІКИ", bg=BG, fg=FG, font=("Segoe UI", 18, "bold")).pack(pady=(14, 0))
tk.Label(root, text="БПЛА · бронетехніка · вантажні автомобілі  |  ResNet18 (ImageNet) + новий шар на 3 класи",
         bg=BG, fg=MUTED, font=("Segoe UI", 9)).pack()
pic = tk.Label(root, bg=PANEL, width=560, height=340); pic.pack(padx=20, pady=12)
verdict = tk.Label(root, text="Оберіть фото", bg=BG, fg=FG, font=("Segoe UI", 22, "bold")); verdict.pack()
conf = tk.Label(root, text="", bg=BG, fg=MUTED, font=("Segoe UI", 11)); conf.pack()
bars = tk.Canvas(root, width=520, height=110, bg=BG, highlightthickness=0); bars.pack(pady=8)
row = tk.Frame(root, bg=BG); row.pack(pady=4)
for text, cmd in [("Відкрити фото…", open_file), ("Наступний приклад ▶", next_example)]:
    tk.Button(row, text=text, command=cmd, bg="#3a4a33", fg=FG, activebackground="#4c6142", relief="flat",
              font=("Segoe UI", 11, "bold"), padx=14, pady=6).pack(side="left", padx=6)
src = tk.Label(root, text="", bg=BG, fg=MUTED, font=("Segoe UI", 9)); src.pack(pady=(6, 0))
tk.Label(root, text="Навчальний проєкт НУОУ · відкриті знімки Wikimedia Commons (CC / public domain)",
         bg=BG, fg="#5f6b56", font=("Segoe UI", 8)).pack(side="bottom", pady=8)
# Режим знімка для звіту: python app.py --snapshot <фото> <файл.png>
if len(sys.argv) == 4 and sys.argv[1] == "--snapshot":
    from PIL import ImageGrab
    show(Path(sys.argv[2]))
    def grab():
        root.update()
        x, y = root.winfo_rootx(), root.winfo_rooty()
        ImageGrab.grab((x, y, x + root.winfo_width(), y + root.winfo_height())).save(sys.argv[3])
        root.destroy()
    root.after(1500, grab)
else:
    next_example()
root.mainloop()
