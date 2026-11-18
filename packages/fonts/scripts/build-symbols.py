"""Reproduce the keyboard symbol resources; original Geist glyphs stay unchanged."""

import argparse
import copy
import hashlib
import io
import json
from pathlib import Path
from urllib.request import urlopen

from fontTools import subset
from fontTools.pens.recordingPen import DecomposingRecordingPen
from fontTools.ttLib import TTFont

ROOT = Path(__file__).resolve().parents[1]
REPO = ROOT.parents[1]
NATIVE = REPO / "native/compose/src/commonMain/composeResources/font"
GEIST_REV = "4d655731f83507f0258ce5541c297b6553d5d081"
NOTO_REV = "7af0d90b4d532ffa4b041937b560c6df4e7b1e95"
NOTO_URL = f"https://raw.githubusercontent.com/google/fonts/{NOTO_REV}/ofl/notosanssymbols2/NotoSansSymbols2-Regular.ttf"
NOTO_SHA = "7d5fb73b7ca67a6798101741f5d280a3d016a56a197afcd4199dbb57b4b82a21"
SOURCES = {
    "regular": ("Regular", "5e7c3b25da393b1619253c655f95c5d123184759a4961562add5b0f5386e63c9"),
    "medium": ("Medium", "0987db2030200a6b4a45d03398057c27733977b09bde67b8d0afc26b8b8d0768"),
    "semibold": ("SemiBold", "1a39b98de7a1cf5a8006ed9c37059e4a8e78811b8a00a7248baae7b2afb09527"),
}
CODEPOINT = 0x2318


def digest(data):
    return hashlib.sha256(data).hexdigest()


def source(url, expected, cache):
    path = cache / expected
    if not path.exists():
        with urlopen(url, timeout=30) as response:
            data = response.read()
        if digest(data) != expected:
            raise ValueError(f"Source hash mismatch: {url}")
        path.write_bytes(data)
    data = path.read_bytes()
    if digest(data) != expected:
        raise ValueError(f"Cached source hash mismatch: {path}")
    return TTFont(io.BytesIO(data), recalcTimestamp=False)


def encoded(font, flavor=None):
    font.flavor = flavor
    data = io.BytesIO()
    font.save(data)
    return data.getvalue()


def rename(font, family, style):
    names = {
        1: family,
        2: style,
        3: f"Labpics:{family.replace(' ', '')}-{style}:1",
        4: f"{family} {style}",
        6: f"{family.replace(' ', '')}-{style}",
        16: family,
        17: style,
    }
    for record in font["name"].names:
        if record.nameID in names:
            record.string = names[record.nameID].encode(record.getEncoding())
        elif record.nameID == 0:
            record.string = (
                "Copyright (c) 2023 Vercel, in collaboration with basement.studio; "
                "Copyright 2022 The Noto Project Authors"
            ).encode(record.getEncoding())


def outline(font, glyph):
    glyphs = font.getGlyphSet()
    pen = DecomposingRecordingPen(glyphs)
    glyphs[glyph].draw(pen)
    return pen.value


def verify_native(original, result, symbols):
    old_map, new_map = original.getBestCmap(), result.getBestCmap()
    assert set(new_map) - set(old_map) == {CODEPOINT}
    assert all(new_map[cp] == name for cp, name in old_map.items())
    for name in original.getGlyphOrder():
        assert result["hmtx"][name] == original["hmtx"][name], name
        assert outline(result, name) == outline(original, name), name
    # Adding a glyph must not change shaping, line layout, or original hint programs.
    for table in ("hhea", "OS/2", "GSUB", "GPOS", "GDEF", "kern", "fpgm", "prep", "cvt "):
        if table in original:
            if table == "hhea":
                for field in ("ascent", "descent", "lineGap"):
                    assert getattr(result[table], field) == getattr(original[table], field)
            else:
                assert result.getTableData(table) == original.getTableData(table), table
    glyph = symbols.getBestCmap()[CODEPOINT]
    assert outline(result, glyph) == outline(symbols, glyph)
    assert result["hmtx"][glyph] == symbols["hmtx"][glyph]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--cache-dir", type=Path, required=True)
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    args.cache_dir.mkdir(parents=True, exist_ok=True)
    noto = source(NOTO_URL, NOTO_SHA, args.cache_dir)
    options = subset.Options()
    options.hinting = False  # Noto hint programs cannot be copied into a different font.
    options.recalc_timestamp = False
    sub = subset.Subsetter(options=options)
    sub.populate(unicodes=[CODEPOINT])
    sub.subset(noto)
    # One non-composite glyph has no layout rules. Empty upstream script lists
    # would only add nondeterministic set ordering to the supplementary WOFF2.
    for table in ("GPOS", "GSUB", "GDEF"):
        if table in noto:
            del noto[table]
    glyph_name = noto.getBestCmap()[CODEPOINT]
    assert not noto["glyf"][glyph_name].isComposite()
    products = {}
    originals = {}
    for resource, (style, sha) in SOURCES.items():
        url = f"https://raw.githubusercontent.com/vercel/geist-font/{GEIST_REV}/packages/next/dist/fonts/geist-sans/Geist-{style}.ttf"
        original = source(url, sha, args.cache_dir)
        originals[resource] = original
        assert CODEPOINT not in original.getBestCmap()
        assert original["head"].unitsPerEm == noto["head"].unitsPerEm
        result = copy.deepcopy(original)
        assert glyph_name not in result.getGlyphOrder()
        order = [*result.getGlyphOrder(), glyph_name]
        result["glyf"][glyph_name] = copy.deepcopy(noto["glyf"][glyph_name])
        result["hmtx"][glyph_name] = noto["hmtx"][glyph_name]
        result.setGlyphOrder(order)
        for cmap in result["cmap"].tables:
            if cmap.isUnicode() and cmap.format in (4, 12):
                cmap.cmap[CODEPOINT] = glyph_name
        rename(result, "Lab UI Text", style)
        data = encoded(result)
        verify_native(original, TTFont(io.BytesIO(data)), noto)
        products[NATIVE / f"geist_{resource}.ttf"] = data

    # CSS Unicode ranges share one family, so the supplementary face needs the
    # same line metrics as Geist. Its own metrics would move the text baseline.
    web = copy.deepcopy(noto)
    metrics = originals["regular"]
    for field in ("ascent", "descent", "lineGap"):
        setattr(web["hhea"], field, getattr(metrics["hhea"], field))
    for field in ("sTypoAscender", "sTypoDescender", "sTypoLineGap", "usWinAscent", "usWinDescent"):
        setattr(web["OS/2"], field, getattr(metrics["OS/2"], field))
    rename(web, "Lab UI Symbols", "Regular")
    products[ROOT / "fonts/LabUI-Symbols.woff2"] = encoded(web, "woff2")
    report = {
        "codepoint": "U+2318",
        "source": {"url": NOTO_URL, "sha256": NOTO_SHA},
        "artifacts": {
            path.relative_to(REPO).as_posix(): {"sha256": digest(data), "bytes": len(data)}
            for path, data in products.items()
        },
    }
    products[ROOT / "symbols.json"] = (json.dumps(report, indent=2) + "\n").encode()
    for path, data in products.items():
        if args.check:
            if path.read_bytes() != data:
                raise ValueError(f"Generated resource differs: {path}")
        else:
            path.write_bytes(data)
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
