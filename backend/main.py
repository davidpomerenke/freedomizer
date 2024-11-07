import asyncio
import io
import json
import os
from textwrap import dedent

import pymupdf
from dotenv import load_dotenv
from fastapi import FastAPI, File, Form, HTTPException, Response, UploadFile, APIRouter
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from litellm import acompletion

load_dotenv(override=True)

app = FastAPI()
api_router = APIRouter()

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3003", "http://127.0.0.1:3003"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

search_text = "BMZ"


async def process_page(page, page_num, prompt):
    # Extract text from the page
    page_text = page.get_text()

    # Query LLM for sensitive information
    full_prompt = dedent(f"""{prompt}
    Reply with a JSON array like this:
    {{"redactions": ["phrase1", "phrase2", "phrase3"]}}
    The array can be empty. The phrases must be exact matches. Do NOT wrap the JSON array in a code environment or any other text.
    
    Text to analyze:
                    
    {page_text}""")

    response = await acompletion(
        model="azure/gpt-4o-mini",
        messages=[{"role": "user", "content": full_prompt}],
        api_key=os.getenv("AZURE_OPENAI_API_KEY"),
        api_base=os.getenv("AZURE_OPENAI_API_BASE"),
        api_version=os.getenv("AZURE_OPENAI_API_VERSION"),
        response_format={"type": "json_object"},
        temperature=0,
    )

    # Parse response and search for each phrase
    sensitive_phrases = response.choices[0].message.content.strip()
    sensitive_phrases = json.loads(sensitive_phrases)["redactions"]
    print(sensitive_phrases)
    page_results = []

    for phrase in sensitive_phrases:
        phrase = phrase.strip()
        if phrase:  # Skip empty lines
            matches = page.search_for(phrase)
            if matches:
                page_rect = page.rect
                page_results.extend(
                    [
                        {
                            "x0": rect[0],
                            "y0": rect[1],
                            "x1": rect[2],
                            "y1": rect[3],
                            "page_width": page_rect.width,
                            "page_height": page_rect.height,
                            "text": phrase,
                        }
                        for rect in matches
                    ]
                )

    return str(page_num), page_results


@api_router.post("/analyze-pdf")
async def analyze_pdf(file: UploadFile, prompt: str = Form(...)):
    if not file.filename.endswith(".pdf"):
        raise HTTPException(status_code=400, detail="File must be a PDF")

    contents = await file.read()
    pdf_stream = io.BytesIO(contents)
    doc = pymupdf.open(stream=pdf_stream, filetype="pdf")

    # Create tasks for all pages
    tasks = [
        process_page(page, page_num, prompt) for page_num, page in enumerate(doc, 1)
    ]

    # Process all pages in parallel
    results_list = await asyncio.gather(*tasks)

    # Convert results list to dictionary
    results = {
        page_num: page_results
        for page_num, page_results in results_list
        if page_results  # Only include pages with results
    }

    doc.close()
    return results


@api_router.post("/save-annotations")
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


# Include the router with prefix
app.include_router(api_router, prefix="/api")

# Only mount static files if the directory exists (production mode)
if os.path.exists("static"):
    app.mount("/", StaticFiles(directory="static", html=True), name="static")

if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
