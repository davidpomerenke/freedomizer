# Build stage for frontend
FROM --platform=linux/amd64 node:20-slim AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package.json .
COPY frontend/tsconfig.json .
RUN npm install
COPY frontend/ .
RUN npm run build

# Final stage
FROM --platform=linux/amd64 ghcr.io/astral-sh/uv:python3.12-bookworm
WORKDIR /app

# Install Python dependencies
COPY pyproject.toml .
COPY uv.lock .
RUN uv sync --frozen

# Install spaCy model
RUN python -m spacy download xx_ent_wiki_sm

# Copy backend code
COPY backend/ .

# Copy built frontend files
COPY --from=frontend-builder /app/frontend/dist /app/static

# Expose port
EXPOSE 8000

# Start the application
CMD ["python", "main.py"]
