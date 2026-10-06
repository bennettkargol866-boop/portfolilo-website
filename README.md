# ECTS Career Portfolio Creator

A static web application for creating ECTS career portfolios. It can also run as an Electron desktop app.

## Run in a browser locally

Because browser file storage requires a secure origin, use a local web server instead of opening `index.html` directly. With Python installed, run this from the project folder:

```powershell
python -m http.server 8000
```

Then visit <http://localhost:8000>.

## Portfolio privacy and files

The browser app saves portfolio data and uploaded files in IndexedDB on that device. The hosting service receives the static application files only; it does not receive portfolio content or attachments. Browser storage does not automatically transfer to another browser or device. Use **Save Portfolio** to download an `.ects-portfolio` ZIP containing `portfolio.json`, `manifest.json`, and the related attachments. Use **Open Portfolio** to restore it in another browser. Clearing browser site data can remove the local copy, so keep the portfolio file as a backup.

## Free hosting with GitHub Pages

This repository includes a GitHub Actions workflow that publishes the static app on pushes to `main`. In the GitHub repository, open **Settings → Pages** and select **GitHub Actions** as the source. The workflow publishes only `index.html`, `style.css`, `script.js`, and `browser-storage.js`.

## Electron desktop app

```powershell
npm install
npm start
```

To package a portable Windows executable:

```powershell
npm run package
```
