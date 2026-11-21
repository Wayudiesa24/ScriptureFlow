# ScriptureFlow — Bible Reader, Audio & Study (Android)

One integrated Bible study companion built from the uploaded `PassageReader.jsx`.

## Included

- Complete World English Bible Updated (WEBU) **offline**, downloaded and bundled during the GitHub Actions build (66 books / 31,098 verses); public domain.
- Book and chapter navigation, configurable font size, dark mode.
- Verse-by-verse device text-to-speech: voice selection, speed control, pause/stop, current-verse highlight, optional next-chapter reading.
- Bookmarks, verse highlights, private journal notes stored locally; export/import backup.
- Search within the offline Bible, curated cross-references, share verses, and compare individual verses online with KJV, ASV or WEB.
- A 30-day reading plan with progress tracking.
- Optional Gemini-powered Bible exploration using a session-only user-provided API key. No API key is baked in or permanently stored.

## Make the APK on GitHub (recommended)

1. Create an empty GitHub repository (e.g. `Wayudiesa24/ScriptureFlow`).
2. Upload **all files and folders** from this project to the repository root, including `.github/workflows/android-apk.yml`. (Do not upload only the ZIP.)
3. On GitHub, open **Actions → Android APK (debug) → Run workflow**, or push to `main`.
4. When the build succeeds, open the workflow run → **Artifacts → ScriptureFlow-debug-apk**.
5. Extract the ZIP and install `app-debug.apk` on your Android device.

This produces a **debug APK** for personal testing, not a Play Store-ready release. Android 7+ (Capacitor 8 minimum API 24). You may need to permit installation from your browser/files app.

## Desktop preview

Requires Node 22+:

```bash
npm install
npm test
npm run bible:prepare  # gets all 66 books; needs internet
npm run dev
```

If you omit `bible:prepare` in a desktop preview, individual chapters are fetched and cached from bible-api.com when online. Search of unbundled books will not work until the full Bible is prepared.

## Android development

```bash
npm install
npm run bible:prepare
npm run build
npx cap add android
npx cap sync android
npx cap open android
```

## Speech and background limitations

The original browser Web Speech engine is retained for the web preview. Installed Android APKs use `@capacitor-community/text-to-speech`, which leverages Android's speech engine and supports selected installed voices and verse-by-verse highlighting. **Uninterrupted narration with the screen locked is not guaranteed** in this version because it does not yet implement an Android foreground media service. Install offline voices in Android text-to-speech settings for offline listening. The listen button and controls work in the foreground.

## AI privacy and expectations

For AI study, supply your own Gemini API key under Settings. The key is **only in RAM**, never placed in source, localStorage or backups, and will be cleared when the app is restarted. Calls go directly from the app to Google, so don't use a high-privilege shared key; API billing or quotas may apply. AI output is fallible and is clearly marked as an interpretation rather than a Bible translation.

## Source and license

- `reference/PassageReader.original.jsx` is an unmodified archival copy of the user's original code.
- `src/components/PassageReader.jsx` is its extended, actively used component.
- Bible text WEBU CC0: https://github.com/ringletech/webu-open-bible ; maintained by https://ebible.org/ .
- Online chapter fallback WEB: https://bible-api.com/ .
- App source intended for personal use; external dependencies have their own licences.
