"""Compare independent Figma, installed browser and installed Compose 2x rasters."""
import json
from pathlib import Path

from PIL import Image, ImageChops, ImageStat

root = Path(__file__).resolve().parent
source = Image.open(root / "figma-cells.png").convert("RGBA")
records = []


def crop(image, x, y):
    result = Image.new("RGBA", (96, 112), "white")
    result.alpha_composite(image.crop((x, y, x + 96, y + 112)))
    return result.convert("RGB")


# Coordinates belong to the retained comparison specimens, never production geometry.
for renderer, positions in [
    ("chromium", [(0, 0), (492, 0), (984, 0)]),
    ("webkit", [(0, 0), (492, 0), (984, 0)]),
    ("native", [(288, 48), (48, 48), (48, 448)]),
]:
    name = f"native-light-200.png" if renderer == "native" else f"web-{renderer}-light-200.png"
    rendered = Image.open(root / name).convert("RGBA")
    for state, source_x, (x, y) in zip(["empty", "filled", "danger"], [832, 1120, 1408], positions):
        difference = ImageChops.difference(crop(source, source_x, 48), crop(rendered, x, y))
        mae = sum(ImageStat.Stat(difference).mean) / 3
        records.append({"renderer": renderer, "state": state, "meanAbsoluteChannelError": mae,
                        "pixelsOver20": sum(max(pixel) > 20 for pixel in difference.get_flattened_data()),
                        "pixels": 96 * 112})
        assert mae < 1, f"{renderer}/{state}: wrong source cell, crop, geometry or paint ({mae})"

(root / "source-comparison.generated.json").write_text(json.dumps(records, indent=2) + "\n", encoding="utf-8")
print("All 9 independently rendered cells match the Figma source below 1/255 mean channel error.")
