#!/usr/bin/env python3
"""Prepare an Xcode project using a self-contained Lab Colors SwiftPM archive."""
import argparse
import hashlib
import os
from pathlib import Path
import subprocess
import zipfile


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--colors-archive", type=Path, required=True)
    args = parser.parse_args()
    archive = args.colors_archive.resolve(strict=True)
    digest = hashlib.sha256(archive.read_bytes()).hexdigest()
    ios = Path(__file__).resolve().parent
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
    environment = dict(os.environ, LAB_COLORS_PACKAGE=str(colors))
    subprocess.run(["xcodegen", "generate", "--spec", str(ios / "project.yml")],
                   cwd=ios, env=environment, check=True)


if __name__ == "__main__":
    main()
