import { PDFDocument } from '../node_modules/mupdf/dist/mupdf.js';

export async function saveAnnotations (file: File, highlights: Array<any>) {
    const fileBuffer = await file.arrayBuffer()
    const doc = new PDFDocument(fileBuffer)

    // Process each highlight as a redaction
    for (const highlight of highlights) {
      const pageNumber = highlight.position.pageNumber - 1 // 0-based index
      const page = doc.loadPage(pageNumber)
      const rect = highlight.position.boundingRect// attributes: x1, x2, y1, y2, height, width, pageNumber

      // Create redaction annotation
      const redaction = page.createAnnotation('Redact')
      redaction.setRect([rect.x1, rect.y1, rect.x2, rect.y2])
      // Create more colorful overlay (color does not work for redactions)
      const overlay = page.createAnnotation('Square')
      overlay.setRect([rect.x1, rect.y1, rect.x2, rect.y2])
      overlay.setInteriorColor([1, 0.41, 0.71]) // Pink color
      overlay.setBorderWidth(0)

      // Apply the redaction
      page.applyRedactions(0) // since we have our own overlays, we use 0 to remove the redacted content without adding black boxes
    }

    // Save the redacted PDF
    const output = doc.saveToBuffer()

    // Create blob and download
    const blob = new Blob([output.asUint8Array()], { type: 'application/pdf' })
    const url = URL.createObjectURL(blob)

    const a = document.createElement('a')
    a.href = url
    a.download = file.name.replace('.pdf', '_redacted.pdf')
    document.body.appendChild(a)
    a.click()

    // Cleanup
    URL.revokeObjectURL(url)
    document.body.removeChild(a)
    doc.destroy()
}
