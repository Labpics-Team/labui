"""Compare read-only Figma PNG exports with the reproducible native source masters."""
import argparse
import json
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageStat

parser = argparse.ArgumentParser()
parser.add_argument("--tinted-source", type=Path, required=True)
parser.add_argument("--underlined-source", type=Path, required=True)
parser.add_argument("--control-source", type=Path, required=True)
args = parser.parse_args()
here = Path(__file__).resolve().parent
render = here.parents[1] / "build" / "tabs-render"
canvas = Image.new("RGB", (900, 460), "white")
draw = ImageDraw.Draw(canvas)
draw.text((16, 12), "Tabs: unchanged Figma export / Compose with packaged Geist (use size)", fill="#101012")
rows = [("tinted", args.tinted_source, 48), ("underlined", args.underlined_source, 184),
        ("underlined-control", args.control_source, 314)]
metrics = {}
for name, path, y in rows:
    source = Image.open(path).convert("RGBA")
    background = Image.new("RGBA", source.size, "white")
    background.alpha_composite(source)
    source = background.convert("RGB")
    native = Image.open(render / f"source-{name}-native-2x.png").convert("RGB")
    assert source.size == native.size, (name, source.size, native.size)
    metrics[name] = {"size_2x": source.size,
                     "mean_absolute_rgb_error_0_255": [round(v, 4) for v in ImageStat.Stat(ImageChops.difference(source, native)).mean]}
    draw.text((16, y), name, fill="#767680")
    for image, label, top in [(source, "Figma", y + 18), (native, "Native", y + 76)]:
        draw.text((16, top + 8), label, fill="#505058")
        canvas.paste(image.resize((image.width // 2, image.height // 2), Image.Resampling.BOX), (92, top))
canvas.save(here / "comparison.png")
(here / "comparison.generated.json").write_text(json.dumps(metrics, indent=2) + "\n", encoding="utf-8")
