"""Part 2: cockpit as Vertriebsleitung + quote-draft flow + focus view.

Seeds localStorage (pecal-kompass-v1) with userId=thomas for the cockpit.
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
GIF_WIDTH = 960


def scroll_frames(page, name: str, steps: int = 4):
    paths = []
    height = page.evaluate("() => document.documentElement.scrollHeight")
    max_top = max(0, height - VIEWPORT["height"])
    for i in range(steps):
        top = round(max_top * i / max(steps - 1, 1))
        page.evaluate(f"() => window.scrollTo(0, {top})")
        time.sleep(0.7)
        p = FRAMES / f"{name}_{i:02d}.png"
        page.screenshot(path=str(p))
        paths.append(p)
    page.evaluate("() => window.scrollTo(0, 0)")
    return paths


def to_gif(frame_paths, out_path, delay=900):
    imgs = []
    for p in frame_paths:
        im = Image.open(p).convert("RGB")
        if im.width > GIF_WIDTH:
            h = round(im.height * GIF_WIDTH / im.width)
            im = im.resize((GIF_WIDTH, h), Image.LANCZOS)
        imgs.append(im)
    pal = [im.convert("P", palette=Image.ADAPTIVE, colors=256) for im in imgs]
    pal[0].save(str(out_path), save_all=True, append_images=pal[1:],
                duration=delay, loop=0, optimize=True)


with sync_playwright() as pw:
    browser = pw.chromium.launch()

    # --- cockpit as Thomas Brandt (Vertriebsleitung) ---
    ctx = browser.new_context(viewport=VIEWPORT)
    ctx.add_init_script("() => localStorage.setItem('pecal-kompass-v1', JSON.stringify({userId:'thomas'}))")
    page = ctx.new_page()
    page.goto(BASE + "/cockpit", wait_until="networkidle", timeout=30000)
    time.sleep(2.0)
    page.screenshot(path=str(STILLS / "07-cockpit.png"), full_page=True)
    to_gif(scroll_frames(page, "07-cockpit"), GIFS / "07-cockpit.gif")
    print("[ok] cockpit as Leitung, KB:", (GIFS / "07-cockpit.gif").stat().st_size // 1024)
    ctx.close()

    # --- quote draft flow: kunde-360 -> Angebot vorbereiten ---
    ctx2 = browser.new_context(viewport=VIEWPORT)
    page2 = ctx2.new_page()
    page2.goto(BASE + "/kunden/10132", wait_until="networkidle", timeout=30000)
    time.sleep(1.5)
    btn = page2.get_by_role("button", name="Angebot vorbereiten")
    btn.click()
    page2.wait_for_url("**/angebote/**", timeout=15000)
    time.sleep(2.0)
    print("[ok] draft url:", page2.url)
    page2.screenshot(path=str(STILLS / "06b-angebot-entwurf.png"), full_page=True)
    to_gif(scroll_frames(page2, "06b-angebot-entwurf"), GIFS / "06b-angebot-entwurf.gif")
    print("[ok] angebot-entwurf, KB:", (GIFS / "06b-angebot-entwurf.gif").stat().st_size // 1024)

    # --- tagesliste focus view: click first row ---
    page2.goto(BASE + "/tagesliste", wait_until="networkidle", timeout=30000)
    time.sleep(1.5)
    rows = page2.locator("li, [role='row'], article").first
    # fall back: click first row containing '€'
    first = page2.locator("text=≈").first
    try:
        first.click(timeout=5000)
        time.sleep(1.2)
    except Exception as e:
        print("[warn] focus click failed:", e)
    page2.screenshot(path=str(STILLS / "02b-tagesliste-fokus.png"), full_page=True)
    print("[ok] fokus still")
    ctx2.close()
    browser.close()
print("[done] part2")
