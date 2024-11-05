import type { IHighlight } from "react-pdf-highlighter";
import React, { useState } from "react";

interface Props {
  highlights: Array<IHighlight>;
  resetHighlights: () => void;
  toggleDocument: () => void;
  onFileUpload: (url: string) => void;
  onDeleteHighlight?: (id: string) => void;
  onSearch: (searchText: string) => void;
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
  onSearch,
}: Props) {
  const [searchText, setSearchText] = useState("");

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const fileUrl = URL.createObjectURL(file);
      onFileUpload(fileUrl);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    console.log("Search triggered with text:", searchText);
    onSearch(searchText);
  };

  const sortedHighlights = [...highlights].sort((a, b) => {
    // First sort by page number
    if (a.position.pageNumber !== b.position.pageNumber) {
      return a.position.pageNumber - b.position.pageNumber;
    }
    
    // If on same page, sort by vertical position (top to bottom)
    return a.position.boundingRect.y1 - b.position.boundingRect.y1;
  });

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
        <form onSubmit={handleSearch} style={{ marginBottom: "1rem" }}>
          <label
            htmlFor="search-text"
            style={{
              display: "block",
              marginBottom: "0.5rem",
              color: "#333",
            }}
          >
            Search and highlight text:
          </label>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <input
              id="search-text"
              type="text"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              style={{ flex: 1, padding: "0.5rem" }}
              placeholder="Enter text to highlight..."
            />
            <button
              type="submit"
              style={{
                padding: "0.5rem 1rem",
                backgroundColor: "#007bff",
                color: "white",
                border: "none",
                borderRadius: "4px",
                cursor: "pointer",
              }}
            >
              Search
            </button>
          </div>
        </form>
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