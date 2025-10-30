#!/usr/bin/env python3
"""Create a zipped offline bundle of the Notion pet project.

This script collects the HTML, CSS, JavaScript, asset, and font files into a
single ZIP archive so it can be distributed as a standalone bundle. The output
is written to ``dist/notion-pet-offline.zip`` by default.
"""
from __future__ import annotations

import argparse
from pathlib import Path
import zipfile

# Files and directories that must be present in the offline bundle.
ROOT_FILES = ["index.html", "style.css", "script.js"]
ROOT_DIRECTORIES = ["assets", "fonts"]


def add_path_to_zip(zip_file: zipfile.ZipFile, base_path: Path, target: Path) -> None:
    """Write ``target`` into ``zip_file`` preserving relative paths.

    Args:
        zip_file: The open :class:`zipfile.ZipFile` instance to write to.
        base_path: The repository root that should be considered ``/`` inside
            the archive. Every archive entry will be relative to this path.
        target: The file or directory that should be added to the archive.
    """
    relative = target.relative_to(base_path)

    if target.is_dir():
        # Ensure directory entries exist in the archive so empty directories are
        # preserved if they ever appear.
        if str(relative):
            zip_file.writestr(str(relative) + "/", "")
        for child in sorted(target.iterdir()):
            add_path_to_zip(zip_file, base_path, child)
    elif target.is_file():
        zip_file.write(target, arcname=str(relative))
    else:
        raise FileNotFoundError(f"Unsupported path type: {target}")


def build_bundle(root: Path, output: Path) -> None:
    """Create the offline ZIP bundle.

    Args:
        root: Repository root containing the project files.
        output: Destination path for the generated ZIP archive.
    """
    if not root.exists():
        raise FileNotFoundError(f"Repository root does not exist: {root}")

    with zipfile.ZipFile(output, "w", compression=zipfile.ZIP_DEFLATED) as bundle:
        for filename in ROOT_FILES:
            path = root / filename
            if not path.is_file():
                raise FileNotFoundError(f"Required file missing: {filename}")
            add_path_to_zip(bundle, root, path)

        for dirname in ROOT_DIRECTORIES:
            path = root / dirname
            if not path.is_dir():
                raise FileNotFoundError(f"Required directory missing: {dirname}")
            add_path_to_zip(bundle, root, path)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Create an offline bundle of the Notion pet project.")
    parser.add_argument(
        "--output",
        "-o",
        default=Path("dist/notion-pet-offline.zip"),
        type=Path,
        help="Destination path for the ZIP archive. (default: dist/notion-pet-offline.zip)",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    repo_root = Path(__file__).resolve().parent
    output_path = args.output

    if not output_path.is_absolute():
        output_path = repo_root / output_path

    output_path.parent.mkdir(parents=True, exist_ok=True)

    build_bundle(repo_root, output_path)
    print(f"Offline bundle created at: {output_path}")


if __name__ == "__main__":
    main()
