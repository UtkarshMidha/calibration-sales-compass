"""Interaction-driven GIFs: real clicks, not just scrolling.

Produces:
  interact-tagesliste.gif  filter -> focus -> claim
  interact-angebot.gif     draft -> DAkkS toggle -> logistics
  interact-assistent.gif   open assistant -> ask -> answer
  interact-palette.gif     Ctrl+K -> search -> jump + EN toggle
  overview.gif             rebuilt hero (best frames incl. Leitung cockpit)
Stills alongside for WALKTHROUGH.md.
"""
import time
from pathlib import Path
from playwright.sync_api import sync_playwright
from PIL import Image

BASE = "http://localhost:3000"
ROOT = Path(__file__).resolve().parent.parent / "demo"
FRAMES = ROOT / "frames"
STILLS = ROOT / "stills"
GIFS = ROOT / "gifs"
VIEWPORT = {"width": 1280, "height": 800}
W = 960


def shot(page, name):
    p = FRAMES / f"{name}.png"
    page.screenshot(path=str(p))
    return p


def to_gif(paths, out, delay=1100):
    imgs = []
    for p in paths:
        im = Image.open(p).convert("RGB")
        if im.width > W:
            im = im.resize((W, round(im.height * W / im.width)), Image.LANCZOS)
        imgs.append(im)
    pal = [im.convert("P", palette=Image.ADAPTIVE, colors=256) for im in imgs]
    pal[0].save(str(out), save_all=True, append_images=pal[1:],
                duration=delay, loop=0, optimize=True)
    print(f"[gif] {out.name} ({out.stat().st_size // 1024} KB)")


with sync_playwright() as pw:
    b = pw.chromium.launch()
    ctx = b.new_context(viewport=VIEWPORT, accept_downloads=True)
    pg = ctx.new_page()

    # ---------- 1. Tagesliste workflow ----------
    pg.goto(BASE + "/tagesliste", wait_until="networkidle", timeout=30000)
    pg.wait_for_timeout(1500)
    f = [shot(pg, "ix-tl-0-start")]
    try:
        sels = pg.locator("select")
        if sels.count() >= 1:
            sels.first.select_option(index=1)  # first Anlass filter value
            pg.wait_for_timeout(1000)
        f.append(shot(pg, "ix-tl-1-filter"))
        pg.locator("select").first.select_option(index=0)
        pg.wait_for_timeout(600)
    except Exception as e:
        print("[warn] filter:", e)
    pg.copy = None
    (STILLS / "02c-tagesliste-filter.png").write_bytes(
        (FRAMES / "ix-tl-1-filter.png").read_bytes())
    # focus: click first recommendation row (contains expected value sign)
    try:
        pg.locator("text=≈").first.click(timeout=6000, position={"x": 5, "y": 5})
    except Exception:
        try:
            pg.mouse.click(700, 320)
        except Exception as e:
            print("[warn] focus:", e)
    pg.wait_for_timeout(1200)
    f.append(shot(pg, "ix-tl-2-focus"))
    (STILLS / "02d-tagesliste-fokus.png").write_bytes(
        (FRAMES / "ix-tl-2-focus.png").read_bytes())
    # claim
    try:
        btn = pg.get_by_role("button", name="Übernehmen")
        if btn.count() > 0:
            btn.first.click(timeout=5000)
            pg.wait_for_timeout(1000)
    except Exception as e:
        print("[warn] claim:", e)
    f.append(shot(pg, "ix-tl-3-claim"))
    to_gif(f, GIFS / "interact-tagesliste.gif")

    # ---------- 2. Quote flow ----------
    pg.goto(BASE + "/kunden/10132", wait_until="networkidle", timeout=30000)
    pg.wait_for_timeout(1200)
    q = [shot(pg, "ix-q-0-kunde")]
    try:
        pg.get_by_role("button", name="Angebot vorbereiten").click(timeout=8000)
        pg.wait_for_url("**/angebote/**", timeout=15000)
        pg.wait_for_timeout(1500)
    except Exception as e:
        print("[warn] draft:", e)
    q.append(shot(pg, "ix-q-1-draft"))
    try:
        pg.get_by_role("button", name="Alle auf DAkkS").click(timeout=6000)
        pg.wait_for_timeout(1000)
    except Exception as e:
        print("[warn] dakks:", e)
    q.append(shot(pg, "ix-q-2-dakks"))
    (STILLS / "06c-angebot-dakks.png").write_bytes(
        (FRAMES / "ix-q-2-dakks.png").read_bytes())
    to_gif(q, GIFS / "interact-angebot.gif")

    # ---------- 3. Assistant ----------
    pg.goto(BASE + "/", wait_until="networkidle", timeout=30000)
    pg.wait_for_timeout(1200)
    a = []
    try:
        pg.keyboard.press("Control+j")
        pg.wait_for_timeout(1200)
        a.append(shot(pg, "ix-a-0-open"))
        box = pg.locator("input[placeholder*='Wen sollte'], input[placeholder*='Who should']")
        if box.count() == 0:
            box = pg.locator(".assistant-box input, aside input, input[placeholder*='Fragen']")
        box.first.fill("Wen sollte ich heute zuerst anrufen?")
        pg.wait_for_timeout(400)
        a.append(shot(pg, "ix-a-1-typed"))
        box.first.press("Enter")
        pg.wait_for_timeout(6000)
        a.append(shot(pg, "ix-a-2-answer"))
        pg.wait_for_timeout(4000)
        a.append(shot(pg, "ix-a-3-answer2"))
        (STILLS / "11-assistent.png").write_bytes(
            (FRAMES / "ix-a-3-answer2.png").read_bytes())
    except Exception as e:
        print("[warn] assistant:", e)
        a.append(shot(pg, "ix-a-fallback"))
    if a:
        to_gif(a, GIFS / "interact-assistent.gif", delay=1400)

    # ---------- 4. Palette + EN toggle ----------
    pg.goto(BASE + "/", wait_until="networkidle", timeout=30000)
    pg.wait_for_timeout(1200)
    c = []
    try:
        pg.keyboard.press("Control+k")
        pg.wait_for_timeout(1000)
        c.append(shot(pg, "ix-c-0-palette"))
        pal_input = pg.locator("input[placeholder*='Suchen'], input[placeholder*='Search'], [role='dialog'] input").first
        pal_input.fill("10132", timeout=5000)
        pg.wait_for_timeout(1000)
        c.append(shot(pg, "ix-c-1-search"))
        pal_input.press("Enter")
        pg.wait_for_timeout(1800)
        c.append(shot(pg, "ix-c-2-jump"))
    except Exception as e:
        print("[warn] palette:", e)
    try:
        pg.goto(BASE + "/", wait_until="networkidle", timeout=30000)
        pg.wait_for_timeout(1000)
        pg.get_by_role("button", name="EN").click(timeout=5000)
        pg.wait_for_timeout(1200)
        c.append(shot(pg, "ix-c-3-english"))
        (STILLS / "13-dashboard-en.png").write_bytes(
            (FRAMES / "ix-c-3-english.png").read_bytes())
    except Exception as e:
        print("[warn] EN toggle:", e)
    if c:
        to_gif(c, GIFS / "interact-palette.gif")

    b.close()

# ---------- 5. rebuild overview hero ----------
hero = [
    FRAMES / "01-dashboard_00.png",
    FRAMES / "02-tagesliste_00.png",
    FRAMES / "04-kunde-360_00.png",
    FRAMES / "ix-q-1-draft.png",
    FRAMES / "07-cockpit_00.png",
    FRAMES / "08-verlauf_00.png",
]
hero = [p for p in hero if p.exists()]
to_gif(hero, GIFS / "overview.gif", delay=1300)
print("[done]")
