import * as pdfjsLib from './node_modules/pdfjs-dist/build/pdf.mjs';

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('./node_modules/pdfjs-dist/build/pdf.worker.mjs', import.meta.url).href;

async function renderDocument({ bytes, fileName, fileType }, container) {
  container.replaceChildren();
  const extension = (fileName || '').split('.').pop().toLowerCase();
  const type = (fileType || '').toLowerCase();

  if (type.includes('pdf') || extension === 'pdf') {
    const pdf = await pdfjsLib.getDocument({ data: bytes }).promise;
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
      const page = await pdf.getPage(pageNumber);
      const baseViewport = page.getViewport({ scale: 1 });
      const width = Math.max(320, container.clientWidth || 720);
      const scale = width / baseViewport.width;
      const viewport = page.getViewport({ scale });
      const canvas = document.createElement('canvas');
      canvas.className = 'pdf-page';
      canvas.width = Math.ceil(viewport.width * devicePixelRatio);
      canvas.height = Math.ceil(viewport.height * devicePixelRatio);
      canvas.style.width = `${Math.ceil(viewport.width)}px`;
      canvas.style.height = `${Math.ceil(viewport.height)}px`;
      container.append(canvas);
      await page.render({ canvas, canvasContext: canvas.getContext('2d'), viewport, transform: [devicePixelRatio, 0, 0, devicePixelRatio, 0, 0] }).promise;
    }
    return;
  }

  if (extension === 'docx' || type.includes('wordprocessingml')) {
    if (!window.docx?.renderAsync) throw new Error('Word document preview could not be loaded.');
    await window.docx.renderAsync(bytes, container, container, { className: 'docx', inWrapper: true, breakPages: true, renderHeaders: true, renderFooters: true });
    return;
  }

  if (['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(extension) || type.startsWith('image/')) {
    const image = document.createElement('img');
    image.className = 'attachment-image';
    image.alt = fileName || 'Attached image';
    image.src = URL.createObjectURL(new Blob([bytes], { type: fileType || 'application/octet-stream' }));
    container.append(image);
    return;
  }

  if (extension === 'doc') throw new Error('Legacy .doc files cannot be previewed here. Save the document as .docx or PDF to see its pages in the preview.');
  throw new Error('Preview is available for PDF, DOCX, and image files.');
}

window.documentRenderer = { render: renderDocument };
