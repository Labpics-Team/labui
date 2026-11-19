"""Render source and compiled material side by side at the actual usage sizes."""
from pathlib import Path
import json
from PIL import Image, ImageDraw, ImageFont

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
manifest = json.loads((ROOT / "assets/avatar/manifest.generated.json").read_text())
variants = {(v["color"], v["mode"]): v for v in manifest["variants"]}
colors = list(json.loads((ROOT / "packages/tokens/src/components.json").read_text())["avatar"]["colors"])
image = Image.new("RGB", (820, 810), "white")
draw = ImageDraw.Draw(image)
font = ImageFont.load_default(size=13)


def compiled(color, mode):
    return Image.open(ROOT / "packages/core/src" / variants[color, mode]["web"])


def pair(color, mode, x, y):
    reference = Image.open(HERE / f"references/{color}-{mode.split('-')[0]}.png")
    ink = "black" if mode.startswith("light") else "white"
    draw.text((x, y + 17), color, font=font, fill=ink)
    for pixels, left in [(32, x + 80), (48, x + 185)]:
        for offset, material in enumerate([reference, compiled(color, mode)]):
            thumb = material.resize((pixels, pixels), Image.Resampling.LANCZOS)
            image.paste(thumb, (left + offset * (pixels + 12), y), thumb)


draw.text((16, 12), "Light: source / compiled pairs at actual 32 px and 48 px", font=font, fill="black")
for index, color in enumerate(colors):
    pair(color, "light-normal", 16 + index // 5 * 400, 50 + index % 5 * 80)
draw.rectangle((0, 470, 820, 810), fill="#101012")
draw.text((16, 486), "Dark: existing source / compiled; other colors have no original dark specimen", font=font, fill="white")
for index, color in enumerate(["blue", "orange"]):
    pair(color, "dark-normal", 16 + index * 400, 524)
for mode, y in [("dark-normal", 636), ("dark-more", 728)]:
    draw.text((16, y - 24), f"{mode} — compiled palette", font=font, fill="white")
    for index, color in enumerate(colors):
        thumb = compiled(color, mode).resize((48, 48), Image.Resampling.LANCZOS)
        image.paste(thumb, (16 + index * 78, y), thumb)
image.save(HERE / "source-vs-compiled.png")
