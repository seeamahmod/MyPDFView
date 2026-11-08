# MyPDF View

A PDF reader and editor for Android, built with React Native (Expo SDK 58) from the **MyPDF View** Figma design system.

## Features

- **All PDFs on your phone**: after you allow file access once (Android 11+: “Allow access to manage all files”), every PDF on the device appears in Home automatically — no importing. The list stays in sync (pull to refresh), and rename, delete and Save act on the real files.
- **Library**: import PDFs (single or multiple), grid/list views, filter by source (Documents, Downloads, WhatsApp, Email), sort by date, name or size, search by name, plus Files / Recent / Starred tabs.
- **File actions**: open, edit, share, star, rename (with validation), duplicate, file info and delete (with confirmation).
- **Viewer**: smooth page rendering (pdf.js, fully offline), pinch-zoom and zoom controls, page indicator, search inside the document, bookmarks, go to page, fit to width, night reading, page thumbnails, and resuming on the last page you read.
- **Highlight mode**: tap any line of text to highlight it in one of five colors (tap again to remove), with undo/redo.
- **Editor**: Edit (retype a line of text), Text (add text boxes with color, bold, italic and size), Draw (6 inks × 3 stroke sizes), Shapes (rectangle, ellipse, line, arrow) and Erase (tap to erase, or clear all), with undo/redo. **Save** writes changes into the PDF; **Save as copy** keeps the original.
- **Export**: PDF (with or without highlights, page ranges, optional compression), PNG or JPG per page (a single page is shared; multiple pages are saved to Gallery › MyPDF View), and plain text.
- **Android integration**: appears in "Open with" for PDFs, and accepts PDFs shared from other apps.
- **Light and dark themes**, using the design tokens from Figma (charcoal `#2A2A2A` brand on a ghost-white canvas).

## Project structure

```
src/
  app/                 Expo Router screens
    index.tsx          Home (library)
    viewer/[id].tsx    PDF viewer, highlight mode, export
    editor/[id].tsx    PDF editor + Editor Dock
    incoming.tsx       Handles "Open with" and shared PDFs
  components/          Design-system components (Button, Chip, InputField, ListItem, BottomSheet, …)
  pdf/                 pdf.js WebView engine, viewer bridge, pdf-lib annotation flattening, export
  store/library.tsx    Library: imported copies + PDFs found on the phone, thumbnails and metadata
  theme/               Design tokens (colors light/dark, spacing, radius, type, shadows)
scripts/build-pdfjs.mjs  Inlines pdf.js for offline use (runs on npm install)
modules/device-pdfs/   Local Expo native module (Kotlin): All files access, MediaStore PDF scan, file rename/delete/overwrite
```

## Develop

Requirements: Node 20+, the Android SDK, and a JDK (Android Studio's bundled JBR works).

```bash
npm install
npx expo run:android      # builds a dev client and runs it on a device or emulator
```

## Build an installable APK

```bash
npx expo prebuild --platform android
cd android
./gradlew assembleRelease -PreactNativeArchitectures=arm64-v8a,armeabi-v7a
```

On Windows, the Android SDK's bundled ninja 1.10 can fail with “Filename longer than 260 characters”. Download ninja 1.12+ and pass it in: `-PninjaPath=C:/path/to/ninja.exe` (or set `NINJA_PATH`).

The APK is written to `android/app/build/outputs/apk/release/app-release.apk`. Copy it to your phone and open it to install (allow "Install unknown apps" for your file manager).

> The release build is signed with the default debug keystore, which is fine for personal installs. Create your own upload key before publishing to Google Play.

## App icon and logo

Replace the files in `assets/` (`icon.png`, `android-icon-foreground.png`, `android-icon-background.png`, `android-icon-monochrome.png`), then run `npx expo prebuild --platform android --clean` and rebuild.

## Notes

- Seeing every PDF on the phone needs the **All files access** permission. That's fine for personal installs; Google Play only allows it for certain app types, so a Play release may need a different approach.

- **Edit** works by covering the original line and drawing the new text on top (true in-place PDF text editing isn't possible in general). Text saved into PDFs uses Helvetica, so characters outside Latin-1 are replaced with `?`.
- **Word export** is shown as "Coming soon".
