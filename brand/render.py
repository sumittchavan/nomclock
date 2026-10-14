"""Render the NomClock icon set from the SVGs in this folder.

Usage: python3 brand/render.py   (needs `pip install playwright` and `playwright install chromium`)
Writes app icons, Android adaptive layers, splash and favicons into apps/mobile/assets and apps/web.
"""
import os
import sys
from pathlib import Path

from playwright.sync_api import sync_playwright

BRAND = Path(__file__).resolve().parent
ROOT = BRAND.parent
MOBILE = ROOT / "apps/mobile/assets"
WEB = ROOT / "apps/web"
SAFFRON = "#E3A51A"


def svg(name: str) -> str:
    return (BRAND / name).read_text()


def page(inner: str, size: int, bg: str | None, scale: float) -> str:
    """A square canvas `size` px, optional background, artwork at `scale` of the width, centred."""
    art = int(size * scale)
    return f"""<!doctype html><html><body style="margin:0">
<div style="width:{size}px;height:{size}px;display:flex;align-items:center;justify-content:center;background:{bg or 'transparent'}">
<div style="width:{art}px;height:{art}px">{inner.replace('<svg ', '<svg width="100%" height="100%" ', 1)}</div>
</div></body></html>"""


JOBS = [
    # (output path, svg, canvas px, background, artwork scale)
    (MOBILE / "icon.png", "icon-mark.svg", 1024, SAFFRON, 0.66),                 # iOS (Apple rounds the corners)
    (MOBILE / "android-icon-foreground.png", "icon-mark.svg", 1024, None, 0.58),  # inside the 66% safe zone
    (MOBILE / "android-icon-background.png", None, 1024, SAFFRON, 0),
    (MOBILE / "android-icon-monochrome.png", "icon-mono.svg", 1024, None, 0.58),  # themed icons (Android 13+)
    (MOBILE / "splash-icon.png", "mark.svg", 1024, None, 0.9),
    (MOBILE / "splash-icon-dark.png", "mark-dark.svg", 1024, None, 0.9),             # saffron rim reads on the dark splash
    (MOBILE / "favicon.png", "favicon.svg", 48, None, 1.0),
    (WEB / "app/apple-icon.png", "icon-mark.svg", 180, SAFFRON, 0.66),
    (WEB / "public/icon-512.png", "icon-mark.svg", 512, SAFFRON, 0.66),
    (WEB / "public/icon-192.png", "icon-mark.svg", 192, SAFFRON, 0.66),
]


def main() -> None:
    exe = os.environ.get("CHROMIUM_PATH")
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path=exe) if exe else p.chromium.launch()
        for out, name, size, bg, scale in JOBS:
            out.parent.mkdir(parents=True, exist_ok=True)
            ctx = browser.new_context(viewport={"width": size, "height": size}, device_scale_factor=1)
            pg = ctx.new_page()
            pg.set_content(page(svg(name) if name else "", size, bg, scale))
            pg.screenshot(path=str(out), omit_background=bg is None, clip={"x": 0, "y": 0, "width": size, "height": size})
            ctx.close()
            print("wrote", out.relative_to(ROOT))
        browser.close()
    # The web favicon is the SVG itself (sharp at every size, supports the browser's own scaling).
    (WEB / "app/icon.svg").write_text(svg("favicon.svg"))
    print("wrote apps/web/app/icon.svg")


if __name__ == "__main__":
    sys.exit(main())
