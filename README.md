# scrmoods (web / iPhone version)

The scrmoods mood tracker as an offline web app, mainly for iPhone. Same questions, custom tracking points and XML data format as the Android app, so you can export from one and import into the other.

## Publish it (once)

1. This repository must be **public** (GitHub Pages is free only for public repos). It contains only the app's code, never your data.
2. Settings → **Pages** → *Build and deployment* → **Deploy from a branch** → branch **main**, folder **/ (root)** → Save.
3. After a minute the app is live at **https://scroup.github.io/scrmoods-web/** (if you name the repo differently, the last part of the link changes to match).

## Install on the iPhone

Open the link in **Safari** → Share button → **Add to Home Screen**. It then opens full-screen from its own icon and works offline.

- Your data lives on the phone inside the home-screen app. Removing the app from the home screen deletes it, so use **Data → Export** (choose *Save to Files*) regularly.
- The home-screen app and a Safari tab keep separate data. Always use the home-screen icon.
- After you push changes, the app updates the next time it's opened (sometimes it takes two launches). When you change files, also bump `VERSION` in `sw.js`.

## Files

- `index.html`: the whole app
- `sw.js`: offline support
- `manifest.webmanifest`, `*.png`: app name and icons
- `.nojekyll`: tells GitHub Pages to serve the files as they are
