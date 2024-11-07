import io
import json
import os
from textwrap import dedent

import pymupdf
from dotenv import load_dotenv
from fastapi import (
    FastAPI,
    File,
    Form,
    HTTPException,
    Response,
    UploadFile,
    APIRouter,
)
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from litellm import completion

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


def process_pdf_streaming(doc, prompt):
    # Collect all pages with page numbers
    all_pages_text = []
    for page_num, page in enumerate(doc, 1):
        page_text = page.get_text()
        all_pages_text.append(f"=== PAGE {page_num} ===\n{page_text}")

    combined_text = "\n\n".join(all_pages_text)
    print(combined_text)

    full_prompt = dedent(f"""
    You are a document redaction bot. For each potentially sensitive item, follow these exact steps:

    1. CONTEXT: "..." (quote the sensitive phrase within its surrounding text)
    2. ANALYSIS: Explain why this might or might not need redaction
    3. DECISION: Write either SKIP or REDACT
    4. PAGE: Specify the page number
    5. OCCURRENCE INFO: Explain how many exact matches exist and which one you're targeting
    6. OCCURRENCE: Specify which occurrence number (counting only exact matches)
    7. EXACT: "..." (the exact characters to be redacted, in quotes)

    Important:
    - Count only EXACT matches (500000 ≠ 500.000 €)
    - Start fresh counting on each page
    - Use the exact characters you found, don't modify them

    Example 1 (public financial info):
    CONTEXT: "The project has an estimated market value: 500.000 € according to experts"
    ANALYSIS: This is public market information that's important for transparency
    DECISION: SKIP

    Example 2 (private financial info):
    CONTEXT: "Mr. Schmidt's personal loan amount: 500.000 € was approved"
    ANALYSIS: This reveals private financial information about an individual
    DECISION: REDACT
    PAGE: 2
    OCCURRENCE INFO: Found exactly one match of "500.000" on this page
    OCCURRENCE: 1
    EXACT: "500.000"

    Example 3 (name with variations):
    CONTEXT: "Report by Dr. Jane Smith... reviewed by J. Smith... Approved by: Jane Smith"
    ANALYSIS: This is a person's name appearing in an official capacity
    DECISION: REDACT
    PAGE: 3
    OCCURRENCE INFO: Found "Jane Smith" twice on this page (ignoring "Dr. Jane Smith" and "J. Smith")
    OCCURRENCE: 2
    EXACT: "Jane Smith"

    Example 4 (email in different contexts):
    CONTEXT: "Contact support@company.com for general inquiries... private user: john.doe@company.com"
    ANALYSIS: The support email is public, but the personal email needs protection
    DECISION: REDACT
    PAGE: 1
    OCCURRENCE INFO: Found "john.doe@company.com" once on this page
    OCCURRENCE: 1
    EXACT: "john.doe@company.com"

    Example 5 (ID number with context):
    CONTEXT: "Project ID: PRJ-2023-45... Employee ID: 7845-0991"
    ANALYSIS: Project IDs are public references, but employee IDs are personal identifiers
    DECISION: REDACT
    PAGE: 1
    OCCURRENCE INFO: Found "7845-0991" once on this page
    OCCURRENCE: 1
    EXACT: "7845-0991"

    Here is what the user has asked you to do:
    "{prompt}"

    Text to analyze ({doc.page_count} pages):
    {combined_text}""")

    def generate():
        yield 'data: {"status": "started"}\n\n'

        buffer = []
        current_analysis = None
        current_page = None
        current_occurrence = None
        current_exact = None

        for chunk in completion(
            model="azure/gpt-4o",
            messages=[{"role": "user", "content": full_prompt}],
            api_key=os.getenv("AZURE_OPENAI_API_KEY"),
            api_base=os.getenv("AZURE_OPENAI_API_BASE"),
            api_version=os.getenv("AZURE_OPENAI_API_VERSION"),
            temperature=0,
            stream=True,
        ):
            if chunk.choices[0].finish_reason is not None:
                buffer.append("\n")
            else:
                buffer.append(chunk.choices[0].delta.content)
            text = "".join(buffer)

            if "\n" in text:
                lines = text.split("\n")
                buffer = [lines[-1]]

                for line in lines[:-1]:
                    line = line.strip()
                    print(line)
                    if not line:
                        continue

                    elif line.startswith("ANALYSIS:"):
                        current_analysis = line[9:].strip()
                    elif line.startswith("DECISION: SKIP"):
                        # Reset without emitting anything
                        current_analysis = None
                        current_page = None
                        current_occurrence = None
                        current_exact = None
                    elif line.startswith("PAGE:"):
                        current_page = int(line[5:].strip())
                    elif line.startswith("OCCURRENCE:"):
                        current_occurrence = int(line[11:].strip())
                    elif line.startswith('EXACT: "'):
                        # Extract text between quotes
                        current_exact = line[7:].strip().strip('"')

                        # If we have all necessary information, process the redaction
                        if all(
                            [
                                current_exact,
                                current_page,
                                current_occurrence,
                                current_analysis,
                            ]
                        ):
                            try:
                                page = doc[current_page - 1]
                                matches = page.search_for(current_exact)

                                if matches and 0 < current_occurrence <= len(matches):
                                    rect = matches[current_occurrence - 1]
                                    page_rect = page.rect
                                    result = {
                                        "x0": rect[0],
                                        "y0": rect[1],
                                        "x1": rect[2],
                                        "y1": rect[3],
                                        "page_width": page_rect.width,
                                        "page_height": page_rect.height,
                                        "text": current_exact,
                                        "page": current_page,
                                        "comment": current_analysis,
                                    }
                                    yield f"data: {json.dumps(result)}\n\n"

                            except Exception as e:
                                print(f"Error processing redaction: {e}")

                            # Reset after processing
                            current_analysis = None
                            current_page = None
                            current_occurrence = None
                            current_exact = None

        yield 'data: {"status": "completed"}\n\n'

    return generate


@api_router.post("/analyze-pdf")
def analyze_pdf(file: UploadFile, prompt: str = Form(...)):
    if not file.filename.endswith(".pdf"):
        raise HTTPException(status_code=400, detail="File must be a PDF")

    contents = file.file.read()
    pdf_stream = io.BytesIO(contents)
    doc = pymupdf.open(stream=pdf_stream, filetype="pdf")

    return StreamingResponse(
        process_pdf_streaming(doc, prompt)(), media_type="text/event-stream"
    )


@api_router.post("/save-annotations")
def save_annotations(
    file: UploadFile = File(...),
    annotations: str = Form(...),
):
    if not file.filename.endswith(".pdf"):
        raise HTTPException(status_code=400, detail="File must be a PDF")

    # Parse the annotations JSON string
    highlights = json.loads(annotations)

    # Read the PDF file
    contents = file.file.read()
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
