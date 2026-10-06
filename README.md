# ECTS Career Portfolio Creator

A standalone Electron desktop app for creating ECTS career portfolios.

## Run the desktop app

```powershell
npm install
npm start
```

To package a portable Windows executable:

```powershell
npm run package
```

Portfolio data is saved in Electron's application-data folder. Uploaded documents are saved there as individual files.

Use **Save Portfolio** to create a `.ects-portfolio` ZIP file. It includes `portfolio.json`, a `manifest.json` relating attachments to the portfolio, and the attachment files. Use **Open Portfolio** to load one. The app asks before replacing a named portfolio.

## Portfolio contents

- Guided setup and ECTS program selector
- About Me, hiring documents, work samples, credentials, accomplishments, CareerSafe, supporting academics, and CEW evidence
- Local file attachments, listed in their portfolio section and in the preview; PDFs are shown inline in the preview
- Portable `.ects-portfolio` open and save workflow
- Theme and accent controls, live preview, and print to PDF
