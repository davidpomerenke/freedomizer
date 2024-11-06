import type { IHighlight } from "react-pdf-highlighter";
import React, { useState } from "react";

interface Props {
  highlights: Array<IHighlight>;
  resetHighlights: () => void;
  toggleDocument: () => void;
  onFileUpload: (fileUrl: string, file: File) => void;
  onDeleteHighlight?: (id: string) => void;
  onBackendHighlights: (highlights: Array<IHighlight>) => void;
  currentPdfFile: File | null;
  customPrompt: string;
  setCustomPrompt: (prompt: string) => void;
  onAnalyzePdf: () => void;
  isAnalyzing: boolean;
}

const updateHash = (highlight: IHighlight) => {
  document.location.hash = `highlight-${highlight.id}`;
};

const adjustTextareaHeight = (element: HTMLTextAreaElement) => {
  element.style.height = 'auto';
  element.style.height = element.scrollHeight + 'px';
};

export function Sidebar({
  highlights,
  resetHighlights,
  onFileUpload,
  onDeleteHighlight,
  onBackendHighlights,
  currentPdfFile,
  customPrompt,
  setCustomPrompt,
  onAnalyzePdf,
  isAnalyzing,
}: Props) {

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const fileUrl = URL.createObjectURL(file);
      onFileUpload(fileUrl, file);

      try {
        const formData = new FormData();
        formData.append('file', file);

        const response = await fetch('/api/analyze-pdf', {
          method: 'POST',
          body: formData,
        });

        if (!response.ok) {
          throw new Error('Failed to analyze PDF');
        }

        const analysisResult = await response.json();
        console.log("analysisResult", analysisResult);

        // Convert backend highlights to frontend format
        const convertedHighlights = Object.entries(analysisResult).flatMap(
          ([pageNum, highlights]: [string, any[]]) =>
            highlights.map((h: any) => {
              return {
                content: {
                  text: h.text || ''
                },
                position: {
                  boundingRect: {
                    x1: h.x0,
                    y1: h.y0,
                    x2: h.x1,
                    y2: h.y1,
                    width: h.page_width,
                    height: h.page_height,
                  },
                  rects: [{
                    x1: h.x0,
                    y1: h.y0,
                    x2: h.x1,
                    y2: h.y1,
                    width: h.page_width,
                    height: h.page_height,
                  }],
                  pageNumber: parseInt(pageNum)
                },
                comment: { text: "AI Generated", emoji: "🤖" },
                id: String(Math.random()).slice(2)
              };
            })
        );

        onBackendHighlights(convertedHighlights);
      } catch (error) {
        console.error('Error analyzing PDF:', error);
      }
    }
  };

  const sortedHighlights = [...highlights].sort((a, b) => {
    // First sort by page number
    if (a.position.pageNumber !== b.position.pageNumber) {
      return a.position.pageNumber - b.position.pageNumber;
    }

    // If on same page, sort by vertical position (top to bottom)
    return a.position.boundingRect.y1 - b.position.boundingRect.y1;
  });

  const handleSave = async () => {
    if (!currentPdfFile) {
      alert("No PDF file loaded");
      return;
    }

    try {
      const formData = new FormData();
      formData.append('file', currentPdfFile);

      // Transform highlights back to PyMuPDF coordinate system
      const transformedHighlights = highlights.map(h => {
        return {
          ...h,
          position: {
            ...h.position,
            boundingRect: {
              ...h.position.boundingRect,
              // Convert back to PyMuPDF coordinates
              y1: h.position.boundingRect.y1,
              y2: h.position.boundingRect.y2
            }
          }
        };
      });

      formData.append('annotations', JSON.stringify(transformedHighlights));

      const response = await fetch('/api/save-annotations', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Failed to save annotations');
      }

      // Download the annotated PDF
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `annotated_${currentPdfFile.name}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

    } catch (error) {
      console.error('Error saving annotations:', error);
      alert('Failed to save annotations');
    }
  };

  return (
    <div className="sidebar" style={{ width: "25vw" }}>
      <div style={{ padding: "1rem" }}>
        <h3>PDF Redactor</h3>
        <div style={{ marginBottom: "1rem" }}>
          <label
            htmlFor="pdf-upload"
            style={{
              display: "block",
              marginBottom: "0.5rem",
              color: "#333",
              fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
            }}
          >
            Choose a PDF to get started:
          </label>
          <input
            id="pdf-upload"
            type="file"
            accept="application/pdf"
            onChange={handleFileUpload}
            style={{ width: "100%" }}
          />
        </div>



        {currentPdfFile && (
          <div style={{ marginBottom: "1rem" }}>
            <label
              htmlFor="prompt-input"
              style={{
                display: "block",
                marginBottom: "0.5rem",
                color: "#333",
                fontSize: "0.9rem",
                fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
              }}
            >
              AI Analysis Prompt:
            </label>
            <textarea
              id="prompt-input"
              value={customPrompt}
              onChange={(e) => {
                setCustomPrompt(e.target.value);
                adjustTextareaHeight(e.target);
              }}
              onFocus={(e) => adjustTextareaHeight(e.target)}
              style={{
                width: "100%",
                minHeight: "70px",
                marginBottom: "0.5rem",
                padding: "0.5rem",
                fontSize: "0.7rem",
                fontFamily: "Monaco, Consolas, 'Courier New', monospace",
                lineHeight: "1.4",
                border: "1px solid #ccc",
                borderRadius: "4px",
                resize: "none",
                boxSizing: "border-box",
                overflow: "hidden",
              }}
            />
            <button
              onClick={onAnalyzePdf}
              disabled={isAnalyzing}
              style={{
                marginBottom: "1rem",
                padding: "0.5rem",
                width: "100%",
                fontSize: "0.9rem",
                fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
                cursor: isAnalyzing ? "not-allowed" : "pointer",
                opacity: isAnalyzing ? 0.7 : 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px"
              }}
            >
              {isAnalyzing ? (
                <>
                  <div className="spinner-small"></div>
                  Analyzing PDF...
                </>
              ) : (
                "Get AI Suggestions"
              )}
            </button>
            <div style={{ marginBottom: "1rem" }}>
              <div
                style={{
                  padding: "0.5rem",
                  backgroundColor: "#f5f5f5",
                  borderRadius: "4px",
                  fontSize: "0.8rem",
                  color: "#666",
                }}
              >
                <strong>Tip:</strong> Hold Alt and drag to create rectangular selections
              </div>
            </div>
          </div>

        )}

        {highlights.length > 0 && (
          <button
            onClick={resetHighlights}
            style={{
              marginBottom: "1rem",
              padding: "0.5rem",
              width: "100%",
            }}
          >
            Reset Redactions
          </button>
        )}
        {highlights.length > 0 && currentPdfFile && (
          <button
            onClick={handleSave}
            style={{
              marginBottom: "1rem",
              padding: "0.5rem",
              width: "100%",
            }}
          >
            Save Redacted PDF
          </button>
        )}
      </div>
      {highlights.length > 0 ? (
        <ul className="sidebar__highlights">
          {sortedHighlights.map((highlight, index) => (
            <li
              key={highlight.id}
              className="sidebar__highlight"
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div
                  style={{ flex: 1, cursor: 'pointer' }}
                  onClick={() => {
                    updateHash(highlight);
                  }}
                >
                  <div>
                    {highlight.content.text ? (
                      <blockquote style={{ marginTop: "0.5rem" }}>
                        {`${highlight.content.text.slice(0, 90).trim()}…`}
                      </blockquote>
                    ) : null}
                    {highlight.content.image ? (
                      <div
                        className="highlight__image"
                        style={{ marginTop: "0.5rem" }}
                      >
                        <img src={highlight.content.image} alt={"Screenshot"} />
                      </div>
                    ) : null}
                  </div>
                  <div className="highlight__location">
                    Page {highlight.position.pageNumber}
                  </div>
                </div>
                <button
                  onClick={() => onDeleteHighlight?.(highlight.id)}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: '16px',
                    padding: '4px 8px',
                    color: '#666',
                    marginLeft: '8px'
                  }}
                  title="Remove redaction"
                >
                  x
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <div style={{ padding: "1rem", color: "#666", textAlign: "center" }}>
          No redactions yet
        </div>
      )}
    </div>
  );
}