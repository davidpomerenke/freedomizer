import type { IHighlight } from "react-pdf-highlighter";
import React from "react";

interface Props {
  highlights: Array<IHighlight>;
  resetHighlights: () => void;
  toggleDocument: () => void;
  onFileUpload: (url: string) => void;
  onDeleteHighlight?: (id: string) => void;
}

const updateHash = (highlight: IHighlight) => {
  document.location.hash = `highlight-${highlight.id}`;
};

declare const APP_VERSION: string;

export function Sidebar({
  highlights,
  resetHighlights,
  onFileUpload,
  onDeleteHighlight,
}: Props) {
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const fileUrl = URL.createObjectURL(file);
      onFileUpload(fileUrl);
    }
  };

  return (
    <div className="sidebar" style={{ width: "25vw" }}>
      <div style={{ padding: "1rem" }}>
        <h3>PDF Highlighter</h3>
        <div style={{ marginBottom: "1rem" }}>
          <label
            htmlFor="pdf-upload"
            style={{
              display: "block",
              marginBottom: "0.5rem",
              color: "#333",
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
        {highlights.length > 0 && (
          <button
            onClick={resetHighlights}
            style={{
              marginBottom: "1rem",
              padding: "0.5rem",
              width: "100%",
            }}
          >
            Reset Highlights
          </button>
        )}
      </div>
      {highlights.length > 0 ? (
        <ul className="sidebar__highlights">
          {highlights.map((highlight, index) => (
            <li
              key={index}
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
                    <strong>{highlight.comment.text}</strong>
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
                  title="Delete highlight"
                >
                  ×
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <div style={{ padding: "1rem", color: "#666", textAlign: "center" }}>
          No highlights yet
        </div>
      )}
    </div>
  );
}