from fastapi import FastAPI, Response, UploadFile, HTTPException, File, Form
from fastapi.middleware.cors import CORSMiddleware
import pymupdf
import io
import json

app = FastAPI()

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Adjust this in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

search_text = "BMZ"


@app.post("/analyze-pdf")
async def analyze_pdf(file: UploadFile):
    if not file.filename.endswith(".pdf"):
        raise HTTPException(status_code=400, detail="File must be a PDF")

    try:
        contents = await file.read()
        pdf_stream = io.BytesIO(contents)
        doc = pymupdf.open(stream=pdf_stream, filetype="pdf")

        results = {}
        for page_num, page in enumerate(doc, 1):
            matches = page.search_for(search_text)
            if matches:
                # Get page dimensions
                page_rect = page.rect
                results[str(page_num)] = [
                    {
                        "x0": rect[0],
                        "y0": rect[1],
                        "x1": rect[2],
                        "y1": rect[3],
                        "page_width": page_rect.width,
                        "page_height": page_rect.height,
                        "text": search_text,
                    }
                    for rect in matches
                ]

        doc.close()
        return results

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error processing PDF: {str(e)}")


@app.post("/save-annotations")
async def save_annotations(
    file: UploadFile = File(...),
    annotations: str = Form(...),
):
    if not file.filename.endswith(".pdf"):
        raise HTTPException(status_code=400, detail="File must be a PDF")

    # Parse the annotations JSON string
    highlights = json.loads(annotations)

    # Read the PDF file
    contents = await file.read()
    pdf_stream = io.BytesIO(contents)
    doc = pymupdf.open(stream=pdf_stream, filetype="pdf")

    # Process each highlight as a redaction
    for highlight in highlights:
        page = doc[highlight["position"]["pageNumber"] - 1]  # 0-based index
        rect = highlight["position"]["boundingRect"]

        # Create redaction annotation
        page.add_redact_annot(
            quad=[rect["x1"], rect["y1"], rect["x2"], rect["y2"]], fill=(1, 0.41, 0.71)
        )

        # Apply the redaction
        page.apply_redactions()

    # Save the redacted PDF
    output = io.BytesIO()
    doc.save(output)
    doc.close()

    # Create a safe filename by removing problematic characters
    safe_filename = "".join(
        c for c in file.filename if c.isalnum() or c in ("-", "_", ".")
    )

    return Response(
        content=output.getvalue(),
        media_type="application/pdf",
        headers={
            "Content-Disposition": f"attachment; filename=redacted_{safe_filename}"
        },
    )


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
