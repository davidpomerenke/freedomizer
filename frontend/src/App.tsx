import React, { useState, useEffect, useCallback, useRef } from "react";

import {
  AreaHighlight,
  Highlight,
  PdfHighlighter,
  PdfLoader,
} from "react-pdf-highlighter";
import type {
  Content,
  IHighlight,
  NewHighlight,
  ScaledPosition,
} from "react-pdf-highlighter";

import { Sidebar } from "./Sidebar";
import { Spinner } from "./Spinner";

import "./style/App.css";
import "../node_modules/react-pdf-highlighter/dist/style.css";

const getNextId = () => String(Math.random()).slice(2);

const parseIdFromHash = () =>
  document.location.hash.slice("#highlight-".length);

const resetHash = () => {
  document.location.hash = "";
};

const findTextInPage = async (page: any, searchText: string) => {
  const textContent = await page.getTextContent();
  const matches: Array<{str: string, transform: number[], width: number, height: number}> = [];
  
  textContent.items.forEach((item: any) => {
    if (item.str.toLowerCase().includes(searchText.toLowerCase())) {
      matches.push({
        str: item.str,
        transform: item.transform,
        width: item.width,
        height: item.height
      });
    }
  });
  
  return matches;
};

export function App() {
  const [url, setUrl] = useState<string | null>(null);
  const [highlights, setHighlights] = useState<Array<IHighlight>>([]);
  const [uploadedPdfUrl, setUploadedPdfUrl] = useState<string | null>(null);

  // Add this new ref to store the PDF document
  const pdfDocumentRef = useRef<any>(null);

  const resetHighlights = () => {
    setHighlights([]);
  };

  const toggleDocument = () => {
    if (uploadedPdfUrl) {
      setUrl(uploadedPdfUrl);
    } else {
      setHighlights([]);
    }
  };

  const scrollViewerTo = useRef<(highlight: IHighlight) => void>(() => {});

  const scrollToHighlightFromHash = useCallback(() => {
    const highlightId = parseIdFromHash();
    if (!highlightId) return;
    
    const highlight = highlights.find(h => h.id === highlightId);
    if (highlight) {
      // Add a small delay to ensure the PDF is ready
      setTimeout(() => {
        scrollViewerTo.current(highlight);
      }, 100);
    }
  }, [highlights]);

  useEffect(() => {
    window.addEventListener("hashchange", scrollToHighlightFromHash, false);
    return () => {
      window.removeEventListener(
        "hashchange",
        scrollToHighlightFromHash,
        false,
      );
    };
  }, [scrollToHighlightFromHash]);

  const getHighlightById = (id: string) => {
    return highlights.find((highlight) => highlight.id === id);
  };

  const addHighlight = (highlight: NewHighlight) => {
    setHighlights((prevHighlights) => [
      { ...highlight, id: getNextId() },
      ...prevHighlights,
    ]);
  };

  const updateHighlight = (
    highlightId: string,
    position: Partial<ScaledPosition>,
    content: Partial<Content>,
  ) => {
    setHighlights((prevHighlights) =>
      prevHighlights.map((h) => {
        const {
          id,
          position: originalPosition,
          content: originalContent,
          ...rest
        } = h;
        return id === highlightId
          ? {
              id,
              position: { ...originalPosition, ...position },
              content: { ...originalContent, ...content },
              ...rest,
            }
          : h;
      }),
    );
  };

  const handleFileUpload = (fileUrl: string) => {
    setUploadedPdfUrl(fileUrl);
    setUrl(fileUrl);
    setHighlights([]); // Reset highlights for new document
  };

  // Clean up object URLs when component unmounts or URL changes
  useEffect(() => {
    return () => {
      if (uploadedPdfUrl) {
        URL.revokeObjectURL(uploadedPdfUrl);
      }
    };
  }, [uploadedPdfUrl]);

  const deleteHighlight = useCallback((id: string) => {
    setHighlights(prevHighlights => prevHighlights.filter(hl => hl.id !== id));
  }, []);

  const searchAndHighlight = useCallback(async (searchText: string) => {
    if (!searchText.trim() || !pdfDocumentRef.current) return;

    const pdfDocument = pdfDocumentRef.current;
    
    // Clear existing search highlights
    setHighlights(prevHighlights => 
      prevHighlights.filter(h => !h.comment?.text?.startsWith('Found:'))
    );

    for (let pageNum = 1; pageNum <= pdfDocument.numPages; pageNum++) {
      const page = await pdfDocument.getPage(pageNum);
      const viewport = page.getViewport({ scale: 1.0 });
      const matches = await findTextInPage(page, searchText);

      matches.forEach(match => {
        // PDF.js provides coordinates in a transform array [scaleX, skewX, skewY, scaleY, translateX, translateY]
        const [scaleX, , , scaleY, x, y] = match.transform;

        // Use the actual width/height from the text item if available, otherwise calculate
        const width = match.width || (match.str.length * 5 * Math.abs(scaleX));
        const height = match.height || (12 * Math.abs(scaleY));
        
        // Transform y-coordinate from PDF space (bottom-up) to viewport space (top-down)
        const transformedY = viewport.height - y;
        
        const position = {
          boundingRect: {
            x1: x,
            y1: transformedY - height,
            x2: x + width,
            y2: transformedY,
            width: viewport.width,
            height: viewport.height,
          },
          rects: [{
            x1: x,
            y1: transformedY - height,
            x2: x + width,
            y2: transformedY,
            width: viewport.width,
            height: viewport.height,
          }],
          pageNumber: pageNum
        };

        const highlight = {
          content: {
            text: match.str
          },
          position,
          comment: { text: `Found: "${searchText}"`, emoji: "🔍" },
          id: getNextId()
        };

        addHighlight(highlight);
      });
    }
  }, [addHighlight]);

  const handleBackendHighlights = useCallback((newHighlights: Array<IHighlight>) => {
    setHighlights(prevHighlights => [...prevHighlights, ...newHighlights]);
  }, []);

  return (
    <div className="App" style={{ display: "flex", height: "100vh" }}>
      <Sidebar
        highlights={highlights}
        resetHighlights={resetHighlights}
        toggleDocument={toggleDocument}
        onFileUpload={handleFileUpload}
        onDeleteHighlight={deleteHighlight}
        onSearch={searchAndHighlight}
        onBackendHighlights={handleBackendHighlights}
      />
      <div
        style={{
          height: "100vh",
          width: "75vw",
          position: "relative",
        }}
      >
        {url ? (
          <PdfLoader url={url} beforeLoad={<Spinner />}>
            {(pdfDocument) => {
              // Store the PDF document reference when it's loaded
              pdfDocumentRef.current = pdfDocument;
              
              return (
                <PdfHighlighter
                  pdfDocument={pdfDocument}
                  pdfScaleValue="page-width"
                  enableAreaSelection={(event) => event.altKey}
                  onScrollChange={resetHash}
                  scrollRef={(scrollTo) => {
                    scrollViewerTo.current = scrollTo;
                    // Only call scroll if there's a hash present
                    if (document.location.hash) {
                      scrollToHighlightFromHash();
                    }
                  }}
                  onSelectionFinished={(position, content) => {
                    addHighlight({
                      content,
                      position,
                      comment: { text: "", emoji: "✋" }
                    });
                  }}
                  highlightTransform={(
                    highlight,
                    index,
                    setTip,
                    hideTip,
                    viewportToScaled,
                    screenshot,
                    isScrolledTo,
                  ) => {
                    const isTextHighlight = !highlight.content?.image;

                    return isTextHighlight ? (
                      <div onClick={() => deleteHighlight(highlight.id)}>
                        <Highlight
                          isScrolledTo={isScrolledTo}
                          position={highlight.position}
                          comment={highlight.comment}
                        />
                      </div>
                    ) : (
                      <div onClick={() => deleteHighlight(highlight.id)}>
                        <AreaHighlight
                          isScrolledTo={isScrolledTo}
                          highlight={highlight}
                          onChange={(boundingRect) => {
                            updateHighlight(
                              highlight.id,
                              { boundingRect: viewportToScaled(boundingRect) },
                              { image: screenshot(boundingRect) },
                            );
                          }}
                        />
                      </div>
                    );
                  }}
                  highlights={highlights}
                />
              );
            }}
          </PdfLoader>
        ) : (
          <div
            style={{
              height: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#333",
            }}
          >
            <div style={{ textAlign: "center" }}>
              <h2>No PDF loaded</h2>
              <p>Please upload a PDF using the sidebar</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}