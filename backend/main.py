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

search_text = "BMZ"


def process_pdf_streaming(doc, prompt):
    # Collect all pages with page numbers
    all_pages_text = []
    for page_num, page in enumerate(doc, 1):
        page_text = page.get_text()
        all_pages_text.append(f"=== PAGE {page_num} ===\n{page_text}")

    combined_text = "\n\n".join(all_pages_text)

    full_prompt = dedent(f"""
    You are a document redaction bot that assists in the process of publishing documents according to freedom of information laws. Generally your task is to redact personal and personally identifiable information. The user can also give you a more specific task. Here is what the user has asked you to do:
    {prompt}
    You will be given document text from a PDF, split into pages, and your task is to reply with phrases that should be redacted. When in doubt, err on the side of keeping things unredacted – the user can always manually redact things later.
    Reply with one phrase per line in this format:
    phrase1|1
    phrase2|2
    Where the number after | is the page number. Only output exact matches. No other text.
    
    Text to analyze:
    
    {combined_text}""")

    def generate():
        yield 'data: {"status": "started"}\n\n'

        buffer = []

        for chunk in completion(
            model="azure/gpt-4o-mini",
            messages=[{"role": "user", "content": full_prompt}],
            api_key=os.getenv("AZURE_OPENAI_API_KEY"),
            api_base=os.getenv("AZURE_OPENAI_API_BASE"),
            api_version=os.getenv("AZURE_OPENAI_API_VERSION"),
            temperature=0,
            stream=True,
        ):
            if not chunk.choices[0].delta.content:
                continue

            print(chunk.choices[0].delta.content)
            buffer.append(chunk.choices[0].delta.content)
            text = "".join(buffer)

            if "\n" in text:
                lines = text.split("\n")
                buffer = [lines[-1]]  # Keep incomplete line in buffer

                for line in lines[:-1]:
                    if not line.strip():
                        continue

                    try:
                        phrase, page_num = line.strip().split("|")
                        page_num = int(page_num)
                        phrase = phrase.strip()

                        if not phrase:
                            continue

                        page = doc[page_num - 1]
                        matches = page.search_for(phrase)

                        if matches:
                            page_rect = page.rect
                            for rect in matches:
                                result = {
                                    "x0": rect[0],
                                    "y0": rect[1],
                                    "x1": rect[2],
                                    "y1": rect[3],
                                    "page_width": page_rect.width,
                                    "page_height": page_rect.height,
                                    "text": phrase,
                                    "page": page_num,
                                }
                                yield f"data: {json.dumps(result)}\n\n"
                    except Exception as e:
                        print(f"Error processing line: {line}", e)
                        continue

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
