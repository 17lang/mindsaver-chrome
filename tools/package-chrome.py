"""Reproducible Chrome MV3 package for Mind Clipper.

Builds the extension ZIP submitted to the Chrome Web Store. Output is
deterministic (fixed file order and timestamps).

Run: python3 tools/package-chrome.py --output dist/mind-clipper-chrome.zip
"""

import argparse
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

ROOT_FILES = [
    "manifest.json",
    "sw.js",
    "offscreen.html",
    "offscreen.js",
    "background.js",
    "i18n.js",
    "LICENSE",
    "PRIVACY.md",
    "THIRD_PARTY_NOTICES.md",
]
DIRS = ["lib", "content", "popup", "icons", "options", "_locales", "licenses"]
# lib/html-to-image.js is the unmodified upstream original kept only for
# provenance; the runtime uses lib/html-to-image.iife.js.
EXCLUDED = {"lib/html-to-image.js", "icons/old/icon48.png", "icons/old/icon96.png", "icons/old/icon128.png"}


def runtime_files():
    files = [ROOT / name for name in ROOT_FILES]
    for name in DIRS:
        files.extend(p for p in (ROOT / name).rglob("*") if p.is_file())
    return sorted(
        p for p in files
        if p.name != ".DS_Store" and p.relative_to(ROOT).as_posix() not in EXCLUDED
    )


def build(output):
    output = Path(output)
    output.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(output, "w", zipfile.ZIP_DEFLATED) as archive:
        for file in runtime_files():
            entry = zipfile.ZipInfo(file.relative_to(ROOT).as_posix(), (2026, 1, 1, 0, 0, 0))
            entry.compress_type = zipfile.ZIP_DEFLATED
            entry.external_attr = 0o100644 << 16
            archive.writestr(entry, file.read_bytes())
    return output, len(runtime_files())


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", default="dist/mind-clipper-chrome.zip")
    args = parser.parse_args()
    path, count = build(args.output)
    print(f"{path} ({count} files)")
