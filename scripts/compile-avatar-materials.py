"""Compile immutable Figma material layers into shared, offline Avatar resources.

Install scripts/requirements-avatar.txt, then run this file. No Figma access or
runtime image processing is needed. Palette variants follow components.json and
the Colors profile; source.json records the independently exported source layers.
"""
from pathlib import Path
import hashlib
import io
import json
import sys

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "assets/avatar"
source = json.loads((ASSETS / "source.json").read_text())
profile = json.loads((ROOT / "packages/tokens/src/components.json").read_text())["avatar"]
palette = json.loads((ROOT / "packages/colors/labui.config.json").read_text())["anchors"]
check = "--check" in sys.argv
outputs = {}


def emit(path, data):
    outputs[ROOT / path] = data.encode() if isinstance(data, str) else data


def read_layer(name):
    info = source["layers"][name]
    data = (ASSETS / info["file"]).read_bytes()
    if hashlib.sha256(data).hexdigest() != info["sha256"]:
        raise ValueError(f"Changed source layer: {name}")
    return np.asarray(Image.open(io.BytesIO(data)).convert("RGBA"), dtype=np.float64) / 255


def luminosity(rgb):
    return rgb @ np.array([0.30, 0.59, 0.11])


def color_blend(tint, lightness):
    """W3C Color = SetLum(Cs, Lum(Cb)), in sRGB (not WCAG luminance)."""
    rgb = np.broadcast_to(tint, lightness.shape + (3,)).copy()
    rgb += (lightness - luminosity(rgb))[..., None]
    low, high = rgb.min(-1), rgb.max(-1)
    under = low < 0
    rgb[under] = lightness[under, None] + (rgb[under] - lightness[under, None]) * (
        lightness[under, None] / (lightness[under, None] - low[under, None])
    )
    over = high > 1
    rgb[over] = lightness[over, None] + (rgb[over] - lightness[over, None]) * (
        (1 - lightness[over, None]) / (high[over, None] - lightness[over, None])
    )
    return rgb.clip(0, 1)


base, texture = read_layer("image"), read_layer("texture")
if base.shape != texture.shape or base.shape[:2] != (512, 512):
    raise ValueError("Source material layers must share a 512 × 512 crop")
dark = np.array(source["textureDark"]["normal"]) / 255
alpha = texture[..., 3:4]
# Source-over white + dark: premul C = A - Adark * (1 - dark).
# This recovers the actual dark texture coverage at the source resolution,
# including its grains and holes. No blur, fitted coefficient or new noise.
dark_coverage = (alpha * (1 - texture[..., :3]) / (1 - dark)).mean(-1, keepdims=True)
dark_coverage = np.minimum(alpha, dark_coverage.clip(0, 1))
variants = []
native_logical_pixels = max(size["diameter"] for size in profile["sizes"].values())
for mode, definition in source["modes"].items():
    texture_dark = np.array(source["textureDark"][definition["contrast"]]) / 255
    premultiplied = texture[..., :3] * alpha + (texture_dark - dark) * dark_coverage
    # The complete fallback is masked by the source image's circle, after paint.
    composite = premultiplied + base[..., :3] * (1 - alpha)
    lightness = luminosity(composite)
    for color, paint in profile["colors"].items():
        anchor = palette[paint["anchor"]]
        values = anchor.get("increased", anchor) if definition["contrast"] == "more" else anchor
        tint = values[definition["appearance"]]
        rgba = np.dstack([color_blend(np.array(tint) / 255, lightness), base[..., 3]])
        image = Image.fromarray(np.round(rgba * 255).astype(np.uint8)).resize(
            (source["outputPixels"],) * 2, Image.Resampling.LANCZOS
        )
        stem = f"{color}-{mode}"
        webp = io.BytesIO()
        image.save(webp, format="WEBP", lossless=True, quality=80, method=6, exact=True)
        if not np.array_equal(np.asarray(image), np.asarray(Image.open(io.BytesIO(webp.getvalue())))):
            raise ValueError("Lossless WebP changed decoded RGBA")
        web = f"assets/avatar/{stem}.webp"
        native = f"avatar_{stem.replace('-', '_')}.png"
        emit(f"packages/core/src/{web}", webp.getvalue())
        native_variants = []
        for qualifier, density in source["nativeDensities"].items():
            pixels = round(native_logical_pixels * density)
            native_image = image.resize((pixels, pixels), Image.Resampling.LANCZOS)
            png = io.BytesIO()
            native_image.save(png, format="PNG", optimize=True)
            resource = f"drawable{('-' + qualifier) if qualifier else ''}/{native}"
            emit(f"native/compose/src/commonMain/composeResources/{resource}", png.getvalue())
            native_variants.append({"resource": resource, "density": density, "pixels": pixels,
                "pngBytes": len(png.getvalue()), "decodedBytes": pixels * pixels * 4,
                "sha256": hashlib.sha256(png.getvalue()).hexdigest()})
        variants.append({"color": color, "mode": mode, "appearance": definition["appearance"],
            "contrast": definition["contrast"], "tint": tint, "kind": "offline-derived",
            "web": web, "native": native, "width": image.width, "height": image.height,
            "rgbaSha256": hashlib.sha256(image.tobytes()).hexdigest(),
            "webSha256": hashlib.sha256(webp.getvalue()).hexdigest(),
            "nativeVariants": native_variants,
            "webBytes": len(webp.getvalue()), "pngBytes": sum(v["pngBytes"] for v in native_variants),
            "decodedBytes": image.width * image.height * 4})

manifest = {"source": "source.json", "recipe": "source-over-texture-w3c-color-v1", "variants": variants}
emit("assets/avatar/manifest.generated.json", json.dumps(manifest, indent=2) + "\n")
def body(mode, indent="  "):
    return "\n".join(f'{indent}--lab-avatar-texture-{v["color"]}: url("./{v["web"]}");'
        for v in variants if v["mode"] == mode)

css = "/* Generated by scripts/compile-avatar-materials.py; immutable source layers, offline paint. */\n"
for color in profile["colors"]:
    # A typed URL computes against this stylesheet before inheritance. Untyped
    # custom-property URLs resolve at the consuming shadow/injected stylesheet,
    # which may have a different base URL in an installed application.
    css += (f'@property --lab-avatar-texture-{color} {{\n'
        '  syntax: "<url>";\n  inherits: true;\n  initial-value: url("data:,");\n}\n')
for mode, definition in source["modes"].items():
    selector = definition["selector"].replace(", ", ",\n")
    css += f'{selector} {{\n{body(mode)}\n}}\n'
    if definition["appearance"] == "dark":
        contrast = '[data-contrast="more"]' if definition["contrast"] == "more" else ''
        css += f'@media (prefers-color-scheme: dark) {{\n  :root{contrast}:not([data-theme="light"]):not([data-theme="dark"]) {{\n{body(mode, "    ")}\n  }}\n}}\n'
emit("packages/core/src/avatar-material.css", css)
kotlin = ["// Generated by scripts/compile-avatar-materials.py. Do not edit.", "package pics.lab.ui", "",
    "import org.jetbrains.compose.resources.DrawableResource", "import pics.lab.ui.resources.*", "",
    "internal fun avatarTextureResource(color: LabAvatarColor, preferences: LabPreferences): DrawableResource = when (color) {"]
for color in profile["colors"]:
    entries = {(v["appearance"], v["contrast"]): "Res.drawable." + v["native"][:-4] for v in variants if v["color"] == color}
    kotlin += [f"    LabAvatarColor.{color.capitalize()} -> when (preferences.appearance) {{",
        f'        LabAppearance.Light -> if (preferences.increasedContrast) {entries["light", "more"]} else {entries["light", "normal"]}',
        f'        LabAppearance.Dark -> if (preferences.increasedContrast) {entries["dark", "more"]} else {entries["dark", "normal"]}', "    }"]
kotlin += ["}", ""]
emit("native/compose/src/commonMain/kotlin/pics/lab/ui/LabAvatarMaterials.kt", "\n".join(kotlin))
changed = [str(path.relative_to(ROOT)) for path, data in outputs.items() if not path.exists() or path.read_bytes() != data]
if check:
    if changed:
        raise SystemExit("Stale Avatar material outputs:\n" + "\n".join(changed))
else:
    for path, data in outputs.items():
        if not path.exists() or path.read_bytes() != data:
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(data)
print(f"Avatar: {len(variants)} variants; WebP {sum(v['webBytes'] for v in variants):,} B; PNG {sum(v['pngBytes'] for v in variants):,} B; {len(changed)} changed files")
