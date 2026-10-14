#!/usr/bin/env python3
"""Generate the PWA icon set.

Drawing is vectorised with numpy and PNG encoding is done by hand with zlib +
struct, so no image libraries are involved. Only needed if you want to
regenerate the icons; the app itself has no dependencies.
"""

import struct
import zlib
from pathlib import Path

import numpy as np

SS = 3  # supersampling factor, box-filtered down at the end

BG_TOP = np.array([11, 17, 32], dtype=np.float64)
BG_BOTTOM = np.array([23, 32, 56], dtype=np.float64)
DIAL_TOP = np.array([52, 68, 108], dtype=np.float64)
DIAL_BOTTOM = np.array([16, 24, 46], dtype=np.float64)
ACCENT = np.array([255, 196, 84], dtype=np.float64)
ACCENT_DIM = np.array([255, 150, 60], dtype=np.float64)
NIGHT = np.array([96, 126, 196], dtype=np.float64)
FACE = np.array([245, 248, 255], dtype=np.float64)
FACE_DIM = np.array([168, 182, 208], dtype=np.float64)

HERE = Path(__file__).resolve().parent


def mix(base, colour, amount):
    """Blend `colour` into `base` where `amount` is a per-pixel alpha map."""
    amount = np.asarray(amount, dtype=np.float64)
    if amount.ndim == 2:
        amount = amount[..., None]
    return base * (1 - amount) + colour * amount


def rounded_rect(n, radius):
    """Boolean mask for a rounded square filling an n x n grid."""
    idx = np.arange(n) + 0.5
    half = n / 2.0
    dx = np.abs(idx - half) - (half - radius)
    qx = np.maximum(dx, 0.0)[:, None]
    qy = np.maximum(dx, 0.0)[None, :]
    return np.hypot(qx, qy) <= radius


def segment_distance(X, Y, ax, ay, bx, by):
    vx, vy = bx - ax, by - ay
    seg = vx * vx + vy * vy
    t = np.clip(((X - ax) * vx + (Y - ay) * vy) / seg, 0.0, 1.0)
    return np.hypot(X - (ax + t * vx), Y - (ay + t * vy))


def render(size, maskable=False):
    n = size * SS
    idx = np.arange(n) + 0.5
    X, Y = np.meshgrid(idx, idx)
    c = n / 2.0

    shape = rounded_rect(n, n * 0.225)
    img = np.repeat(BG_TOP + (BG_BOTTOM - BG_TOP) * (Y / n)[..., None], 1, axis=0)

    dial_r = n * (0.335 if maskable else 0.36)
    dc = np.hypot(X - c, Y - c)
    inside = dc <= dial_r
    dial_t = np.clip((Y - (c - dial_r)) / (2 * dial_r), 0.0, 1.0)[..., None]
    img = np.where(inside[..., None], DIAL_TOP + (DIAL_BOTTOM - DIAL_TOP) * dial_t, img)

    # Warm wash over the sun-facing (upper) half of the dial, cool night below.
    sun_side = np.degrees(np.arctan2(c - Y, X - c)) > 0
    depth = np.clip((dial_r - dc) / dial_r, 0.0, 1.0)
    warm = inside & sun_side
    img = np.where(warm[..., None], mix(img, ACCENT, 0.16 + 0.26 * depth), img)
    night = inside & ~sun_side
    img = np.where(night[..., None], mix(img, NIGHT, 0.10 + 0.10 * depth), img)

    # Small sun riding the upper-left arc.
    sun_a = np.radians(205)
    sun_r = dial_r * 0.52
    sun = inside & (np.hypot(X - (c + np.cos(sun_a) * sun_r),
                             Y - (c + np.sin(sun_a) * sun_r)) <= dial_r * 0.16)
    img = np.where(sun[..., None], mix(img, ACCENT, 0.95), img)

    # Dial rim.
    rim = inside & (np.abs(dc - dial_r * 0.965) <= n * 0.006)
    img = np.where(rim[..., None], mix(img, FACE, np.full((n, n), 0.30)), img)

    # Hour ticks.
    ticks = np.zeros((n, n), dtype=bool)
    for i in range(12):
        a = np.radians(i * 30 - 90)
        r0 = dial_r * 0.80
        r1 = dial_r * (0.92 if i % 3 == 0 else 0.865)
        d = segment_distance(
            X, Y,
            c + np.cos(a) * r0, c + np.sin(a) * r0,
            c + np.cos(a) * r1, c + np.sin(a) * r1,
        )
        hit = inside & (d <= n * 0.0085)
        col = FACE if i % 3 == 0 else FACE_DIM
        img = np.where(hit[..., None], mix(img, col, np.full((n, n), 0.9)), img)
        ticks |= hit

    # Hands at 10:09.
    for angle, length, width in ((np.radians(-60), dial_r * 0.58, 0.030),
                                 (np.radians(60), dial_r * 0.76, 0.024)):
        d = segment_distance(
            X, Y,
            c - np.cos(angle) * length * 0.18, c - np.sin(angle) * length * 0.18,
            c + np.cos(angle) * length, c + np.sin(angle) * length,
        )
        hit = inside & (d <= n * width / 2)
        img = np.where(hit[..., None], FACE, img)

    pin = inside & (dc <= n * 0.022)
    img = np.where(pin[..., None], ACCENT, img)

    # Meridian line: the day/night split.
    line = inside & (np.abs(X - c) <= n * 0.0035) & (dc > dial_r * 0.985)
    img = np.where(line[..., None], mix(img, ACCENT_DIM, np.full((n, n), 0.35)), img)

    # Box-filter the supersampled buffer down to `size`.
    s = SS
    img = img.reshape(size, s, size, s, 3).mean(axis=(1, 3))
    a = shape.reshape(size, s, size, s).mean(axis=(1, 3))

    rgb = np.clip(np.round(img), 0, 255).astype(np.uint8)
    alpha = np.clip(np.round(a * 255.0), 0, 255).astype(np.uint8)
    rgba = np.dstack([rgb, alpha]).reshape(size, size * 4)

    flat = np.zeros((size, size * 4 + 1), dtype=np.uint8)
    flat[:, 1:] = rgba
    return flat.tobytes()


def write_png(path, size, raw):
    def chunk(tag, data):
        body = tag + data
        return struct.pack(">I", len(data)) + body + struct.pack(">I", zlib.crc32(body))

    png = (
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", struct.pack(">IIBBBBB", size, size, 8, 6, 0, 0, 0))
        + chunk(b"IDAT", zlib.compress(raw, 9))
        + chunk(b"IEND", b"")
    )
    path.write_bytes(png)
    print(f"{path.name}: {size}x{size}, {len(png):,} bytes")


def main():
    for name, size, maskable in [
        ("icon-192.png", 192, False),
        ("icon-512.png", 512, False),
        ("maskable-512.png", 512, True),
        ("apple-touch-icon.png", 180, True),
        ("favicon-64.png", 64, False),
    ]:
        write_png(HERE / name, size, render(size, maskable))


if __name__ == "__main__":
    main()