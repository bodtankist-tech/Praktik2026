"""«Розпізнавач техніки» — навчальний застосунок: фото → клас → впевненість → ТТХ.

Запуск: ярлик «Розпізнавач техніки» на робочому столі, подвійний клік на run_app.bat,
або в VS Code: Run ▶ (F5) → «Розпізнавач техніки (4.13)».
Кнопка «Відкрити фото» — вибрати власний знімок; «Наступний приклад» — перегорнути
знімки з тестового та «складного» наборів, які модель не бачила під час навчання.
Праворуч — тактико-технічні характеристики: ТОП-3 найсхожіших зразків з бази
(scripts/identify.py) як підказка оператору; клік на зразок — його ТТХ (data/ttx.json).
"""
import ctypes
import json
import sys
import tkinter as tk
import webbrowser
from pathlib import Path
from tkinter import filedialog, messagebox

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
TTX = json.loads((ROOT / "data" / "ttx.json").read_text(encoding="utf-8"))

model = None      # класифікатор (завантажується після появи вікна, див. нижче)
ident = None      # (backbone, gallery) для визначення зразка; None — показуємо картку класу
split = json.load(open(ROOT / "data" / "split.json"))
examples = [ROOT / f for f, _ in split["test"]]
examples += sorted((ROOT / "data" / "challenge").rglob("*.jpg"))
truth = {str(ROOT / f): CLASSES[y] for f, y in split["test"]}
truth.update({str(p): p.parent.name for p in (ROOT / "data" / "challenge").rglob("*.jpg")})
state = {"i": -1, "cls": None, "rank": [], "unknown": False}


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
    cls = CLASSES[k]
    verdict.configure(text=CLASS_UA[cls], fg=COLORS[cls])
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
    state["cls"] = cls
    state["rank"] = []
    state["unknown"] = False
    if ident:
        from identify import THRESHOLD, rank_models
        state["rank"] = rank_models(ident[0], ident[1], img, cls)
        if state["rank"] and state["rank"][0][1] < THRESHOLD:
            state["rank"], state["unknown"] = [], True
    show_candidates()
    show_card(state["rank"][0][0] if state["rank"] else None)


# ---------- панель ТТХ ----------
def show_candidates():
    for w in cand_row.winfo_children():
        w.destroy()
    if not state["rank"]:
        cand_hint.configure(text=("Схожого зразка в базі (12 зразків) немає — показано загальну картку класу"
                                  if state.get("unknown") else "Зразок не визначається — показано загальну картку класу"))
        return
    cand_hint.configure(text="Можливі зразки з бази (підказка — підтверджує оператор):")
    for mid, sim in state["rank"]:
        b = tk.Button(cand_row, text=f"{TTX['models'][mid]['name']}\nсхожість {sim:.0%}", command=lambda m=mid: show_card(m),
                      bg="#2b3428", fg=FG, activebackground="#3a4a33", relief="flat", font=("Segoe UI", 9, "bold"),
                      padx=8, pady=4, justify="center")
        b.pack(side="left", padx=(0, 6))
        b.mid = mid


def show_card(mid):
    for b in cand_row.winfo_children():
        b.configure(bg=("#4c6142" if getattr(b, "mid", None) == mid else "#2b3428"))
    for w in specs.winfo_children():
        w.destroy()
    cls = state["cls"]
    if mid:
        m = TTX["models"][mid]
        card_name.configure(text=m["name"], fg=COLORS[cls])
        card_sub.configure(text=m["type"] + (f"  ·  {m['variant']}" if m["variant"] else ""))
        rows = [("Країна", m["country"])] + [tuple(r) for r in m["specs"]]
        src_link.configure(text="Джерело: " + m["source"].split("//")[1].split("/")[0], cursor="hand2")
        src_link.url = m["source"]
    else:
        c = TTX["classes"][cls]
        card_name.configure(text=c["name"], fg=COLORS[cls])
        card_sub.configure(text=c["type"])
        rows = [tuple(r) for r in c["specs"]]
        src_link.configure(text="", cursor=""); src_link.url = None
    for r, (k, v) in enumerate(rows):
        tk.Label(specs, text=k, bg=PANEL, fg=MUTED, font=("Segoe UI", 10), anchor="nw", justify="left",
                 wraplength=190).grid(row=r, column=0, sticky="nw", pady=3, padx=(0, 10))
        tk.Label(specs, text=v, bg=PANEL, fg=FG, font=("Segoe UI", 10, "bold"), anchor="nw", justify="left",
                 wraplength=230).grid(row=r, column=1, sticky="nw", pady=3)


def open_source(_e=None):
    if getattr(src_link, "url", None):
        webbrowser.open(src_link.url)


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
try:
    root.iconbitmap(str(ROOT / "icon.ico"))
except Exception:
    pass
tk.Label(root, text="РОЗПІЗНАВАЧ ТЕХНІКИ", bg=BG, fg=FG, font=("Segoe UI", 18, "bold")).pack(pady=(14, 0))
tk.Label(root, text="БПЛА · бронетехніка · вантажні автомобілі  |  ResNet18 (ImageNet) + новий шар на 3 класи",
         bg=BG, fg=MUTED, font=("Segoe UI", 9)).pack()
tk.Label(root, text="Навчальний проєкт НУОУ · відкриті знімки Wikimedia Commons (CC / public domain) · ТТХ з відкритих джерел",
         bg=BG, fg="#5f6b56", font=("Segoe UI", 8)).pack(side="bottom", pady=8)
body = tk.Frame(root, bg=BG); body.pack(padx=20, pady=12)
left = tk.Frame(body, bg=BG); left.pack(side="left", anchor="n")
right = tk.Frame(body, bg=PANEL, padx=18, pady=16); right.pack(side="left", anchor="n", fill="y", padx=(18, 0))

pic = tk.Label(left, bg=PANEL, width=560, height=340); pic.pack()
verdict = tk.Label(left, text="Оберіть фото", bg=BG, fg=FG, font=("Segoe UI", 22, "bold")); verdict.pack(pady=(10, 0))
conf = tk.Label(left, text="", bg=BG, fg=MUTED, font=("Segoe UI", 11)); conf.pack()
bars = tk.Canvas(left, width=520, height=110, bg=BG, highlightthickness=0); bars.pack(pady=8)
row = tk.Frame(left, bg=BG); row.pack(pady=4)
for text, cmd in [("Відкрити фото…", open_file), ("Наступний приклад ▶", next_example)]:
    tk.Button(row, text=text, command=cmd, bg="#3a4a33", fg=FG, activebackground="#4c6142", relief="flat",
              font=("Segoe UI", 11, "bold"), padx=14, pady=6).pack(side="left", padx=6)
src = tk.Label(left, text="", bg=BG, fg=MUTED, font=("Segoe UI", 9)); src.pack(pady=(6, 0))

tk.Label(right, text="ТАКТИКО-ТЕХНІЧНІ ХАРАКТЕРИСТИКИ", bg=PANEL, fg="#c9a227",
         font=("Segoe UI", 10, "bold")).pack(anchor="w")
cand_hint = tk.Label(right, text="", bg=PANEL, fg=MUTED, font=("Segoe UI", 9), wraplength=420, justify="left")
cand_hint.pack(anchor="w", pady=(8, 4))
cand_row = tk.Frame(right, bg=PANEL); cand_row.pack(anchor="w")
card_name = tk.Label(right, text="—", bg=PANEL, fg=FG, font=("Segoe UI", 20, "bold")); card_name.pack(anchor="w", pady=(14, 0))
card_sub = tk.Label(right, text="", bg=PANEL, fg=MUTED, font=("Segoe UI", 9), wraplength=420, justify="left")
card_sub.pack(anchor="w", pady=(0, 10))
specs = tk.Frame(right, bg=PANEL); specs.pack(anchor="w", fill="x")
src_link = tk.Label(right, text="", bg=PANEL, fg="#5aa9e6", font=("Segoe UI", 9, "underline")); src_link.pack(anchor="w", pady=(12, 0))
src_link.bind("<Button-1>", open_source)
tk.Label(right, text="Зразок — орієнтовно: на тесті перший варіант правильний у 56 %,\nсеред трьох — у 96 % фото. Остаточне рішення за оператором.",
         bg=PANEL, fg="#7d876f", font=("Segoe UI", 8), justify="left").pack(side="bottom", anchor="w", pady=(16, 0))

# Вікно з'являється одразу; моделі (≈ 5–10 с) вантажаться вже при відкритому вікні
verdict.configure(text="Завантаження моделі…", fg=MUTED)
root.update()
try:
    model = load_trained()
except Exception as e:  # pythonw не має консолі — показуємо помилку у вікні
    messagebox.showerror("Розпізнавач техніки", f"Не вдалося завантажити модель:\n{e}\n\n"
                         "Перевірте, що встановлено Python 3.12 з бібліотеками з requirements.txt.")
    root.destroy(); sys.exit(1)
try:  # визначення зразка — необов'язкове: без нього показується картка класу
    from identify import load_backbone, load_gallery
    _bb = load_backbone()
    ident = (_bb, load_gallery(_bb))
except Exception:
    ident = None
verdict.configure(text="Оберіть фото", fg=FG)

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
