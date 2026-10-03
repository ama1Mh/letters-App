"""Renders the Mirsal brand marks (Phase 13, DEC-064: concept 1, "the stamp").

The stamp: an ivory postage stamp with perforated edges, a heritage-green panel framed in ivory,
the letter م in Amiri Bold, and a small dove-wing stroke. Palette B colours (DEC-063).

Run from the repo root:  python tools/brand/generate_brand.py
Outputs (deterministic):
  mobile/assets/brand/stamp-mark.png   1170 x 1350, transparent with a soft shadow (in-app mark)
  mobile/assets/brand/stamp-mark.svg   vector master (same geometry; text needs Amiri installed)
The final launcher icon, notification icon and splash are produced from this mark only after the
Phase 13 visual QA (owner's sequencing, 2026-10-03).
"""

from __future__ import annotations

import os

from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageFont

ROOT = os.path.join(os.path.dirname(__file__), "..", "..")
OUT = os.path.join(ROOT, "mobile", "assets", "brand")
FONT = os.path.join(ROOT, "mobile", "node_modules", "@expo-google-fonts", "amiri", "700Bold", "Amiri_700Bold.ttf")

IVORY = (253, 249, 240, 255)
GREEN = (47, 91, 72, 255)
WING = (233, 217, 180, 255)

# Geometry in the 120 x 140 design units of the SVG master.
W, H = 120, 140
PERF_R, PERF_STEP, EDGE = 5, 14, 6
# Transparent margin around the PNG for the drop shadow (design units).
PAD = 5


def perforation_centres():
    xs = list(range(EDGE, W - EDGE + 1, PERF_STEP)) + [W - EDGE]
    ys = list(range(EDGE, H - EDGE + 1, PERF_STEP)) + [H - EDGE]
    pts = set()
    for x in xs:
        pts.add((x, EDGE))
        pts.add((x, H - EDGE))
    for y in ys:
        pts.add((EDGE, y))
        pts.add((W - EDGE, y))
    return sorted(pts)


def render_png(scale: int) -> Image.Image:
    ss = 4
    k = scale * ss
    img = Image.new("RGBA", (W * k, H * k), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.rectangle([EDGE * k, EDGE * k, (W - EDGE) * k, (H - EDGE) * k], fill=IVORY)
    holes = Image.new("L", img.size, 255)
    hd = ImageDraw.Draw(holes)
    for x, y in perforation_centres():
        hd.ellipse([(x - PERF_R) * k, (y - PERF_R) * k, (x + PERF_R) * k, (y + PERF_R) * k], fill=0)
    img.putalpha(ImageChops.multiply(img.getchannel("A"), holes))
    d = ImageDraw.Draw(img)
    d.rectangle([18 * k, 18 * k, 102 * k, 122 * k], fill=GREEN)
    d.rectangle([23 * k, 23 * k, 97 * k, 117 * k], outline=IVORY, width=int(1.5 * k))
    # Centre the glyph's real ink box inside the inner frame (Amiri's meem has a long tail, so the
    # font's ascent/descent box would sit it too low).
    font = ImageFont.truetype(FONT, 56 * k)
    x0, y0, x1, y1 = d.textbbox((0, 0), "م", font=font)
    cx, cy = 62 * k, 76 * k
    d.text((cx - (x0 + x1) / 2, cy - (y0 + y1) / 2), "م", font=font, fill=IVORY)
    # Dove-wing stroke: a quadratic curve drawn as a polyline.
    pts = []
    for i in range(41):
        t = i / 40
        x = (1 - t) ** 2 * 34 + 2 * (1 - t) * t * 48 + t * t * 64
        y = (1 - t) ** 2 * 46 + 2 * (1 - t) * t * 36 + t * t * 42
        pts.append((x * k, y * k))
    for i in range(21):
        t = i / 20
        x = (1 - t) ** 2 * 64 + 2 * (1 - t) * t * 52 + t * t * 46
        y = (1 - t) ** 2 * 42 + 2 * (1 - t) * t * 44 + t * t * 52
        pts.append((x * k, y * k))
    d.line(pts, fill=WING, width=int(2.5 * k), joint="curve")
    # A soft ink shadow under the stamp so the ivory perforations read on cream (Phase 13 visual QA);
    # on the dark theme it disappears into the ground. The canvas gains PAD units on every side.
    pad = PAD * k
    out = Image.new("RGBA", (img.width + 2 * pad, img.height + 2 * pad), (0, 0, 0, 0))
    alpha = img.getchannel("A").point(lambda v: int(v * 0.30))
    shadow = Image.new("RGBA", img.size, (43, 35, 28, 0))
    shadow.putalpha(alpha)
    shadow_layer = Image.new("RGBA", out.size, (0, 0, 0, 0))
    shadow_layer.alpha_composite(shadow, (pad + int(0.6 * k), pad + int(1.2 * k)))
    shadow_layer = shadow_layer.filter(ImageFilter.GaussianBlur(1.6 * k))
    out.alpha_composite(shadow_layer)
    out.alpha_composite(img, (pad, pad))
    return out.resize(((W + 2 * PAD) * scale, (H + 2 * PAD) * scale), Image.LANCZOS)


def svg() -> str:
    circles = "".join(f'<circle cx="{x}" cy="{y}" r="{PERF_R}"/>' for x, y in perforation_centres())
    return f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W * 4}" height="{H * 4}">
  <title>Mirsal stamp mark</title>
  <defs><mask id="perf"><rect width="{W}" height="{H}" fill="#fff"/><g fill="#000">{circles}</g></mask></defs>
  <rect x="{EDGE}" y="{EDGE}" width="{W - 2 * EDGE}" height="{H - 2 * EDGE}" fill="#FDF9F0" mask="url(#perf)"/>
  <rect x="18" y="18" width="84" height="104" fill="#2F5B48"/>
  <rect x="23" y="23" width="74" height="94" fill="none" stroke="#FDF9F0" stroke-width="1.5"/>
  <text x="60" y="74" text-anchor="middle" dominant-baseline="central" font-family="Amiri" font-weight="700" font-size="64" fill="#FDF9F0">م</text>
  <path d="M34 46 Q48 36 64 42 Q52 44 46 52" fill="none" stroke="#E9D9B4" stroke-width="2.5" stroke-linecap="round"/>
</svg>
"""


def main() -> None:
    os.makedirs(OUT, exist_ok=True)
    render_png(9).save(os.path.join(OUT, "stamp-mark.png"), optimize=True)
    with open(os.path.join(OUT, "stamp-mark.svg"), "w", encoding="utf-8", newline="\n") as f:
        f.write(svg())


if __name__ == "__main__":
    main()
