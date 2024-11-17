import io
import json
import os

import torch
from dotenv import load_dotenv
from fastapi import (
    APIRouter,
    FastAPI,
    File,
    Form,
    HTTPException,
    Response,
    Body,
    UploadFile,
)
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from transformers import pipeline
import pymupdf

pymupdf.TOOLS.set_small_glyph_heights(
    True
)  # does not have an impact here because the relevant processing part is in the frontend, but mupdf.js doesn't have this functionality :/
load_dotenv(override=True)


app = FastAPI()
api_router = APIRouter()

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def get_device():
    if torch.cuda.is_available():
        return 0  # CUDA GPU
    elif torch.backends.mps.is_available():
        return "mps"  # Apple Silicon GPU
    return -1  # CPU


ner_pipeline = pipeline(
    "ner",
    model="Davlan/bert-base-multilingual-cased-ner-hrl",
    device=get_device(),
)


@api_router.head("/health")
def health_check():
    return Response(status_code=200)


def fix_entity(entity):
    entity["score"] = float(entity["score"])
    return entity


@api_router.post("/analyze-text")
def analyze_text(text: str = Body(...)):
    entities = [fix_entity(entity) for entity in ner_pipeline(text)]
    response = dict(entities=entities)
    return response


@api_router.post("/save-with-redactions")
def save_with_redactions(
    file: UploadFile = File(...),
    annotations: str = Form(...),
):
    if not file.filename.endswith(".pdf"):
        raise HTTPException(status_code=400, detail="File must be a PDF")

    highlights = json.loads(annotations)
    contents = file.file.read()
    pdf_stream = io.BytesIO(contents)
    doc = pymupdf.open(stream=pdf_stream, filetype="pdf")

    # Process each highlight as a redaction
    for highlight in highlights:
        page = doc[highlight["position"]["pageNumber"] - 1]  # 0-based index
        rect = highlight["position"]["boundingRect"]

        # Create redaction annotation
        pink = (1, 0.41, 0.71)  # for more beautiful pink redactions set fill=pink
        page.add_redact_annot(quad=[rect["x1"], rect["y1"], rect["x2"], rect["y2"]])

    # Apply the redactions
    for page in doc:
        page.apply_redactions()
    # TODO consider document.scrub() instead (not available in frontend though)

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


# The API will be available at /api
app.include_router(api_router, prefix="/api")

# If the static directory exists, serve the frontend from there
if os.path.exists("static"):
    app.mount("/", StaticFiles(directory="static", html=True), name="static")

if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
