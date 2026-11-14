#!/usr/bin/env python3
"""Unified static verification entry point for the Chrome MV3 adaptation.

Run: python3 tools/test_mv3_static.py

This is a development self-check only. It does not load a Chrome browser,
exercise a save, or produce Chrome QA / Owner acceptance evidence.
"""

import json
import subprocess
import sys
import tempfile
import unittest
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


class ChromeMV3StaticTests(unittest.TestCase):
    def test_manifest_v3(self):
        manifest = json.loads((ROOT / "manifest.json").read_text(encoding="utf-8"))
        self.assertEqual(manifest["manifest_version"], 3)
        self.assertEqual(manifest["background"]["service_worker"], "sw.js")
        self.assertIn("offscreen", manifest["permissions"])
        self.assertIn("scripting", manifest["permissions"])
        self.assertIn("<all_urls>", manifest["host_permissions"])
        self.assertNotIn("browser_specific_settings", manifest)

    def test_mv3_static_check(self):
        result = subprocess.run(
            ["node", "tools/check-chrome-mv3.mjs"], cwd=ROOT,
            capture_output=True, text=True
        )
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)

    def test_bridge_protocol(self):
        result = subprocess.run(
            ["node", "tools/test-mv3-bridge.cjs"], cwd=ROOT,
            capture_output=True, text=True
        )
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)

    def test_picker_arrow_keys(self):
        result = subprocess.run(
            ["node", "tools/test-picker-keys.cjs"], cwd=ROOT,
            capture_output=True, text=True
        )
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertIn("16 assertions passed", result.stdout)

    def test_inherited_node_tests(self):
        result = subprocess.run(
            ["node", "--test", "tools/test-destinations.cjs",
             "tools/test-filename-rules.cjs", "tools/test-i18n.cjs"],
            cwd=ROOT, capture_output=True, text=True
        )
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertIn("# fail 0", result.stdout)

    def test_chrome_package_builds(self):
        with tempfile.TemporaryDirectory() as tmp:
            out = Path(tmp) / "mind-clipper-chrome.zip"
            result = subprocess.run(
                [sys.executable, "tools/package-chrome.py", "--output", str(out)],
                cwd=ROOT, capture_output=True, text=True
            )
            self.assertEqual(result.returncode, 0, result.stderr)
            with zipfile.ZipFile(out) as archive:
                names = set(archive.namelist())
            for required in ("manifest.json", "sw.js", "offscreen.html",
                             "offscreen.js", "lib/browser-shim.js", "lib/sw-api-bridge.js"):
                self.assertIn(required, names)

    def test_chrome_has_no_native_messaging(self):
        # The Chrome build must not request nativeMessaging: there is no bundled
        # native helper and no host to register.
        manifest = json.loads((ROOT / "manifest.json").read_text(encoding="utf-8"))
        self.assertNotIn("nativeMessaging", manifest.get("permissions", []))


if __name__ == "__main__":
    unittest.main(verbosity=2)
