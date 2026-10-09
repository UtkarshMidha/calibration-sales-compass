"""Capture demo walkthrough screenshots + GIFs for Calibration Sales Compass.

Runs against local prod server (http://localhost:3000).
Outputs:
  demo/stills/<name>.png   - full-page still per route
  demo/frames/<name>_*.png - viewport frames (scroll steps)
  demo/gifs/<name>.gif     - per-functionality GIF
  demo/gifs/overview.gif   - one GIF cycling all pages
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
for d in (FRAMES, STILLS, GIFS):
    d.mkdir(parents=True, exist_ok=True)

ROUTES = [
    ("01-dashboard", "/"),
    ("02-tagesliste", "/tagesliste"),
    ("03-kunden", "/kunden"),
    ("04-kunde-360", "/kunden/10132"),
    ("05-messmittel", "/messmittel"),
    ("06-angebote", "/angebote"),
    ("07-cockpit", "/cockpit"),
    ("08-verlauf", "/verlauf"),
    ("09-modellguete", "/modellguete"),
    ("10-einstellungen", "/einstellungen"),
]

VIEWPORT = {"width": 1280, "height": 800}
GIF_WIDTH = 960
FRAME_DELAY_MS = 900


def scroll_frames(page, name: str, steps: int = 4):
    """Scroll page step by step, screenshot viewport at each step."""
    paths = []
    height = page.evaluate("() => document.documentElement.scrollHeight")
    vh = VIEWPORT["height"]
    max_top = max(0, height - vh)
    positions = [round(max_top * i / max(steps - 1, 1)) for i in range(steps)]
    # always include top first
    for i, top in enumerate(positions):
        page.evaluate(f"() => window.scrollTo(0, {top})")
        time.sleep(0.7)  # let charts/animations settle
        p = FRAMES / f"{name}_{i:02d}.png"
        page.screenshot(path=str(p))
        paths.append(p)
    page.evaluate("() => window.scrollTo(0, 0)")
    return paths


def frames_to_gif(frame_paths, out_path, width=GIF_WIDTH, delay=FRAME_DELAY_MS):
    imgs = []
    for p in frame_paths:
        im = Image.open(p).convert("RGB")
        if im.width > width:
            h = round(im.height * width / im.width)
            im = im.resize((width, h), Image.LANCZOS)
        imgs.append(im)
    if not imgs:
        return None
    # palette-convert for small GIFs
    pal = [im.convert("P", palette=Image.ADAPTIVE, colors=256) for im in imgs]
    pal[0].save(
        str(out_path), save_all=True, append_images=pal[1:],
        duration=delay, loop=0, optimize=True,
    )
    return out_path


def main():
    overview_first_frames = []
    with sync_playwright() as pw:
        browser = pw.chromium.launch()
        page = browser.new_page(viewport=VIEWPORT, device_scale_factor=1)
        for name, route in ROUTES:
            url = BASE + route
            print(f"[capture] {name} <- {url}")
            try:
                page.goto(url, wait_until="networkidle", timeout=30000)
            except Exception as e:
                print(f"  !! goto failed: {e}")
                page.goto(url, wait_until="domcontentloaded", timeout=30000)
            time.sleep(2.0)  # charts + animations
            # full-page still
            still = STILLS / f"{name}.png"
            page.screenshot(path=str(still), full_page=True)
            # scroll-step frames for GIF
            frames = scroll_frames(page, name, steps=4)
            gif = GIFS / f"{name}.gif"
            frames_to_gif(frames, gif)
            size_kb = gif.stat().st_size // 1024 if gif.exists() else 0
            print(f"  -> {gif.name} ({size_kb} KB, {len(frames)} frames)")
            if frames:
                overview_first_frames.append(frames[0])
        browser.close()

    # overview GIF: first frame of every page
    if overview_first_frames:
        out = GIFS / "overview.gif"
        frames_to_gif(overview_first_frames, out, delay=1200)
        print(f"[done] overview.gif ({out.stat().st_size // 1024} KB)")
    print(f"[done] stills: {STILLS}, gifs: {GIFS}")


if __name__ == "__main__":
    main()
