"""Prueft die Enhance-READMEs gegen die ausgelieferten und stillgelegten JPEGs.

Aufruf: python3 -m unittest test_enhance_docs
"""

import hashlib
import os
import re
import struct
import unittest

REPO = os.path.dirname(os.path.abspath(__file__))
STREET_DIR = os.path.join(REPO, "frontend", "disabled-assets", "enhance-street")
PUBLIC_DIR = os.path.join(REPO, "frontend", "public", "enhance")
PUBLIC_README = os.path.join(PUBLIC_DIR, "README.md")
DOCS = (
    PUBLIC_README,
    os.path.join(STREET_DIR, "README.md"),
    os.path.join(REPO, "frontend", "disabled-assets", "enhance-curated", "README.md"),
)

SOF_MARKERS = {0xC0, 0xC1, 0xC2, 0xC3, 0xC5, 0xC6, 0xC7,
               0xC9, 0xCA, 0xCB, 0xCD, 0xCE, 0xCF}
OLD_WIDTH = re.compile(r"\b400\s*(?:-\s*)?(?:px|pixel)\b", re.IGNORECASE)


def read_text(path):
    with open(path, "r", encoding="utf-8") as file:
        return file.read()


def german_int(value):
    """Deutsche Tausenderpunkte aus einer README-Zahl entfernen."""
    return int(value.replace(".", ""))


def jpeg_size_bytes(data, label="JPEG-Daten"):
    """(Breite, Hoehe) aus der JPEG-Segmentkette lesen — ohne Fremdbibliothek."""
    if not data.startswith(b"\xff\xd8"):
        raise AssertionError(f"kein JPEG-Dateianfang: {label}")

    i = 2
    while i < len(data):
        if data[i] != 0xFF:
            raise AssertionError(f"ungueltige JPEG-Segmentkette: {label}")
        # JPEG erlaubt beliebig viele 0xFF-Fuellbytes vor einem Marker.
        while i < len(data) and data[i] == 0xFF:
            i += 1
        if i >= len(data):
            break
        marker = data[i]
        i += 1

        if marker in SOF_MARKERS:
            if i + 7 > len(data):
                break
            segment_length = struct.unpack(">H", data[i:i + 2])[0]
            if segment_length < 7 or i + segment_length > len(data):
                break
            height, width = struct.unpack(">HH", data[i + 3:i + 7])
            return width, height

        # SOI, TEM und Restart-Marker tragen keine Segmentlaenge. EOI beendet
        # die Datei; nach SOS folgen Entropiedaten, die kein Segmentparser lesen darf.
        if marker == 0xD9:
            break
        if marker == 0xD8 or marker == 0x01 or 0xD0 <= marker <= 0xD7:
            continue
        if marker == 0xDA:
            break
        if marker == 0x00 or i + 2 > len(data):
            break

        segment_length = struct.unpack(">H", data[i:i + 2])[0]
        if segment_length < 2 or i + segment_length > len(data):
            break
        i += segment_length

    raise AssertionError(f"kein JPEG-Bildkopf gefunden: {label}")


def jpeg_size(path):
    with open(path, "rb") as file:
        return jpeg_size_bytes(file.read(), path)


def public_manifest(text):
    """Dateitabelle und globale Massangaben aus dem öffentlichen README lesen."""
    rows = {}
    pattern = re.compile(
        r"^\| `(?P<name>cctv-\d+\.jpg)` \| [^|]* \| "
        r"(?P<size>[\d.]+) Byte \| `(?P<sha>[0-9a-f]{64})` \|$",
        re.MULTILINE,
    )
    for match in pattern.finditer(text):
        rows[match.group("name")] = {
            "size": german_int(match.group("size")),
            "sha256": match.group("sha"),
        }

    current_size = re.search(
        r"auf\s+([\d.]+)\s*×\s*([\d.]+)\s*px\s+verkleinert", text,
    )
    comparison = re.search(
        r"statt\s+([\d.]+)\s*×\s*([\d.]+)[–-]([\d.]+)", text,
    )
    totals = re.search(
        r"Zusammen\s+([\d.]+)\s+Byte\.\s+Der vorherige Bestand.*?"
        r"belegte\s+([\d.]+)\s+Byte",
        text,
        re.DOTALL,
    )
    if not rows or not current_size or not comparison or not totals:
        raise AssertionError("Enhance-README enthaelt keine vollstaendigen Messangaben")

    return {
        "rows": rows,
        "current_size": tuple(german_int(value) for value in current_size.groups()),
        "street_size": tuple(german_int(value) for value in comparison.groups()),
        "current_total": german_int(totals.group(1)),
        "street_total": german_int(totals.group(2)),
    }


class JpegSizeParserTests(unittest.TestCase):
    def test_accepts_fill_bytes_before_start_of_frame(self):
        data = (
            b"\xff\xd8\xff\xff\xc0\x00\x0b\x08\x00\x02\x00\x03"
            b"\x01\x01\x11\x00\xff\xd9"
        )
        self.assertEqual(jpeg_size_bytes(data), (3, 2))

    def test_eoi_and_sos_stop_before_fake_frame_markers(self):
        for data in (
            b"\xff\xd8\xff\xd9" + b"A" * 20,
            b"\xff\xd8\xff\xda\x00\x08" + b"A" * 8
            + b"\xff\xc0\x00\x0b\x08\x03\xe7\x10\x92" + b"A" * 6,
        ):
            with self.subTest(data=data[:8]):
                with self.assertRaisesRegex(AssertionError, "kein JPEG-Bildkopf"):
                    jpeg_size_bytes(data)


class EnhanceDocMeasurementTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.public_text = read_text(PUBLIC_README)
        cls.manifest = public_manifest(cls.public_text)

    def street_files(self):
        names = sorted(name for name in os.listdir(STREET_DIR)
                       if re.fullmatch(r"street-\d+\.jpg", name))
        self.assertEqual(len(names), 6, "sechs street-Bilder erwartet")
        return [os.path.join(STREET_DIR, name) for name in names]

    def test_street_dimensions_and_total_match_documentation(self):
        width, documented_min_height, documented_max_height = self.manifest["street_size"]
        dimensions = [jpeg_size(path) for path in self.street_files()]
        self.assertEqual({actual_width for actual_width, _ in dimensions}, {width})
        heights = [height for _, height in dimensions]
        self.assertEqual((min(heights), max(heights)),
                         (documented_min_height, documented_max_height))
        self.assertEqual(
            sum(os.path.getsize(path) for path in self.street_files()),
            self.manifest["street_total"],
        )

    def test_public_table_matches_files_byte_for_byte(self):
        documented = self.manifest["rows"]
        actual_names = {
            name for name in os.listdir(PUBLIC_DIR)
            if re.fullmatch(r"cctv-\d+\.jpg", name)
        }
        self.assertEqual(set(documented), actual_names)

        for name, expected in documented.items():
            path = os.path.join(PUBLIC_DIR, name)
            with self.subTest(name=name):
                self.assertEqual(os.path.getsize(path), expected["size"])
                with open(path, "rb") as file:
                    self.assertEqual(hashlib.sha256(file.read()).hexdigest(),
                                     expected["sha256"])
                self.assertEqual(jpeg_size(path), self.manifest["current_size"])
        self.assertEqual(
            sum(os.path.getsize(os.path.join(PUBLIC_DIR, name)) for name in actual_names),
            self.manifest["current_total"],
        )

    def test_old_width_guard_covers_common_spellings(self):
        for spelling in ("400px", "400 px", "400-px", "400 Pixel", "400-Pixel"):
            with self.subTest(spelling=spelling):
                self.assertRegex(spelling, OLD_WIDTH)

    def test_documents_use_the_measured_street_width(self):
        documented_width = self.manifest["street_size"][0]
        current_width = re.compile(
            rf"\b{documented_width}\s*(?:-\s*)?(?:px|pixel)\b",
            re.IGNORECASE,
        )
        for doc in DOCS:
            text = read_text(doc)
            with self.subTest(doc=doc):
                self.assertNotRegex(text, OLD_WIDTH)
                self.assertRegex(text, current_width)


if __name__ == "__main__":
    unittest.main()
