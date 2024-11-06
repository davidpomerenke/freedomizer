from fastapi import FastAPI, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import fitz  # PyMuPDF
from typing import Dict, List
import io

app = FastAPI()

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Adjust this in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.post("/analyze-pdf")
async def analyze_pdf(file: UploadFile) -> Dict:
    if not file.filename.endswith(".pdf"):
        raise HTTPException(status_code=400, detail="File must be a PDF")

    try:
        # Read the uploaded file into memory
        contents = await file.read()
        pdf_stream = io.BytesIO(contents)

        # Open the PDF with PyMuPDF
        doc = fitz.open(stream=pdf_stream, filetype="pdf")

        # Analyze PDF structure
        structure = {
            "filename": file.filename,
            "page_count": len(doc),
            "metadata": doc.metadata,
            "pages": [],
        }

        # Analyze each page
        for page_num in range(len(doc)):
            page = doc[page_num]
            page_info = {
                "page_number": page_num + 1,
                "width": page.rect.width,
                "height": page.rect.height,
                "rotation": page.rotation,
                "text_length": len(page.get_text()),
                "image_count": len(page.get_images()),
            }
            structure["pages"].append(page_info)

        doc.close()
        return structure

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error processing PDF: {str(e)}")


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
