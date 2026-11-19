"""Verify actual screenshot pixels after capture.mjs, not just decoded source images."""
from pathlib import Path
import json
import sys
import hashlib
from PIL import Image

root = Path(sys.argv[1])
manifest = root / "installed-materials.json"
cases = json.loads(manifest.read_text(encoding="utf-8"))
files = [(root / file).resolve() for case in cases for file in case["files"]]
assert len(files) == len(set(files)), "A retained screenshot must have one capture record"
actual = {path.resolve() for directory in {path.parent for path in files}
          for path in directory.glob("installed-*.png")}
assert actual == set(files), {
    "unverified": sorted(str(path) for path in actual - set(files)),
    "missing": sorted(str(path) for path in set(files) - actual),
}
for case in cases:
    density = case["density"]
    case["screenshots"] = []
    for file in case["files"]:
        path = root / file
        image = Image.open(path).convert("RGB")
        counts = []
        for material in case["materials"]:
            box = material["box"]
            x, y, width, height = (box[key] for key in ("x", "y", "width", "height"))
            bounds = tuple(round(value * density) for value in (
                x + width / 4, y + height / 4, x + width * 3 / 4, y + height * 3 / 4,
            ))
            assert 0 <= bounds[0] < bounds[2] <= image.width
            assert 0 <= bounds[1] < bounds[3] <= image.height
            count = len(set(image.crop(bounds).get_flattened_data()))
            assert count > 100, (file, box, count)
            counts.append(count)
        case["screenshots"].append({"file": file, "minimumDistinctRgb": min(counts),
            "sha256": hashlib.sha256(path.read_bytes()).hexdigest()})
manifest.write_text(json.dumps(cases, indent=2) + "\n", encoding="utf-8", newline="\n")
print(f"Verified {len(files)} retained PNGs and "
      f"{sum(len(case['materials']) * len(case['files']) for case in cases)} painted Avatar materials")
