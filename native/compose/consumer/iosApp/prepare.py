#!/usr/bin/env python3
"""Prepare an Xcode project using a self-contained Lab Colors SwiftPM archive."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import tempfile
import urllib.request
import zipfile


def archive_digest(archive):
    digest = hashlib.sha256()
    with archive.open("rb") as source:
        while chunk := source.read(1024 * 1024):
            digest.update(chunk)
    return digest.hexdigest()


def colors_package(ios, archive=None):
    release = json.loads((ios.parent.parent / "colors-release.json").read_text(encoding="utf-8"))
    version = release["version"]
    if not re.fullmatch(r"[0-9]+\.[0-9]+\.[0-9]+-[0-9a-f]{40}", version):
        raise ValueError("Native Colors version must identify its source commit")
    core_version, source_commit = version.rsplit("-", 1)
    tag = f"colors-native-v{core_version}-{source_commit[:12]}"
    digest = release["swiftArchiveSha256"]
    if archive is None:
        archive = ios.parent / "build" / "apple-colors" / tag / "LabColors.swiftpm.zip"
        if not archive.is_file():
            archive.parent.mkdir(parents=True, exist_ok=True)
            url = f"https://github.com/{release['githubRepository']}/releases/download/{tag}/{archive.name}"
            temporary = None
            try:
                with tempfile.NamedTemporaryFile(dir=archive.parent, delete=False) as output:
                    temporary = Path(output.name)
                    with urllib.request.urlopen(url, timeout=60) as response:
                        shutil.copyfileobj(response, output)
                if archive_digest(temporary) != digest:
                    raise ValueError("Published Colors archive checksum does not match the release pin")
                temporary.replace(archive)
            finally:
                if temporary is not None:
                    temporary.unlink(missing_ok=True)
    archive = archive.resolve(strict=True)
    if archive_digest(archive) != digest:
        raise ValueError("Colors archive checksum does not match the release pin")
    destination = (ios.parent / "build" / "apple-colors" / digest).resolve()
    with zipfile.ZipFile(archive) as package:
        for entry in package.infolist():
            target = (destination / entry.filename).resolve()
            if not target.is_relative_to(destination):
                raise ValueError("Colors archive contains a path outside its package")
        package.extractall(destination)
    colors = destination / "LabColors"
    if not (colors / "Package.swift").is_file():
        raise ValueError("Expected a self-contained LabColors SwiftPM package")
    return colors


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--colors-archive", type=Path,
                        help="Use an already downloaded archive of the pinned public release")
    args = parser.parse_args()
    ios = Path(__file__).resolve().parent
    colors = colors_package(ios, args.colors_archive)
    environment = dict(os.environ, LAB_COLORS_PACKAGE=str(colors))
    subprocess.run(["xcodegen", "generate", "--spec", str(ios / "project.yml")],
                   cwd=ios, env=environment, check=True)


if __name__ == "__main__":
    main()
