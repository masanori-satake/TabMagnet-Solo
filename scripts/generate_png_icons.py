import os
import sys
import re

def generate_icons(output_dir=None, bg_color=None):
    script_dir = os.path.dirname(os.path.abspath(__file__))
    root_dir = os.path.dirname(script_dir)
    svg_path = os.path.join(root_dir, "projects/app/assets/icon.svg")
    output_dir = os.path.abspath(output_dir) if output_dir else os.path.join(root_dir, "projects/app/icons")

    if not os.path.exists(svg_path):
        print(f"Error: {svg_path} not found.")
        return False

    with open(svg_path, "r", encoding="utf-8") as f:
        svg_content = f.read()

    if bg_color:
        svg_content = re.sub(r'fill=["\'][^"\']+["\']', f'fill="{bg_color}"', svg_content, count=1)

    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        print("Error: playwright not found.")
        return False

    if not os.path.exists(output_dir): os.makedirs(output_dir)

    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page(viewport={"width": 512, "height": 512})
        page.set_content(f"<!DOCTYPE html><html><body style='margin:0;overflow:hidden;'>{svg_content}</body></html>")

        for size in [16, 32, 48, 128]:
            out = os.path.join(output_dir, f"icon{size}.png")
            page.set_viewport_size({"width": size, "height": size})
            page.wait_for_timeout(100)
            page.screenshot(path=out, omit_background=True)
            print(f"Generated {out}")
        browser.close()
    return True

if __name__ == "__main__":
    if not generate_icons(sys.argv[1] if len(sys.argv) > 1 else None, sys.argv[2] if len(sys.argv) > 2 else None):
        sys.exit(1)
