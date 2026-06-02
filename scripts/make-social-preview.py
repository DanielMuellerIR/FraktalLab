#!/usr/bin/env python3
"""
Erzeugt README-Hero und GitHub-Social-Preview aus einem gewaehlten Screenshot.

Eingabe: ein Screenshot, idealerweise Proxima auf Desktop.
Ausgabe:
  - docs/assets/fraktallab-proxima.jpg  (README-Hero)
  - docs/assets/social-preview.jpg      (GitHub Social Preview, 1280x640)

Warum JPG: GitHub Social Preview muss unter 1 MB bleiben; Neon-/Fraktal-PNGs
werden bei 1280x640 oft unnoetig gross.
"""

from __future__ import annotations

import argparse
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
ASSET_DIR = ROOT / "docs" / "assets"
README_IMAGE = ASSET_DIR / "fraktallab-proxima.jpg"
SOCIAL_IMAGE = ASSET_DIR / "social-preview.jpg"


def crop_cover(img: Image.Image, target_w: int, target_h: int, anchor: str) -> Image.Image:
    """Croppt ein Bild auf Ziel-Seitenverhaeltnis, ohne es zu verzerren."""
    src_w, src_h = img.size
    target_ratio = target_w / target_h
    src_ratio = src_w / src_h

    if src_ratio > target_ratio:
        # Bild ist zu breit: links/rechts beschneiden.
        crop_h = src_h
        crop_w = round(crop_h * target_ratio)
        left = round((src_w - crop_w) / 2)
        top = 0
    else:
        # Bild ist zu hoch: oben/unten beschneiden. Default "top", damit Header
        # und Density-Leiste im Social Preview sichtbar bleiben.
        crop_w = src_w
        crop_h = round(crop_w / target_ratio)
        left = 0
        if anchor == "center":
            top = round((src_h - crop_h) / 2)
        elif anchor == "bottom":
            top = src_h - crop_h
        else:
            top = 0

    cropped = img.crop((left, top, left + crop_w, top + crop_h))
    return cropped.resize((target_w, target_h), Image.Resampling.LANCZOS)


def resize_width(img: Image.Image, max_w: int) -> Image.Image:
    """Skaliert nur herunter; kleinere Screenshots bleiben unvergroessert."""
    w, h = img.size
    if w <= max_w:
        return img
    new_h = round(h * (max_w / w))
    return img.resize((max_w, new_h), Image.Resampling.LANCZOS)


def save_jpeg(img: Image.Image, path: Path, quality: int) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    rgb = img.convert("RGB")
    rgb.save(path, "JPEG", quality=quality, optimize=True, progressive=True)


def main() -> None:
    parser = argparse.ArgumentParser(description="FraktalLab README-/Social-Preview-Bilder erzeugen")
    parser.add_argument("screenshot", help="Pfad zum gewaehlten Screenshot")
    parser.add_argument("--anchor", choices=["top", "center", "bottom"], default="top",
                        help="Vertikale Crop-Position fuer social-preview.jpg")
    parser.add_argument("--quality", type=int, default=88, help="JPEG-Qualitaet 1..95")
    args = parser.parse_args()

    src = Path(args.screenshot).expanduser().resolve()
    if not src.is_file():
        raise SystemExit(f"FEHLER: Screenshot nicht gefunden: {src}")

    img = Image.open(src)
    save_jpeg(resize_width(img, 1440), README_IMAGE, args.quality)
    save_jpeg(crop_cover(img, 1280, 640, args.anchor), SOCIAL_IMAGE, args.quality)

    print(f"README-Hero:     {README_IMAGE}")
    print(f"Social Preview:  {SOCIAL_IMAGE}")
    print(f"Social Preview:  {SOCIAL_IMAGE.stat().st_size / 1024:.0f} KB")


if __name__ == "__main__":
    main()
