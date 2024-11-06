# Build stage for frontend
FROM node:20-slim AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package.json .
COPY frontend/tsconfig.json .
RUN npm install
COPY frontend/ .
RUN npm run build

# Final stage
FROM python:3.10-slim
WORKDIR /app

# Install Python dependencies
COPY backend/pyproject.toml .
RUN pip install --no-cache-dir ".[all]"

# Copy backend code
COPY backend/ .

# Copy built frontend files
COPY --from=frontend-builder /app/frontend/dist /app/static

# Expose port
EXPOSE 8000

# Start the application
CMD ["python", "main.py"] 