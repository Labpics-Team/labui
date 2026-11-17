#!/usr/bin/env python3
"""Use one exact successful native Colors CI artifact until its public release is available."""
import hashlib
import json
import os
from pathlib import Path
import sys
import zipfile

kind = sys.argv[1]
directory = Path(sys.argv[2]).resolve()
manifest_name = "swift" if kind == "apple" else kind
manifest = json.loads((directory / f"{manifest_name}-release-manifest.json").read_text())
if manifest["sourceCommit"] != os.environ["COLORS_SOURCE"]:
    raise ValueError("Colors artifact source does not match the selected CI revision")
archive = directory / manifest["archive"]
if hashlib.sha256(archive.read_bytes()).hexdigest() != manifest["archiveSha256"]:
    raise ValueError("Colors artifact checksum mismatch")
values = {}
if kind == "apple":
    values["COLORS_SWIFT_ARCHIVE"] = str(archive)
else:
    destination = directory / "sdk"
    with zipfile.ZipFile(archive) as package:
        for entry in package.infolist():
            if not (destination / entry.filename).resolve().is_relative_to(destination):
                raise ValueError("Colors archive path escapes its package")
        package.extractall(destination)
    repositories = list(destination.glob("*/repository"))
    if len(repositories) != 1:
        raise ValueError("Expected one Colors Maven repository")
    values["ORG_GRADLE_PROJECT_colorsRepository"] = repositories[0].as_uri()
    values["ORG_GRADLE_PROJECT_colorsVersion"] = manifest["version"]
with open(os.environ["GITHUB_ENV"], "a", encoding="utf-8") as environment:
    for key, value in values.items():
        environment.write(f"{key}={value}\n")
print(f"Prepared {kind} Colors from {manifest['sourceCommit']}")
