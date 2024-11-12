import os

import torch
from dotenv import load_dotenv
from fastapi import (
    APIRouter,
    FastAPI,
    Response,
    Body,
)
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from transformers import pipeline

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


# The API will be available at /api
app.include_router(api_router, prefix="/api")

# If the static directory exists, serve the frontend from there
if os.path.exists("static"):
    app.mount("/", StaticFiles(directory="static", html=True), name="static")

if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
