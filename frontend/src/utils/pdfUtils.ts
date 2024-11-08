import { Document, PDFDocument, PDFPage } from 'mupdf';

export async function saveAnnotations(file: File, highlights: Array<any>) {
  // Read the PDF file as ArrayBuffer
  const fileBuffer = await file.arrayBuffer();
  
  // Load the document
  const doc = PDFDocument.openDocument(new Uint8Array(fileBuffer), 'pdf') as PDFDocument
  
  // Process each highlight as a redaction
  for (const highlight of highlights) {
    const pageNumber = highlight.position.pageNumber - 1; // 0-based index
    const page = doc.loadPage(pageNumber);
    const rect = highlight.position.boundingRect;
    
    // Create redaction annotation
    const annotation = page.createAnnotation('Redact')
    annotation.setRect(rect)
    annotation.setColor([1, 0.41, 0.71]) // Pink color
    
    // Apply the redaction
    page.applyRedactions();
  }
  
  // Save the redacted PDF
  const output = doc.saveToBuffer()
  
  // Create blob and download
  const blob = new Blob([output.asUint8Array()], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = `redacted_${file.name}`;
  document.body.appendChild(a);
  a.click();
  
  // Cleanup
  URL.revokeObjectURL(url);
  document.body.removeChild(a);
  doc.destroy();
} 