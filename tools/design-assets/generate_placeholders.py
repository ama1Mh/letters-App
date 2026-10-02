"""Generates the PROVISIONAL Phase 12 letter-design artwork (DEC-061 (2), release gate OPEN-14).

Everything here is procedural placeholder art drawn by this script (no third-party images), so it
is free to use during development, but it is not the final production asset library. Re-run from
the repo root after editing:

    python tools/design-assets/generate_placeholders.py

Output: mobile/assets/designs/{papers,stamps,stickers,postmarks}/*.webp (lossy WebP with alpha). Deterministic (fixed seed).
Requires Pillow and numpy.
"""

from __future__ import annotations

import math
import os

import numpy as np
from PIL import Image, ImageChops, ImageDraw, ImageFilter

ROOT = os.path.join(os.path.dirname(__file__), "..", "..", "mobile", "assets", "designs")
SS = 2  # supersampling factor for smooth edges

# Element canvases are drawn at this pixel width; the app shows them at up to ~3x of a 72 dp base.
ELEMENT_PX = 512


def out(kind: str, key: str, img: Image.Image, suffix: str = "") -> None:
    d = os.path.join(ROOT, kind)
    os.makedirs(d, exist_ok=True)
    img.save(os.path.join(d, f"{key}{suffix}.webp"), "WEBP", quality=88, method=6)


def rng(seed: int) -> np.random.Generator:
    return np.random.default_rng(seed)


def tileable_noise(size: int, scale: int, seed: int) -> np.ndarray:
    """Smooth value noise in 0..1 that wraps at the edges (tiles seamlessly)."""
    r = rng(seed)
    grid = r.random((scale, scale))
    # Bicubic upsampling of a periodic grid: pad by wrapping, resize, crop the centre.
    pad = np.pad(grid, 2, mode="wrap")
    img = Image.fromarray((pad * 255).astype(np.uint8)).resize(
        ((scale + 4) * size // scale,) * 2, Image.BICUBIC
    )
    off = 2 * size // scale
    arr = np.asarray(img, dtype=np.float32)[off : off + size, off : off + size] / 255.0
    return arr


# --------------------------------------------------------------------------------------------
# Papers: a tileable texture overlay (alpha) drawn over the paper's base colour in the app, plus
# one shared edge-ageing overlay stretched over the whole sheet.
# --------------------------------------------------------------------------------------------

PAPERS = {
    # key: (seed, mottling strength, fibre count, stain tint RGB)
    "aged_cream": (11, 0.22, 900, (120, 84, 40)),
    "warm_ivory": (23, 0.10, 600, (130, 100, 60)),
    "parchment": (37, 0.32, 400, (110, 72, 30)),
}


def paper_texture(seed: int, mottle: float, fibres: int, tint: tuple[int, int, int]) -> Image.Image:
    size = 512
    n = (
        0.55 * tileable_noise(size, 4, seed)
        + 0.30 * tileable_noise(size, 16, seed + 1)
        + 0.15 * tileable_noise(size, 64, seed + 2)
    )
    n = (n - n.min()) / (n.max() - n.min())
    grain = rng(seed + 3).random((size, size)).astype(np.float32)
    alpha = np.clip((n - 0.35) * mottle * 255 * 1.6 + (grain - 0.5) * 18, 0, 255)
    rgba = np.zeros((size, size, 4), dtype=np.uint8)
    rgba[..., 0], rgba[..., 1], rgba[..., 2] = tint
    rgba[..., 3] = alpha.astype(np.uint8)
    img = Image.fromarray(rgba, "RGBA")
    # Fibres: short faint strokes, wrapped so the tile stays seamless.
    r = rng(seed + 4)
    layer = Image.new("RGBA", (size * 3, size * 3), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    for _ in range(fibres):
        x, y = r.random() * size + size, r.random() * size + size
        ang, ln = r.random() * math.pi, 6 + r.random() * 22
        c = (90, 70, 45, int(18 + r.random() * 28)) if r.random() < 0.7 else (255, 255, 245, 40)
        d.line([(x, y), (x + math.cos(ang) * ln, y + math.sin(ang) * ln)], fill=c, width=1)
    tiles = [layer.crop((ox, oy, ox + size, oy + size)) for ox in (0, size, 2 * size) for oy in (0, size, 2 * size)]
    fib = tiles[0]
    for t in tiles[1:]:
        fib = Image.alpha_composite(fib, t)
    return Image.alpha_composite(img, fib)


def edge_ageing() -> Image.Image:
    """Soft, uneven browning towards the sheet edges; stretched over the whole letter."""
    w, h = 360, 509
    y, x = np.mgrid[0:h, 0:w].astype(np.float32)
    dx = np.minimum(x, w - 1 - x) / w
    dy = np.minimum(y, h - 1 - y) / h
    edge = np.clip(1 - np.minimum(dx * 9, dy * 12), 0, 1) ** 2.6
    noise = np.asarray(
        Image.fromarray((rng(5).random((h // 24, w // 24)) * 255).astype(np.uint8)).resize((w, h), Image.BICUBIC),
        dtype=np.float32,
    ) / 255
    a = np.clip(edge * (0.6 + 0.5 * noise) * 105, 0, 255)
    rgba = np.zeros((h, w, 4), dtype=np.uint8)
    rgba[..., 0], rgba[..., 1], rgba[..., 2] = (120, 84, 42)
    rgba[..., 3] = a.astype(np.uint8)
    return Image.fromarray(rgba, "RGBA").filter(ImageFilter.GaussianBlur(5))


# --------------------------------------------------------------------------------------------
# Elements
# --------------------------------------------------------------------------------------------


def faded(img: Image.Image, seed: int, strength: float) -> Image.Image:
    """Uneven ink: multiplies alpha by blotchy noise, like a worn rubber stamp."""
    w, h = img.size
    n = np.asarray(
        Image.fromarray((rng(seed).random((h // 6, w // 6)) * 255).astype(np.uint8)).resize((w, h), Image.BICUBIC),
        dtype=np.float32,
    ) / 255
    speck = rng(seed + 1).random((h, w)).astype(np.float32)
    mult = np.clip(1 - strength * (n**1.5) - (speck > 0.93) * 0.6, 0.15, 1)
    arr = np.asarray(img).copy()
    arr[..., 3] = (arr[..., 3] * mult).astype(np.uint8)
    return Image.fromarray(arr, "RGBA")


def finish(big: Image.Image) -> Image.Image:
    return big.resize((big.width // SS, big.height // SS), Image.LANCZOS)


def stamp(key: str, frame: tuple[int, int, int], bg: tuple[int, int, int], motif, value: str) -> None:
    W, H = ELEMENT_PX * SS, int(ELEMENT_PX * 1.2) * SS
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    m = 18 * SS
    d.rectangle([m, m, W - m, H - m], fill=(250, 244, 230, 255))
    # Perforations: bite circles out of the paper edge.
    holes = Image.new("L", (W, H), 255)
    hd = ImageDraw.Draw(holes)
    rr, step = 13 * SS, 40 * SS
    for x in range(m, W - m + 1, step):
        for y in (m, H - m):
            hd.ellipse([x - rr, y - rr, x + rr, y + rr], fill=0)
    for y in range(m, H - m + 1, step):
        for x in (m, W - m):
            hd.ellipse([x - rr, y - rr, x + rr, y + rr], fill=0)
    img.putalpha(ImageChops.multiply(img.getchannel("A"), holes))
    d = ImageDraw.Draw(img)
    inner = [m + 34 * SS, m + 34 * SS, W - m - 34 * SS, H - m - 34 * SS]
    d.rectangle(inner, fill=bg + (255,), outline=frame + (255,), width=10 * SS)
    d.rectangle([inner[0] + 18 * SS, inner[1] + 18 * SS, inner[2] - 18 * SS, inner[3] - 18 * SS], outline=frame + (255,), width=3 * SS)
    motif(d, inner, frame)
    # Denomination: digits only, no country or postal-authority name.
    tx, ty = inner[0] + 34 * SS, inner[1] + 30 * SS
    draw_digits(d, value, tx, ty, 26 * SS, frame)
    out("stamps", key, faded(finish(img), sum(map(ord, key)), 0.25))


def draw_digits(d: ImageDraw.ImageDraw, text: str, x: float, y: float, h: float, col) -> None:
    """Tiny seven-segment-free digit drawing via the default font scaled up."""
    from PIL import ImageFont

    try:
        f = ImageFont.truetype("georgiab.ttf", int(h * 1.6))
    except OSError:
        f = ImageFont.load_default(size=int(h * 1.6))
    d.text((x, y), text, font=f, fill=col + (255,))


def dove(d, box, col):
    x0, y0, x1, y1 = box
    cx, cy, s = (x0 + x1) / 2, (y0 + y1) / 2 + 20 * SS, (x1 - x0) / 2
    body = [(cx - 0.55 * s, cy + 0.05 * s), (cx + 0.2 * s, cy - 0.15 * s), (cx + 0.45 * s, cy - 0.35 * s),
            (cx + 0.62 * s, cy - 0.33 * s), (cx + 0.5 * s, cy - 0.12 * s), (cx + 0.1 * s, cy + 0.2 * s),
            (cx - 0.3 * s, cy + 0.22 * s), (cx - 0.75 * s, cy + 0.32 * s)]
    d.polygon(body, fill=(250, 246, 236, 255), outline=col + (255,), width=5 * SS)
    wing = [(cx - 0.15 * s, cy - 0.02 * s), (cx - 0.35 * s, cy - 0.7 * s), (cx + 0.05 * s, cy - 0.45 * s),
            (cx + 0.15 * s, cy - 0.1 * s)]
    d.polygon(wing, fill=(250, 246, 236, 255), outline=col + (255,), width=5 * SS)
    d.ellipse([cx + 0.47 * s, cy - 0.33 * s, cx + 0.52 * s, cy - 0.28 * s], fill=col + (255,))
    d.line([(cx + 0.62 * s, cy - 0.33 * s), (cx + 0.75 * s, cy - 0.3 * s)], fill=(200, 140, 50, 255), width=6 * SS)
    # Olive sprig
    d.line([(cx + 0.7 * s, cy - 0.3 * s), (cx + 0.85 * s, cy - 0.05 * s)], fill=(70, 100, 50, 255), width=4 * SS)
    for t in (0.3, 0.6, 0.9):
        px, py = cx + (0.7 + 0.15 * t) * s, cy + (-0.3 + 0.25 * t) * s
        d.ellipse([px - 10 * SS, py - 5 * SS, px + 10 * SS, py + 5 * SS], fill=(90, 120, 60, 255))


def palm(d, box, col):
    x0, y0, x1, y1 = box
    cx, base, s = (x0 + x1) / 2, y1 - 40 * SS, (x1 - x0) / 2
    d.rectangle([x0 + 10 * SS, base - 10 * SS, x1 - 10 * SS, base + 10 * SS], fill=(214, 180, 120, 255))
    top = (cx + 0.1 * s, y0 + 0.55 * s)
    pts = [(cx - 0.05 * s + 0.15 * s * (t**2), base - (base - top[1]) * t) for t in np.linspace(0, 1, 12)]
    d.line(pts, fill=(120, 80, 40, 255), width=16 * SS, joint="curve")
    for i, ang in enumerate(np.linspace(-170, -10, 7)):
        a = math.radians(ang)
        ln = s * (0.62 if i % 2 else 0.52)
        ex, ey = top[0] + math.cos(a) * ln, top[1] + math.sin(a) * ln * 0.75 + 0.18 * s
        mx, my = (top[0] + ex) / 2, min(top[1], ey) - 0.12 * s
        d.line([top, (mx, my), (ex, ey)], fill=(50, 105, 60, 255), width=12 * SS, joint="curve")
    for dx in (-14, 4, 20):
        d.ellipse([top[0] + dx * SS - 10 * SS, top[1] + 8 * SS, top[0] + dx * SS + 10 * SS, top[1] + 28 * SS], fill=(150, 70, 30, 255))
    d.ellipse([x1 - 0.55 * s, y0 + 0.25 * s, x1 - 0.3 * s, y0 + 0.5 * s], fill=(235, 170, 70, 255))


def lighthouse(d, box, col):
    x0, y0, x1, y1 = box
    cx, s = (x0 + x1) / 2, (x1 - x0) / 2
    base, top = y1 - 40 * SS, y0 + 0.75 * s
    d.polygon([(x0 + 8 * SS, base + 30 * SS), (x0 + 8 * SS, base), (cx - 0.5 * s, base - 0.15 * s), (cx + 0.6 * s, base - 0.05 * s),
               (x1 - 8 * SS, base + 30 * SS)], fill=(120, 110, 100, 255))
    tower = [(cx - 0.28 * s, base), (cx - 0.16 * s, top), (cx + 0.16 * s, top), (cx + 0.28 * s, base)]
    d.polygon(tower, fill=(245, 240, 230, 255), outline=col + (255,), width=5 * SS)
    for k in range(3):
        ya = base - (base - top) * (0.15 + 0.3 * k)
        yb = ya - (base - top) * 0.13
        wa, wb = 0.28 - 0.12 * (0.15 + 0.3 * k), 0.28 - 0.12 * (0.28 + 0.3 * k)
        d.polygon([(cx - wa * s, ya), (cx - wb * s, yb), (cx + wb * s, yb), (cx + wa * s, ya)], fill=col + (255,))
    d.rectangle([cx - 0.12 * s, top - 0.2 * s, cx + 0.12 * s, top], fill=(250, 220, 120, 255), outline=col + (255,), width=4 * SS)
    d.polygon([(cx - 0.17 * s, top - 0.2 * s), (cx, top - 0.38 * s), (cx + 0.17 * s, top - 0.2 * s)], fill=col + (255,))
    for sgn in (-1, 1):
        d.polygon([(cx, top - 0.1 * s), (cx + sgn * 0.9 * s, top - 0.3 * s), (cx + sgn * 0.9 * s, top + 0.05 * s)], fill=(250, 220, 120, 110))


def sticker_base(shape_fn, key: str, size=(ELEMENT_PX, ELEMENT_PX)) -> None:
    W, H = size[0] * SS, size[1] * SS
    art = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    shape_fn(ImageDraw.Draw(art), W, H)
    # White die-cut border + soft shadow, like a real sticker.
    a = art.getchannel("A").point(lambda v: 255 if v > 10 else 0)
    border = a
    for _ in range(2 * SS):
        border = border.filter(ImageFilter.MaxFilter(9))
    shadow = border.filter(ImageFilter.GaussianBlur(8 * SS)).point(lambda v: int(v * 0.35))
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    sh = Image.new("RGBA", (W, H), (60, 40, 20, 0))
    sh.putalpha(ImageChops.offset(shadow, 3 * SS, 5 * SS))
    img = Image.alpha_composite(img, sh)
    white = Image.new("RGBA", (W, H), (255, 253, 247, 0))
    white.putalpha(border)
    img = Image.alpha_composite(img, white)
    img = Image.alpha_composite(img, art)
    out("stickers", key, finish(img))


def flower(d, W, H):
    cx, cy, R = W / 2, H / 2, W * 0.3
    for i in range(6):
        a = math.radians(i * 60)
        px, py = cx + math.cos(a) * R * 0.6, cy + math.sin(a) * R * 0.6
        d.ellipse([px - R * 0.5, py - R * 0.5, px + R * 0.5, py + R * 0.5], fill=(206, 120, 130, 255), outline=(150, 70, 80, 255), width=4 * SS)
    d.ellipse([cx - R * 0.35, cy - R * 0.35, cx + R * 0.35, cy + R * 0.35], fill=(230, 180, 70, 255), outline=(170, 120, 40, 255), width=4 * SS)
    for i in range(10):
        a = math.radians(i * 36 + 10)
        px, py = cx + math.cos(a) * R * 0.18, cy + math.sin(a) * R * 0.18
        d.ellipse([px - 6 * SS, py - 6 * SS, px + 6 * SS, py + 6 * SS], fill=(150, 100, 30, 255))


def moon(d, W, H):
    cx, cy, R = W * 0.47, H / 2, W * 0.3
    d.ellipse([cx - R, cy - R, cx + R, cy + R], fill=(236, 200, 110, 255))
    off = R * 0.55
    d.ellipse([cx - R + off, cy - R - off * 0.25, cx + R + off, cy + R - off * 0.25], fill=(0, 0, 0, 0))
    for sx, sy, sr in ((0.78, 0.3, 0.06), (0.72, 0.62, 0.04), (0.86, 0.48, 0.03)):
        x, y, r = W * sx, H * sy, W * sr
        pts = [(x + math.cos(math.radians(k * 36 - 90)) * (r if k % 2 == 0 else r * 0.42),
                y + math.sin(math.radians(k * 36 - 90)) * (r if k % 2 == 0 else r * 0.42)) for k in range(10)]
        d.polygon(pts, fill=(236, 200, 110, 255))


def washi(d, W, H):
    h = H * 0.26
    top, bot = H / 2 - h / 2, H / 2 + h / 2
    r = rng(7)

    def torn(x, sgn):
        return [(x + sgn * r.random() * 10 * SS, top + (bot - top) * t) for t in np.linspace(0, 1, 14)]

    left, right = torn(W * 0.06, 1), torn(W * 0.94, -1)
    d.polygon(left + right[::-1], fill=(150, 175, 160, 215))
    for x in np.arange(W * 0.06, W * 0.94, 34 * SS):
        d.ellipse([x + 6 * SS, H / 2 - 8 * SS, x + 22 * SS, H / 2 + 8 * SS], fill=(250, 245, 230, 200))


def postmark_round() -> None:
    W = ELEMENT_PX * SS
    img = Image.new("RGBA", (W, W), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    ink = (40, 45, 70, 235)
    c, R = W / 2, W * 0.46
    d.ellipse([c - R, c - R, c + R, c + R], outline=ink, width=12 * SS)
    R2 = R * 0.8
    d.ellipse([c - R2, c - R2, c + R2, c + R2], outline=ink, width=5 * SS)
    # Band where the app writes the letter's date (no text in the image).
    band = W * 0.11
    d.line([(c - R2 * 0.98, c - band), (c + R2 * 0.98, c - band)], fill=ink, width=4 * SS)
    d.line([(c - R2 * 0.98, c + band), (c + R2 * 0.98, c + band)], fill=ink, width=4 * SS)
    for ang in (90, 270):
        x, y = c + math.cos(math.radians(ang)) * R * 0.6, c + math.sin(math.radians(ang)) * R * 0.6
        pts = [(x + math.cos(math.radians(k * 36 - 90)) * (18 * SS if k % 2 == 0 else 8 * SS),
                y + math.sin(math.radians(k * 36 - 90)) * (18 * SS if k % 2 == 0 else 8 * SS)) for k in range(10)]
        d.polygon(pts, fill=ink)
    out("postmarks", "postmark_round", faded(finish(img), 41, 0.55))


def postmark_wavy() -> None:
    W, H = int(ELEMENT_PX * 1.6) * SS, ELEMENT_PX * SS // 2
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    ink = (35, 35, 45, 225)
    for k in range(6):
        y0 = H * (0.12 + k * 0.152)
        pts = [(x, y0 + math.sin(x / W * math.pi * 5) * H * 0.05) for x in np.linspace(0, W, 120)]
        d.line(pts, fill=ink, width=7 * SS, joint="curve")
    out("postmarks", "postmark_wavy", faded(finish(img), 43, 0.6))


def main() -> None:
    for key, (seed, mottle, fibres, tint) in PAPERS.items():
        # @3x: React Native draws a repeat tile at its density-independent size, so the 512 px tile
        # covers ~171 dp and stays crisp instead of being upscaled (RN picks it for any density).
        out("papers", key, paper_texture(seed, mottle, fibres, tint), "@3x")
    out("papers", "edge_ageing", edge_ageing())
    stamp("stamp_dove", (46, 74, 112), (214, 226, 232), dove, "5")
    stamp("stamp_palm", (126, 50, 40), (236, 218, 186), palm, "10")
    stamp("stamp_lighthouse", (40, 90, 80), (210, 228, 222), lighthouse, "25")
    sticker_base(flower, "sticker_flower")
    sticker_base(moon, "sticker_moon")
    sticker_base(washi, "sticker_washi", size=(ELEMENT_PX, ELEMENT_PX // 2))
    postmark_round()
    postmark_wavy()


if __name__ == "__main__":
    main()
