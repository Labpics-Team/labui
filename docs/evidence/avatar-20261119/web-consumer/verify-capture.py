"""Verify actual screenshot pixels after capture.mjs, not just decoded source images."""
from pathlib import Path
import json
import sys
from PIL import Image

root = Path(sys.argv[1])
manifest = root / "installed-materials.json"
cases = json.loads(manifest.read_text())
for case in cases:
    image = Image.open(root / case["file"]).convert("RGB")
    density = case["density"]
    counts = []
    for material in case["materials"]:
        box = material["box"]
        x, y, width, height = (box[key] for key in ("x", "y", "width", "height"))
        crop = image.crop(tuple(round(value * density) for value in (
            x + width / 4, y + height / 4, x + width * 3 / 4, y + height * 3 / 4,
        )))
        count = len(set(crop.get_flattened_data()))
        assert count > 100, (case["file"], box, count)
        counts.append(count)
    case["screenshotMinimumDistinctRgb"] = min(counts)
manifest.write_text(json.dumps(cases, indent=2) + "\n")
print(f"Verified {sum(len(case['materials']) for case in cases)} painted Avatar materials")
