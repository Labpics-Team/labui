"""Rebuild the review sheets and numeric observations from the captured PNG files (Pillow)."""
from pathlib import Path
import json
from PIL import Image, ImageChops, ImageDraw, ImageStat

root = Path(__file__).parent


def image(name, background=(255, 255, 255)):
    source = Image.open(root / name).convert("RGBA")
    result = Image.new("RGBA", source.size, (*background, 255))
    result.alpha_composite(source)
    return result.convert("RGB")


states = [
    ("Default", "7988", "100-1144-idle", (0, 56)),
    ("Halfy dragged", "7989", "half", None),
    ("Fully dragged", "7990", "full", None),
    ("Success", "7991", "success", (144, 200)),
    ("Danger", "7993", "danger", (216, 272)),
]
sheet = Image.new("RGB", (1176, 1720), "#ededed")
draw = ImageDraw.Draw(sheet)
y = 16
metrics = {"sourceVersion": "2423213750570316842", "stateMeanAbsoluteRgbDifference": {}}
for title, source_id, suffix, crop in states:
    draw.text((16, y), title, fill="black")
    y += 24
    native = image(f"native/native-light-{suffix}.png") if crop is None else image("native/native-light-100-1144.png").crop((0, crop[0], 1144, crop[1]))
    renders = {
        "Figma": image(f"figma-7530-{source_id}.png"),
        "Chromium": image(f"chromium-light-{suffix}.png"),
        "WebKit": image(f"webkit-light-{suffix}.png"),
        "Compose": native,
    }
    metrics["stateMeanAbsoluteRgbDifference"][title] = {
        name: round(sum(ImageStat.Stat(ImageChops.difference(render, renders["Figma"])).mean) / 3, 3)
        for name, render in renders.items() if name != "Figma"
    }
    assert all(value < 4 for value in metrics["stateMeanAbsoluteRgbDifference"][title].values()), f"{title}: inspect the render difference"
    if title == "Default":
        metrics["defaultTrackProbes"] = {
            name: {f"{x},10": render.getpixel((x, 10)) for x in (188, 258, 460)}
            for name, render in renders.items()
        }
    for name, render in renders.items():
        draw.text((16, y), name, fill="#333333")
        y += 16
        sheet.paste(render, (16, y))
        y += 60
    y += 4
sheet.crop((0, 0, sheet.width, y + 12)).save(root / "comparison-authored-light.png")

sheet = Image.new("RGB", (880, 364), "#ededed")
draw = ImageDraw.Draw(sheet)
for column, theme in enumerate(("light", "dark")):
    x = 16 + column * 432
    y = 16
    draw.text((x, y), f"{theme.title()} / authored 416 x 56", fill="black")
    y += 24
    frame = image("figma-7530-6820.png" if theme == "light" else "figma-dark.png")
    renders = {
        "Figma": frame.crop((96, 306, 512, 362)),
        "Chromium": image(f"chromium-{theme}-100-416-idle.png"),
        "WebKit": image(f"webkit-{theme}-100-416-idle.png"),
        "Compose": image(f"native/native-{theme}-100-416.png").crop((0, 0, 416, 56)),
    }
    for name, render in renders.items():
        draw.text((x, y), name, fill="#333333")
        y += 16
        sheet.paste(render, (x, y))
        y += 60
sheet.save(root / "comparison-themes.png")
(root / "comparison.json").write_text(json.dumps(metrics, indent=2) + "\n", encoding="utf-8")

sheet = Image.new("RGB", (464, 888), "#ededed")
draw = ImageDraw.Draw(sheet)
for row, (name, render) in enumerate({
    "Figma": image("figma-7530-7988.png"),
    "Chromium": image("chromium-light-100-1144-idle.png"),
    "WebKit": image("webkit-light-100-1144-idle.png"),
    "Compose": image("native/native-light-100-1144.png"),
}.items()):
    y = 16 + row * 216
    draw.text((16, y), name + " / nearest 6x", fill="black")
    crop = render.crop((536, 12, 608, 44))
    sheet.paste(crop.resize((432, 192), Image.Resampling.NEAREST), (16, y + 16))
sheet.save(root / "comparison-helper-crop.png")
