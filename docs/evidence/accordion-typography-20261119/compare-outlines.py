import io, json, sys, xml.etree.ElementTree as ET, hashlib
from pathlib import Path

import uharfbuzz as hb
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont
from fontTools.pens.recordingPen import RecordingPen, DecomposingRecordingPen
from fontTools.pens.boundsPen import BoundsPen
from fontTools.pens.transformPen import TransformPen
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.svgLib.path import parse_path
import argparse

parser = argparse.ArgumentParser()
parser.add_argument("--font-cache", type=Path, required=True)
parser.add_argument("--output", type=Path, required=True)
args = parser.parse_args()
r = Path(__file__).resolve().parent
repo = r.parents[2]
source = json.loads((r / "source-text.json").read_text(encoding="utf-8"))
catalog = {
    "nodes": {
        n["id"]: {"document": n}
        for n in source["text"]
        if n["id"]
        in [
            "6225:42454",
            "6109:5889",
            "6225:42451",
            "6225:1048",
            "6227:8350",
            "6050:2314",
        ]
    }
}
rows = []
models = {
    "1.400-variable": repo / "packages/fonts/fonts/Geist-Variable.woff2",
    "1.400-static": args.font_cache / "Geist-Regular-1.4.2.ttf",
    "1.800-variable": args.font_cache / "Geist-Variable-v1.7.2.woff2",
    "1.800-static": args.font_cache / "Geist-Regular-v1.7.2.ttf",
}


def bounds(p):
    b = BoundsPen(None)
    p.replay(b)
    return b.bounds


def svg(p):
    b = bounds(p)
    sp = SVGPathPen(None)
    p.replay(TransformPen(sp, (1, 0, 0, 1, -b[0] + 1, -b[1] + 1)))
    return f'<svg xmlns="http://www.w3.org/2000/svg" width="360" height="30" viewBox="0 0 360 30"><path fill="black" d="{sp.getCommands()}"/></svg>'


def inspect(id, text, size, weight, tracking, p, sourceBox=None):
    sb = bounds(p)
    if sourceBox:
        scaled = RecordingPen()
        p.replay(
            TransformPen(
                scaled,
                (
                    sourceBox["width"] / (sb[2] - sb[0]),
                    0,
                    0,
                    sourceBox["height"] / (sb[3] - sb[1]),
                    0,
                    0,
                ),
            )
        )
        p = scaled
        sb = bounds(p)
    rec = {
        "id": id,
        "text": text,
        "fontSize": size,
        "weight": weight,
        "tracking": tracking,
        "sourceInkWidth": sb[2] - sb[0],
        "sourceInkHeight": sb[3] - sb[1],
        "source": svg(p),
        "models": {},
    }
    for name, fp in models.items():
        if weight == 500 and "static" in name:
            fp = fp.with_name(fp.name.replace("Regular", "Medium"))
        f = TTFont(fp)
        if "fvar" in f:
            f = instantiateVariableFont(f, {"wght": weight}, inplace=False)
        f.flavor = None
        blob = io.BytesIO()
        f.save(blob)
        font = hb.Font(hb.Face(blob.getvalue()))
        buf = hb.Buffer()
        buf.add_str(text)
        buf.guess_segment_properties()
        hb.shape(font, buf, {"liga": tracking == 0, "clig": tracking == 0})
        gs = f.getGlyphSet()
        s = size / f["head"].unitsPerEm
        x = 0
        mp = RecordingPen()
        for g, pos in zip(buf.glyph_infos, buf.glyph_positions):
            q = DecomposingRecordingPen(gs)
            gs[f.getGlyphName(g.codepoint)].draw(q)
            q.replay(
                TransformPen(
                    mp,
                    (
                        s,
                        0,
                        0,
                        -s,
                        (x + pos.x_offset) * s + g.cluster * tracking,
                        -pos.y_offset * s,
                    ),
                )
            )
            x += pos.x_advance
        mb = bounds(mp)
        rec["models"][name] = {
            "svg": svg(mp),
            "advance": x * s + len(text) * tracking,
            "inkWidth": mb[2] - mb[0],
            "inkHeight": mb[3] - mb[1],
            "widthError": mb[2] - mb[0] - rec["sourceInkWidth"],
            "sha256": hashlib.sha256(fp.read_bytes()).hexdigest(),
        }
    rows.append(rec)


for id, n in catalog["nodes"].items():
    x = n["document"]
    style = x["style"]
    p = RecordingPen()
    for el in ET.parse(r / f'source/{id.replace(":","-")}.svg').getroot():
        if el.tag.endswith("path"):
            parse_path(el.get("d"), p)
    inspect(
        id,
        x["characters"],
        style["fontSize"],
        style["fontWeight"],
        style["letterSpacing"],
        p,
        x["absoluteRenderBounds"],
    )
for id, i, text, weight, tracking in [
    ("6088-4232", 0, "Is it accessible?", 500, 0),
    ("6088-4232", 1, "Yes. It adheres to the WAI-ARIA design pattern.", 400, -0.25),
    ("8980-2185", 1, "Is it accessible?", 500, 0),
]:
    p = RecordingPen()
    parse_path(list(ET.parse(r / f"source/source-{id}.svg").getroot())[i].get("d"), p)
    inspect(
        id + ("-title" if weight == 500 else "-body"), text, 16, weight, tracking, p
    )
args.output.write_text(json.dumps(rows, ensure_ascii=False), encoding="utf-8")
for x in rows:
    print(
        x["id"],
        x["text"],
        round(x["sourceInkWidth"], 3),
        [(name, round(y["widthError"], 3)) for name, y in x["models"].items()],
    )
