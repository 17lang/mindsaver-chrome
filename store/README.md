# store/ — Chrome Web Store submission kit

Everything here is **draft material**, not a submitted listing. See the full checklist in [docs/CHROME-WEB-STORE.md](../docs/CHROME-WEB-STORE.md).

| File | Purpose |
| --- | --- |
| `listing.md` | Store name, short/detailed description (EN + 中文), category, single-purpose statement, reviewer notes |
| `permissions-and-data.md` | Per-permission justifications, remote-code declaration, data-use disclosure, privacy policy URL |
| `upload.py` | Chrome Web Store API v2 helper (upload / status / publish); credentials from env only, dry-run by default |
| `screenshots/` | Store screenshots — **still needed**, see the README inside |

## Getting the credentials (Owner-side, Google account)

1. Register at the [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole), pay the one-time **$5** fee, accept the agreements, and enable **2-Step Verification** on the Google account (mandatory for publishing).
2. In [Google Cloud Console](https://console.cloud.google.com/), create/select a project, enable the **Chrome Web Store API**, configure the OAuth consent screen (External; add your address as a test user).
3. Create an **OAuth client ID** of type *Web application*; add `https://developers.google.com/oauthplayground` as an authorized redirect URI.
4. In [OAuth 2.0 Playground](https://developers.google.com/oauthplayground), use your own credentials and the scope `https://www.googleapis.com/auth/chromewebstore`, authorize, then exchange the code for tokens. Keep the `refresh_token`.
5. Copy the **Publisher ID** from Dashboard → Publisher → Settings. Create the first item in the Dashboard by uploading `dist/mind-clipper-chrome.zip`; its **Item ID** is then available.
6. Complete the **Store listing** and **Privacy** tabs using `listing.md` and `permissions-and-data.md`. The API cannot publish a new item until both are complete.

```sh
export CWS_CLIENT_ID='...'
export CWS_CLIENT_SECRET='...'
export CWS_REFRESH_TOKEN='...'
export CWS_PUBLISHER_ID='...'
export CWS_ITEM_ID='...'

python3 store/upload.py --zip dist/mind-clipper-chrome.zip --upload --dry-run
python3 store/upload.py --zip dist/mind-clipper-chrome.zip --upload --execute
python3 store/upload.py --status --execute
python3 store/upload.py --publish --execute
```

Never commit credentials. `.gitignore` excludes `.env`, `store/.env`, `client_secret*.json`, `*.pem` and `*.crx`. The script prints only endpoint/package metadata, never credential values.

## Why `--publish` is gated

Publishing submits the extension to Google's review queue and is not reversible from the API side (you can cancel a submission, but the action itself is visible to the account). The script defaults to a dry run and requires both `--execute` and the explicit `--publish` flag.
