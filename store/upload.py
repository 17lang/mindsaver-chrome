#!/usr/bin/env python3
"""Chrome Web Store API helper for Mind Clipper.

Credentials are read ONLY from environment variables; nothing is written to
disk and no credential value is ever printed. The default mode is a dry run —
network calls happen only when --execute is passed explicitly.

Environment variables:
  CWS_CLIENT_ID, CWS_CLIENT_SECRET, CWS_REFRESH_TOKEN  (OAuth2, scope
      https://www.googleapis.com/auth/chromewebstore)
  CWS_PUBLISHER_ID   Developer Dashboard -> Publisher -> Settings
  CWS_ITEM_ID        Store item / extension ID (exists after the first
                     package is created in the Dashboard)

Official API: https://developer.chrome.com/docs/webstore/using-api
First-time items must be created in the Developer Dashboard and have their
Store listing + Privacy tabs completed before the API can publish them.
"""

import argparse
import json
import os
import pathlib
import sys
import urllib.error
import urllib.parse
import urllib.request

API = "https://chromewebstore.googleapis.com"
UPLOAD_API = "https://chromewebstore.googleapis.com/upload"
TOKEN_URL = "https://oauth2.googleapis.com/token"
LEGACY_CREATE = "https://www.googleapis.com/upload/chromewebstore/v1.1/items"


def getenv(name, required=True):
    value = os.environ.get(name, "").strip()
    if required and not value:
        sys.exit("Missing environment variable: " + name)
    return value


def access_token():
    data = urllib.parse.urlencode({
        "client_id": getenv("CWS_CLIENT_ID"),
        "client_secret": getenv("CWS_CLIENT_SECRET"),
        "refresh_token": getenv("CWS_REFRESH_TOKEN"),
        "grant_type": "refresh_token",
    }).encode()
    req = urllib.request.Request(TOKEN_URL, data=data, method="POST")
    req.add_header("Content-Type", "application/x-www-form-urlencoded")
    with urllib.request.urlopen(req, timeout=60) as res:
        payload = json.load(res)
    token = payload.get("access_token")
    if not token:
        sys.exit("Token response contained no access_token")
    return token


def call(method, url, token, body=None, content_type=None):
    req = urllib.request.Request(url, data=body, method=method)
    req.add_header("Authorization", "Bearer " + token)
    if content_type:
        req.add_header("Content-Type", content_type)
    if url.startswith("https://www.googleapis.com/"):
        req.add_header("x-goog-api-version", "2")
    try:
        with urllib.request.urlopen(req, timeout=180) as res:
            raw = res.read().decode("utf-8", "replace")
            return res.status, raw
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode("utf-8", "replace")


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--zip", type=pathlib.Path, help="extension package zip")
    ap.add_argument("--upload", action="store_true", help="upload a new package to an existing item")
    ap.add_argument("--create", action="store_true", help="create a brand-new item (legacy v1.1 API)")
    ap.add_argument("--status", action="store_true", help="fetch the item's upload/review status")
    ap.add_argument("--publish", action="store_true", help="submit for review (irreversible)")
    ap.add_argument("--execute", action="store_true", help="actually perform the request")
    ap.add_argument("--dry-run", action="store_true", help="print the plan only (default)")
    args = ap.parse_args()

    actions = [n for n in ("upload", "create", "status", "publish") if getattr(args, n)]
    if len(actions) != 1:
        ap.error("choose exactly one of --upload / --create / --status / --publish")
    action = actions[0]
    if action in ("upload", "create") and not args.zip:
        ap.error("--zip is required for upload/create")
    if args.zip and not args.zip.is_file():
        ap.error("package not found: " + str(args.zip))

    publisher = getenv("CWS_PUBLISHER_ID", required=action != "create")
    item = getenv("CWS_ITEM_ID", required=action != "create")
    base = f"{API}/v2/publishers/{publisher}/items/{item}"

    if action == "create":
        method, url = "POST", LEGACY_CREATE
    elif action == "upload":
        method, url = "POST", f"{UPLOAD_API}/v2/publishers/{publisher}/items/{item}:upload"
    elif action == "status":
        method, url = "GET", base + ":fetchStatus"
    else:
        method, url = "POST", base + ":publish"

    print(f"action      : {action}")
    print(f"endpoint    : {method} {url}")
    if args.zip:
        print(f"package     : {args.zip} ({args.zip.stat().st_size} bytes)")
    print("credentials : read from environment (values hidden)")
    print("mode        : " + ("EXECUTE" if args.execute and not args.dry_run else "DRY RUN"))

    if not args.execute or args.dry_run:
        print("\nDry run: nothing was sent. Add --execute to perform the request.")
        print("Before publishing, finish the Store listing and Privacy tabs in the")
        print("Developer Dashboard and confirm the manifest version was increased.")
        return 0

    # Validate credentials exist before any network call.
    for name in ("CWS_CLIENT_ID", "CWS_CLIENT_SECRET", "CWS_REFRESH_TOKEN"):
        getenv(name)
    token = access_token()
    body = args.zip.read_bytes() if args.zip else None
    ctype = "application/zip" if body is not None else None
    status, raw = call(method, url, token, body, ctype)
    print(f"\nHTTP {status}")
    print(raw[:4000])
    return 0 if 200 <= status < 300 else 1


if __name__ == "__main__":
    raise SystemExit(main())
