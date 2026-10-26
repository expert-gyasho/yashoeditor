# yashoeditor

A static, browser-based photo/PDF OCR page that creates a Word document. Files are processed in the browser; Tesseract.js and PDF.js are loaded from public CDNs.

## Use

Open `index.html` in a modern browser with an internet connection. Add one or more JPG, PNG, or PDF files, or take a photo using the camera button. Before OCR, the page now upscales small scans and compares the original with a grayscale, contrast-adjusted copy. It uses automatic page layout detection for mixed or full-page text. Review and correct the OCR result before downloading the `.docx` file. The OCR supports printed Hindi and English; English text is left as English. Handwriting and blurry, angled, or very small text can still be misread.

The DOCX assigns Hindi text to the legacy **Kruti Dev 010** font and English text to Arial. A computer needs Kruti Dev 010 installed to display that legacy encoding as Hindi. OCR can misread text, and complex Hindi conjuncts may need correction after conversion, so review the Word file before using it.

## Publish with GitHub Pages

1. Create a new public repository named `yashoeditor` in your GitHub account.
2. Upload the contents of this folder to the repository root.
3. In the repository settings, enable Pages with **GitHub Actions** as the source. The included workflow publishes every push to `main`.

After the first successful workflow run, the page will be available at `https://YOUR-USERNAME.github.io/yashoeditor/`.

