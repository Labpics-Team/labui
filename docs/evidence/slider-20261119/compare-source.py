"""Compare readonly Figma exports against the three authored Slider renderers."""
import json
import sys
from pathlib import Path
from PIL import Image, ImageChops, ImageDraw, ImageStat

output = Path(__file__).resolve().parent
source = Path(sys.argv[1])
native = output / "native-light-density-1.0.png"
web = output / "web-chromium-light-density-1.png"
specimens = [
    ("6467-117311", "linear-0", 20, 36),
    ("7557-11680", "linear-50", 68, 116),
    ("6467-117330", "circular-0", 112, 176),
    ("6467-117334", "circular-50", 244, 308),
    ("6467-117338", "circular-100", 376, 440),
    ("7530-6557", "large-0", 512, 576),
    ("7530-6626", "large-50", 604, 668),
    ("7530-6616", "large-100", 696, 760),
]

def flatten(image):
    rgba = image.convert("RGBA")
    return Image.alpha_composite(Image.new("RGBA", rgba.size, "white"), rgba).convert("RGB")

records = []
for node, name, web_y, native_y in specimens:
    authored = flatten(Image.open(source / f"{node}.png"))
    width, height = authored.size
    panels = [("Figma", authored)]
    for renderer, file, y in [("Chromium", web, web_y), ("Compose", native, native_y)]:
        actual = flatten(Image.open(file)).crop((20, y, 20 + width, y + height))
        difference = ImageChops.difference(authored, actual)
        rgb = difference.tobytes()
        records.append({"node": node, "specimen": name, "renderer": renderer,
                        "size": [width, height], "meanRgbDifference": ImageStat.Stat(difference).mean,
                        "pixelsWithChannelDifferenceOver20": sum(max(pixel) > 20 for pixel in zip(rgb[0::3], rgb[1::3], rgb[2::3]))})
        panels.append((renderer, actual))
    canvas = Image.new("RGB", (max(300, width + 32), (height + 30) * 3 + 16), "white")
    draw = ImageDraw.Draw(canvas)
    for row, (label, image) in enumerate(panels):
        y = row * (height + 30)
        draw.text((16, y + 4), label, fill="black")
        canvas.paste(image, (16, y + 24))
    canvas.save(output / f"compare-{name}.png")
(output / "comparison.generated.json").write_text(json.dumps(records, indent=2) + "\n", encoding="utf-8")
