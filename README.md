# ECTS Career Portfolio Creator

A framework-free first version of a student career portfolio builder for the ECTS Programming program.

## Run locally

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

Uploaded files are limited to 5 MB and are read locally for backup/restore. The browser's print dialog is used for PDF export.
