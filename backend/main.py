from fastapi import FastAPI, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import pymupdf
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

search_text = "Effekt"


@app.post("/analyze-pdf")
async def analyze_pdf(file: UploadFile):
    if not file.filename.endswith(".pdf"):
        raise HTTPException(status_code=400, detail="File must be a PDF")

    try:
        contents = await file.read()
        pdf_stream = io.BytesIO(contents)
        doc = pymupdf.open(stream=pdf_stream, filetype="pdf")

        # TODO: handle metadata
        # metadata = doc.metadata

        search_results = []
        for page in doc:
            results = page.search_for(search_text)
            search_results.append(results)

        doc.close()
        return search_results

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error processing PDF: {str(e)}")


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
