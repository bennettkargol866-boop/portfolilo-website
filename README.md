# ECTS Career Portfolio Creator

A framework-free first version of a student career portfolio builder for the ECTS Programming program.

## Desktop app (Electron)

The project can run as a standalone Windows desktop app. Its portfolio data is saved in Electron's local application-data folder instead of browser `localStorage`, so it is not subject to the app's former 5 MB upload check or browser storage quota.

```powershell
npm install
npm start
```

To create a portable Windows executable:

```powershell
npm run package
```

Use **Download backup** in the desktop app to create a compressed `.ectsportfolio` archive containing the portfolio and every attached document. Use **Load backup** to reopen it. Archive capacity is governed by available disk space and memory, not a 5 MB application rule.

## Browser version

Open `index.html` in a modern browser. No build step or server is required. For the smoothest browser behavior, serve the folder with any static server (for example, VS Code Live Server).

## Put it online

This is a static site and can be deployed directly to GitHub Pages, Netlify, Vercel, or any ordinary web host. Upload `index.html`, `style.css`, `script.js`, and `README.md` together; no build command or environment variables are required. Use HTTPS in production, especially if file storage is later moved to a backend.

## Included

- Guided setup and fake Demo Portfolio
- ECTS program selector covering 20 supplied pathways, including official program links
- Clear pathway outcomes: college credit, industry certification, and employment opportunities
- Board presentation mode with fictional sample data and outcome metrics
- About Me editor, repeatable work samples, accomplishments, credentials, recommendations, CareerSafe, supporting academics, and CEW Standards evidence
- Checklist and automatic required-section progress
- One canonical `Portfolio` object drives editing, checklist progress, preview, and export
- Local browser persistence with save status and reset confirmation
- Private JSON backup download/load workflow that includes attached file data and keeps student information off a server
- PDF uploads for supporting academic assignments and repeatable CareerSafe evidence entries
- Theme and accent controls
- Live portfolio preview and browser print / Save as PDF fallback
- Responsive mobile navigation and print stylesheet

## Privacy and limitations

The app stores the canonical portfolio object in `localStorage`; it does not upload personal information or files to a server. Students can use **Download backup** to create a private JSON file containing their portfolio and attached files, then use **Load backup** to continue on a later device or after clearing browser data. Keep that backup file private because it contains student information and documents. A future backend would be needed for accounts, durable school-managed recovery, shared access, and server-side PDF generation.

The browser fallback still uses browser storage and is best for small portfolios. The Electron desktop app removes the 5 MB file check and saves the complete portfolio to local application storage. The browser's print dialog is used for PDF export.
