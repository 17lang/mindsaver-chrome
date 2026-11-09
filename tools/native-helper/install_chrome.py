#!/usr/bin/env python3
"""Register the Mind Clipper native save helper for Chrome / Chromium.

Standard library only. This installer is deliberately separate from the
inherited Go ``--install`` path:

* Chrome needs ``allowed_origins`` (chrome-extension://<id>/) and different
  NativeMessagingHosts directories, while Firefox/Zen need
  ``allowed_extensions``.
* Mind Clipper uses its own host name and its own install directory, so an
  existing Pagesaver tool registration, binary or user file is never touched.

The Go helper protocol itself is unchanged; this script only copies an already
built helper binary and writes the Chrome host manifest.

Usage:
    python3 install_chrome.py --extension-id <32-char id> --binary <path> [--dry-run]
"""

import argparse
import json
import os
import platform
import re
import shutil
import sys
import tempfile
from pathlib import Path

HOST_NAME = "app.mindclipper.save"
ID_PATTERN = re.compile(r"^[a-p]{32}$")


def install_root():
    home = Path.home()
    system = platform.system()
    if system == "Darwin":
        return home / "Library" / "Application Support" / "MindClipper"
    if system == "Windows":
        base = os.environ.get("LOCALAPPDATA") or str(home / "AppData" / "Local")
        return Path(base) / "MindClipper"
    return home / ".local" / "share" / "mindclipper"


def host_directories():
    home = Path.home()
    system = platform.system()
    if system == "Darwin":
        base = home / "Library" / "Application Support"
        return [
            base / "Google" / "Chrome" / "NativeMessagingHosts",
            base / "Google" / "ChromeForTesting" / "NativeMessagingHosts",
            base / "Chromium" / "NativeMessagingHosts",
        ]
    if system == "Linux":
        return [
            home / ".config" / "google-chrome" / "NativeMessagingHosts",
            home / ".config" / "google-chrome-for-testing" / "NativeMessagingHosts",
            home / ".config" / "chromium" / "NativeMessagingHosts",
        ]
    # Windows: the manifest can live anywhere; its path goes into the registry.
    return [install_root()]


def binary_name():
    return "mindclipper-save.exe" if platform.system() == "Windows" else "mindclipper-save"


def guard_existing(path, expected_binary):
    """Never overwrite a registration owned by another tool."""
    if not path.exists():
        return
    try:
        old = json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        raise RuntimeError("已有其他保存工具配置，未覆盖：" + str(path))
    if old.get("name") != HOST_NAME or old.get("path") != str(expected_binary):
        raise RuntimeError("已有其他保存工具配置，未覆盖：" + str(path))


def registry_register(manifest_path):
    if platform.system() != "Windows":
        return
    import winreg  # Windows only
    key_path = r"Software\Google\Chrome\NativeMessagingHosts" + "\\" + HOST_NAME
    with winreg.CreateKeyEx(winreg.HKEY_CURRENT_USER, key_path, 0, winreg.KEY_SET_VALUE) as key:
        winreg.SetValueEx(key, "", 0, winreg.REG_SZ, str(manifest_path))


def run(args):
    if not ID_PATTERN.match(args.extension_id):
        raise RuntimeError("扩展 ID 必须是 32 位 a-p 字符（chrome://extensions 中的 ID）")
    binary = Path(args.binary).expanduser().resolve()
    if not binary.is_file():
        raise RuntimeError("找不到已构建的本机工具：" + str(binary))

    root = install_root()
    dest = root / binary_name()
    directories = host_directories()
    for directory in directories:
        guard_existing(directory / (HOST_NAME + ".json"), dest)

    manifest = {
        "name": HOST_NAME,
        "description": "Mind Clipper local file writer",
        "path": str(dest),
        "type": "stdio",
        "allowed_origins": ["chrome-extension://" + args.extension_id + "/"],
    }
    text = json.dumps(manifest, ensure_ascii=False, indent=2) + "\n"

    print("Mind Clipper Chrome 本机工具登记")
    print("  扩展 ID   :", args.extension_id)
    print("  通道名    :", HOST_NAME)
    print("  二进制    :", binary, "->", dest)
    for directory in directories:
        print("  清单      :", directory / (HOST_NAME + ".json"))
    print("  allowed_origins:", manifest["allowed_origins"][0])

    if args.dry_run:
        print("\n[dry-run] 未写入任何文件。")
        print(text)
        return

    root.mkdir(parents=True, exist_ok=True, mode=0o700)
    if binary.resolve() != dest:
        fd, tmp = tempfile.mkstemp(prefix=".install-", dir=str(root))
        os.close(fd)
        try:
            shutil.copy2(binary, tmp)
            os.chmod(tmp, 0o755)
            os.replace(tmp, dest)
        finally:
            if os.path.exists(tmp):
                os.unlink(tmp)

    for directory in directories:
        directory.mkdir(parents=True, exist_ok=True)
        path = directory / (HOST_NAME + ".json")
        guard_existing(path, dest)
        path.write_text(text, encoding="utf-8")
        os.chmod(path, 0o600)
        registry_register(path)

    print("\n已登记。请在扩展设置中点击“检查连接”。")
    print("说明：Chrome 网上应用店签发的扩展 ID 可能与本地开发 ID 不同；")
    print("      发布后请用商店实际 ID 重新运行本脚本，不要沿用开发 ID。")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--extension-id", required=True, help="32 位 Chrome 扩展 ID")
    parser.add_argument("--binary", required=True, help="已构建的 Go 保存工具二进制")
    parser.add_argument("--dry-run", action="store_true", help="只打印计划，不写入")
    args = parser.parse_args()
    try:
        run(args)
    except Exception as e:
        print("安装失败：", e, file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
