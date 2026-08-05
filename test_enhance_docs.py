"""Prueft die Massangaben in den Enhance-READMEs gegen die echten JPEG-Dateien.

Hintergrund: In vier Zeilen stand, die stillgelegten `street-*.jpg` waeren
400 px breite Vorschaubilder. Der JPEG-Header sagt 500 px. Solche Angaben lassen
sich nicht durch Hinsehen pruefen, deshalb liest dieser Test die Groessen direkt
aus den Dateien und vergleicht sie mit dem, was in der Doku behauptet wird.

Aufruf: python3 -m unittest test_enhance_docs
"""

import os
import re
import struct
import unittest

REPO = os.path.dirname(os.path.abspath(__file__))
STREET_DIR = os.path.join(REPO, "frontend", "disabled-assets", "enhance-street")
# Die drei Dokumente, die ueber die street-Bilder eine Massangabe machen.
DOCS = (
    os.path.join(REPO, "frontend", "public", "enhance", "README.md"),
    os.path.join(STREET_DIR, "README.md"),
    os.path.join(REPO, "frontend", "disabled-assets", "enhance-curated", "README.md"),
)

# JPEG-Marker, die einen Bildkopf (Start of Frame) einleiten. Danach stehen
# Genauigkeit (1 Byte), Hoehe (2 Byte) und Breite (2 Byte).
SOF_MARKERS = {0xC0, 0xC1, 0xC2, 0xC3, 0xC5, 0xC6, 0xC7, 0xC9, 0xCA, 0xCB, 0xCD, 0xCE, 0xCF}


def jpeg_size(path):
    """(Breite, Hoehe) eines JPEGs aus dem Dateikopf lesen — ohne Fremdbibliothek.

    Eine JPEG-Datei ist eine Kette von Abschnitten ("Segmenten"). Jedes Segment
    beginnt mit 0xFF und einem Marker-Byte; danach folgt seine Laenge. Wir
    springen von Segment zu Segment, bis der Bildkopf kommt."""
    with open(path, "rb") as f:
        data = f.read()
    i = 2  # die ersten zwei Byte sind der Dateianfang 0xFFD8
    while i < len(data) - 9:
        if data[i] != 0xFF:
            i += 1
            continue
        marker = data[i + 1]
        if marker in SOF_MARKERS:
            height, width = struct.unpack(">HH", data[i + 5:i + 9])
            return width, height
        if marker == 0xD8 or marker == 0x01 or 0xD0 <= marker <= 0xD7:
            i += 2  # Marker ohne Laengenangabe
            continue
        i += 2 + struct.unpack(">H", data[i + 2:i + 4])[0]
    raise AssertionError(f"kein JPEG-Bildkopf gefunden: {path}")


class EnhanceDocMeasurementTests(unittest.TestCase):
    def street_files(self):
        names = sorted(n for n in os.listdir(STREET_DIR) if n.startswith("street-"))
        self.assertEqual(len(names), 6, "sechs street-Bilder erwartet")
        return [os.path.join(STREET_DIR, n) for n in names]

    def test_all_street_images_are_500_pixels_wide(self):
        for path in self.street_files():
            width, height = jpeg_size(path)
            self.assertEqual(width, 500, os.path.basename(path))
            self.assertTrue(333 <= height <= 375, f"{os.path.basename(path)}: {height}")

    def test_documented_byte_total_matches_the_files(self):
        total = sum(os.path.getsize(p) for p in self.street_files())
        self.assertEqual(total, 337322)

    def test_no_document_claims_400_pixels_anymore(self):
        for doc in DOCS:
            with open(doc, "r", encoding="utf-8") as f:
                text = f.read()
            self.assertNotRegex(text, r"400[ -]px", doc)
            self.assertRegex(text, r"500[ -]px", doc)


if __name__ == "__main__":
    unittest.main()
