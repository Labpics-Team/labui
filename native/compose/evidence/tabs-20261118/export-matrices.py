"""Assemble the already-tested CPU scenes into reviewable evidence images."""
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw

here = Path(__file__).resolve().parent
compose = here.parents[1]
for path in (compose / "build" / "tabs-render").glob("tabs-*.png"):
    image = Image.open(path).convert("RGB")
    bounds = ImageChops.difference(image, Image.new("RGB", image.size, image.getpixel((0, 0)))).getbbox()
    image.crop((0, 0, image.width, min(image.height, bounds[3] + 24))).save(here / path.name)

for scale in [100, 125, 200]:
    canvas = Image.new("RGB", (1200, 1488), "white")
    draw = ImageDraw.Draw(canvas)
    for row, theme in enumerate(["light", "dark"]):
        for col, material in enumerate(["solid", "acrylic", "glass"]):
            x, y = col * 400, row * 744
            draw.text((x + 12, y + 6), f"{theme} / {material} / {scale}%", fill="#101012")
            image = Image.open(compose / "consumer" / "build" / "tabs-consumer" /
                               f"tabs-consumer-{theme}-{material}-{scale}.png").convert("RGB")
            canvas.paste(image, (x, y + 24))
    canvas.save(here / f"materials-{scale}.png")
