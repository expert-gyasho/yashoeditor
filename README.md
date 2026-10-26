# YashoEditor

YashoEditor reads text from photos or PDFs and exports an editable Word document. The published page is https://expert-gyasho.github.io/yashoeditor/.

## Use

Open the page in a modern browser with an internet connection. Choose or photograph one or more JPG, PNG, or PDF files. The visible file order is the Word order; use the up/down arrows to rearrange files. All selected pages are read in sequence and combined into one `.docx` download.

Before OCR, the browser enlarges the image and creates contrast-adjusted, global-threshold, and shadow-corrected versions. It compares OCR results and keeps the strongest result. Files are processed in the browser and are not sent to an OCR service. OCR libraries and language models load from public CDNs.

The OCR handles printed Hindi and English more reliably than handwriting. Handwritten Devanagari can still be misread and may need manual correction in the editable text box. English text remains English.

The Word file uses **Kruti Dev 010** for Hindi and Arial for English. Kruti Dev 010 must be installed on the computer to display the legacy Hindi encoding correctly.

## GitHub Pages

The source repository is https://github.com/expert-gyasho/yashoeditor. GitHub Actions deploys updates pushed to `main`.

