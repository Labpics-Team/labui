"""Compare unchanged private author exports with public, reproducible web renders."""
import argparse
import json
from pathlib import Path
from PIL import Image, ImageChops, ImageDraw, ImageStat

parser = argparse.ArgumentParser()
parser.add_argument("--tinted-source", type=Path, required=True)
parser.add_argument("--underlined-source", type=Path, required=True)
args = parser.parse_args()
here = Path(__file__).resolve().parent
canvas = Image.new("RGB", (900, 470), "white")
draw = ImageDraw.Draw(canvas)
draw.text((16, 12), "Tabs: unchanged Figma export / browser with packaged Geist (use size)", fill="#101012")
metrics = {}
for name, path, y in [("tinted", args.tinted_source, 44), ("underlined", args.underlined_source, 250)]:
    raw = Image.open(path).convert("RGBA")
    source = Image.new("RGBA", raw.size, "white")
    source.alpha_composite(raw)
    source = source.convert("RGB")
    draw.text((16, y), name, fill="#767680")
    images = [("Figma", source)]
    for engine in ["chromium", "webkit"]:
        render = Image.open(here / f"{engine}-source-{name}.png").convert("RGB")
        assert source.size == render.size, (engine, name, source.size, render.size)
        metrics[f"{engine}-{name}"] = {"size_2x": source.size,
            "mean_absolute_rgb_error_0_255": [round(v, 4) for v in ImageStat.Stat(ImageChops.difference(source, render)).mean]}
        images.append((engine, render))
    for index, (label, image) in enumerate(images):
        top = y + 20 + index * 60
        draw.text((16, top + 8), label, fill="#505058")
        canvas.paste(image.resize((image.width // 2, image.height // 2), Image.Resampling.BOX), (100, top))
canvas.save(here / "comparison.png")
(here / "comparison.json").write_text(json.dumps(metrics, indent=2) + "\n", encoding="utf-8")
