"""Compare original SVG rasters with native CPU crops, both at their use size."""
import json
import sys
from pathlib import Path

from PIL import Image, ImageDraw

here = Path(__file__).resolve().parent
render = here.parents[1] / "build" / "chip-render"
source = Path(sys.argv[1])
matrix = Image.open(render / "chip-light-100.png").convert("RGBA")
bounds = json.loads((render / "chip-light-100.generated.json").read_text())["variants"]
manifest = json.loads((source / "svg-raster-manifest.json").read_text())
states = ["default", "hover", "pressed", "focus", "active", "disabled", "loading"]
canvas = Image.new("RGB", (800, len(manifest) * 68 + 88), "white")
draw = ImageDraw.Draw(canvas)
draw.text((20, 12), "Chip: original outlined SVG / Compose with packaged Geist", fill="#101012")
draw.text((20, 34), "Use size (1x). Source rasterized locally in Chromium; no Figma PNG.", fill="#505058")
draw.text((365, 59), "Original SVG", fill="#505058")
draw.text((555, 59), "Native CPU", fill="#505058")
for row, entry in enumerate(manifest):
    name = entry["source"].removesuffix(".svg").removeprefix("chip-")
    shape, size, state, selection = name.split("-")
    selected = selection == "selected"
    index = (28 if shape == "sharp" else 0) + (14 if size == "medium" else 0) + (7 if selected else 0) + states.index(state)
    box = bounds[index]
    margin = 4 if state == "focus" else 0
    x, y = round(box["x"]), round(box["y"])
    native = matrix.crop((x - margin, y - margin, x + box["width"] + margin, y + box["height"] + margin))
    original = Image.open(source / entry["png"]).convert("RGBA")
    original = original.resize((original.width // entry["scale"], original.height // entry["scale"]), Image.Resampling.BOX)
    top = 84 + row * 68
    draw.text((20, top + 10), name, fill="#34343a")
    if state == "loading":
        draw.text((20, top + 29), "Native keeps 'Chip label' and its close width", fill="#767680")
    canvas.paste(original, (365, top), original)
    canvas.paste(native, (555, top), native)
canvas.save(here / "comparison.png")
