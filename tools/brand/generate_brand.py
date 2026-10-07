"""Renders the Mirsal brand marks (Phase 13, DEC-064: concept 1, "the stamp").

The stamp: an ivory postage stamp with perforated edges, a heritage-green panel framed in ivory,
the letter م in Amiri Bold, and a small dove-wing stroke. Palette B colours (DEC-063).

Run from the repo root:  python tools/brand/generate_brand.py
Outputs (deterministic):
  mobile/assets/brand/stamp-mark.png   1170 x 1350, transparent with a soft shadow (in-app mark)
  mobile/assets/brand/stamp-mark.svg   vector master (same geometry; text needs Amiri installed)
Also writes the final launcher, adaptive, themed (monochrome), notification and splash images into
mobile/assets/images/ (after the owner's Phase 13 visual review, 2026-10-03; DEC-065).
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


CREAM = (246, 240, 227, 255)
IMAGES = os.path.join(ROOT, "mobile", "assets", "images")


def silhouette(size: int) -> Image.Image:
    """One-colour mark for Android's themed icon and the status-bar notification icon (Android uses
    only the alpha): the perforated stamp outline with the meem inside, white on transparent."""
    ss = 4
    k = size * ss / H  # fit the 140-unit height
    w, h = int(W * k), int(H * k)
    stamp = Image.new("L", (w, h), 0)
    d = ImageDraw.Draw(stamp)
    d.rectangle([EDGE * k, EDGE * k, (W - EDGE) * k, (H - EDGE) * k], fill=255)
    for x, y in perforation_centres():
        d.ellipse([(x - PERF_R) * k, (y - PERF_R) * k, (x + PERF_R) * k, (y + PERF_R) * k], fill=0)
    d.rectangle([18 * k, 18 * k, 102 * k, 122 * k], fill=0)
    font = ImageFont.truetype(FONT, int(60 * k))
    x0, y0, x1, y1 = d.textbbox((0, 0), "م", font=font)
    d.text((62 * k - (x0 + x1) / 2, 72 * k - (y0 + y1) / 2), "م", font=font, fill=255)
    out = Image.new("RGBA", (w, h), (255, 255, 255, 0))
    out.putalpha(stamp)
    return out.resize((max(1, w // ss), size), Image.LANCZOS)


def centred(canvas: Image.Image, mark: Image.Image, height_ratio: float) -> Image.Image:
    target_h = int(canvas.height * height_ratio)
    m = mark.resize((int(mark.width * target_h / mark.height), target_h), Image.LANCZOS)
    canvas.alpha_composite(m, ((canvas.width - m.width) // 2, (canvas.height - m.height) // 2))
    return canvas


def app_icons(mark: Image.Image) -> None:
    """Launcher, adaptive, themed, notification and splash images (Phase 13 final, DEC-065)."""
    # Legacy/full icon: the stamp on aged cream.
    centred(Image.new("RGBA", (1024, 1024), CREAM), mark, 0.74).save(os.path.join(IMAGES, "icon.png"), optimize=True)
    # Adaptive icon (108 dp canvas; launchers show the inner 72 dp, round ones as a circle): the
    # stamp's half-diagonal (0.66 x its height) must stay inside that circle, so height <= 0.47.
    centred(Image.new("RGBA", (512, 512), (0, 0, 0, 0)), mark, 0.46).save(os.path.join(IMAGES, "android-icon-foreground.png"), optimize=True)
    Image.new("RGBA", (512, 512), CREAM).save(os.path.join(IMAGES, "android-icon-background.png"), optimize=True)
    # Themed icon (Android 13+) and status-bar notification icon: one-colour silhouette.
    centred(Image.new("RGBA", (432, 432), (0, 0, 0, 0)), silhouette(256), 0.46).save(os.path.join(IMAGES, "android-icon-monochrome.png"), optimize=True)
    centred(Image.new("RGBA", (96, 96), (0, 0, 0, 0)), silhouette(192), 0.86).save(os.path.join(IMAGES, "notification-icon.png"), optimize=True)
    # Splash image (drawn at imageWidth dp by expo-splash-screen on a cream or night background).
    mark.save(os.path.join(IMAGES, "splash-icon.png"), optimize=True)


ICONS = os.path.join(ROOT, "mobile", "assets", "icons")


def tab_icons() -> None:
    """Bottom tab bar icons (Phase 13 identity; replaces the generic Ionicons): line drawings on a
    24-unit grid, white on transparent, rendered at 3x (72 px). The app tints them (active green,
    inactive sepia), so they follow both themes. Stroke 1.7 units, rounded ends."""
    import math

    k = 3 * 8  # 3x density, 8x supersampling
    sw = int(1.7 * k)

    def canvas():
        img = Image.new("L", (24 * k, 24 * k), 0)
        return img, ImageDraw.Draw(img)

    def P(x, y):
        return (x * k, y * k)

    def line(d, pts, width=sw):
        d.line([P(*p) for p in pts], fill=255, width=width, joint="curve")
        r = width / 2
        for x, y in (pts[0], pts[-1]):
            d.ellipse([x * k - r, y * k - r, x * k + r, y * k + r], fill=255)

    def rect(d, x0, y0, x1, y1, width=sw, radius=1.2):
        d.rounded_rectangle([x0 * k, y0 * k, x1 * k, y1 * k], radius=radius * k, outline=255, width=width)

    def save(img, name):
        out = Image.new("RGBA", (72, 72), (255, 255, 255, 0))
        out.putalpha(img.resize((72, 72), Image.LANCZOS))
        out.save(os.path.join(ICONS, f"{name}.png"), optimize=True)

    os.makedirs(ICONS, exist_ok=True)

    # Inbox: an opened envelope, its letter rising out of it.
    img, d = canvas()
    rect(d, 4.2, 4.0, 19.8, 14.0, radius=0.6)          # the letter
    line(d, [(7.2, 7.4), (16.8, 7.4)], width=int(1.3 * k))
    line(d, [(7.2, 10.2), (13.6, 10.2)], width=int(1.3 * k))
    d.rectangle([2.6 * k, 11.2 * k, 21.4 * k, 21.0 * k], fill=0)   # envelope front hides the letter
    rect(d, 2.6, 11.2, 21.4, 21.0)
    # The flap meets the corners: no round end caps there, or they read as blobs at tab size.
    d.line([P(3.0, 11.7), P(12, 17.2), P(21.0, 11.7)], fill=255, width=sw, joint="curve")
    save(img, "tab-inbox")

    # Drafts: a quill, feather vanes and a nib.
    img, d = canvas()
    line(d, [(4.0, 20.6), (19.6, 4.0)])                 # shaft
    vane = [(19.6, 4.0), (14.0, 4.6), (9.4, 9.0), (7.6, 14.2), (10.6, 13.6), (15.4, 11.4), (18.6, 7.6), (19.6, 4.0)]
    d.line([P(*p) for p in vane], fill=255, width=sw, joint="curve")
    for t in (0.35, 0.55, 0.75):                        # barbs
        x, y = 4.0 + (19.6 - 4.0) * t, 20.6 - (20.6 - 4.0) * t
        line(d, [(x, y), (x - 2.2 * (1 - t) - 0.6, y - 0.6)], width=int(1.1 * k))
    line(d, [(2.8, 21.6), (5.2, 19.2)], width=int(2.1 * k))  # nib
    save(img, "tab-drafts")

    # Sent: a sealed envelope carrying a perforated stamp in its top corner.
    img, d = canvas()
    rect(d, 2.0, 6.4, 22.0, 20.0, radius=1.0)
    d.line([P(2.4, 7.0), P(12, 14.2), P(21.6, 7.0)], fill=255, width=sw, joint="curve")
    x0, y0, x1, y1 = 13.0, 9.0, 19.2, 15.4  # inset so the cleared margin never cuts the envelope edge
    d.rectangle([(x0 - 0.9) * k, (y0 - 0.9) * k, (x1 + 0.9) * k, (y1 + 0.9) * k], fill=0)  # clear behind
    d.rectangle([x0 * k, y0 * k, x1 * k, y1 * k], fill=255)                              # stamp paper
    r = 0.55
    for i in range(5):  # perforations bitten out of all four edges
        t = i / 4
        for (px, py) in ((x0 + (x1 - x0) * t, y0), (x0 + (x1 - x0) * t, y1), (x0, y0 + (y1 - y0) * t), (x1, y0 + (y1 - y0) * t)):
            d.ellipse([(px - r) * k, (py - r) * k, (px + r) * k, (py + r) * k], fill=0)
    d.rectangle([(x0 + 1.3) * k, (y0 + 1.3) * k, (x1 - 1.3) * k, (y1 - 1.3) * k], fill=0)    # the stamp's picture window
    d.ellipse([(x0 + 2.3) * k, (y0 + 2.4) * k, (x1 - 2.3) * k, (y1 - 2.4) * k], fill=255)    # its motif
    save(img, "tab-sent")

    # Profile: a portrait in an oval cameo frame.
    img, d = canvas()
    d.ellipse([4.2 * k, 2.4 * k, 19.8 * k, 21.6 * k], outline=255, width=sw)
    d.ellipse([9.4 * k, 6.6 * k, 14.6 * k, 11.8 * k], outline=255, width=sw)
    d.arc([7.0 * k, 13.0 * k, 17.0 * k, 23.0 * k], start=200, end=340, fill=255, width=sw)
    save(img, "tab-profile")


def main() -> None:
    os.makedirs(OUT, exist_ok=True)
    mark = render_png(9)
    mark.save(os.path.join(OUT, "stamp-mark.png"), optimize=True)
    app_icons(mark)
    tab_icons()
    with open(os.path.join(OUT, "stamp-mark.svg"), "w", encoding="utf-8", newline="\n") as f:
        f.write(svg())


if __name__ == "__main__":
    main()
