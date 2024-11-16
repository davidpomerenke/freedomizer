import { useState, useCallback, useRef } from "react";

import {
	AreaHighlight,
	Highlight,
	PdfHighlighter,
	PdfLoader,
} from "react-pdf-highlighter";
import type { IHighlight } from "react-pdf-highlighter";

import { Sidebar } from "./components/Sidebar";
import { Spinner } from "./components/Spinner";

import "./style/App.css";
import "../node_modules/react-pdf-highlighter/dist/style.css";
import { useHighlights } from "./hooks/useHighlights";
import { resetHash, parseIdFromHash } from "./utils/highlightUtils";

function App() {
	const [url, setUrl] = useState<string | null>(null);
	const [currentPdfFile, setCurrentPdfFile] = useState<File | null>(null);
	const [filteredTypes, setFilteredTypes] = useState<Set<string>>(new Set());

	const {
		highlights,
		addHighlight,
		updateHighlight,
		deleteHighlight,
		resetHighlights,
	} = useHighlights();

	const scrollViewerTo = useRef<(highlight: IHighlight) => void>(() => {});

	const scrollToHighlightFromHash = useCallback(() => {
		const highlightId = parseIdFromHash();
		if (!highlightId) return;

		const highlight = highlights.find((h) => h.id === highlightId);
		if (highlight) {
			setTimeout(() => scrollViewerTo.current(highlight), 100);
		}
	}, [highlights]);

	const handleFileUpload = (fileUrl: string, file: File) => {
		setUrl(fileUrl);
		resetHighlights();
		setCurrentPdfFile(file);
	};

	return (
		<div className="App" style={{ display: "flex", height: "100vh" }}>
			<Sidebar
				highlights={highlights}
				resetHighlights={resetHighlights}
				onFileUpload={handleFileUpload}
				onDeleteHighlight={deleteHighlight}
				currentPdfFile={currentPdfFile}
				addHighlight={addHighlight}
				filteredTypes={filteredTypes}
				setFilteredTypes={setFilteredTypes}
			/>

			<div
				className="pdf-viewer"
				style={{
					height: "100vh",
					width: "75vw",
					position: "relative",
				}}
			>
				{url ? (
					<PdfLoader url={url} beforeLoad={<Spinner />}>
						{(pdfDocument) => {
							return (
								<PdfHighlighter
									pdfDocument={pdfDocument}
									pdfScaleValue="page-width"
									enableAreaSelection={(event) => event.altKey}
									onScrollChange={resetHash}
									scrollRef={(scrollTo) => {
										scrollViewerTo.current = scrollTo;
										if (document.location.hash) {
											scrollToHighlightFromHash();
										}
									}}
									onSelectionFinished={(
										position,
										content,
										_hideTipAndSelection,
										_transformSelection,
									) => {
										addHighlight({
											content,
											position,
											comment: { text: "", emoji: "" },
										});
										return null;
									}}
									highlightTransform={(
										highlight,
										_index,
										_setTip,
										_hideTip,
										viewportToScaled,
										screenshot,
										isScrolledTo,
									) => {
										const isTextHighlight = !highlight.content?.image;

										return isTextHighlight ? (
											// biome-ignore lint/a11y/useKeyWithClickEvents: <explanation>
											<div onClick={() => deleteHighlight(highlight.id)}>
												<Highlight
													isScrolledTo={isScrolledTo}
													position={highlight.position}
													comment={highlight.comment}
												/>
											</div>
										) : (
											// biome-ignore lint/a11y/useKeyWithClickEvents: <explanation>
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
									highlights={highlights.filter((highlight) => {
										const type = highlight.comment?.text?.split(" ")[0];
										return filteredTypes.size === 0 || !filteredTypes.has(type);
									})}
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
							<p>Upload a PDF to start redacting sensitive information</p>
						</div>
					</div>
				)}
			</div>
		</div>
	);
}

export default App;
