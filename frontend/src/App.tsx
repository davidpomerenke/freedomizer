import { useCallback, useRef, useState } from "react";

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
import { parseIdFromHash, resetHash } from "./utils/highlightUtils";

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

	const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
		const file = event.target.files?.[0];
		if (file) {
			const fileUrl = URL.createObjectURL(file);
			setUrl(fileUrl);
			resetHighlights();
			setCurrentPdfFile(file);
		}
	};

	return (
		<div className="App" style={{ display: "flex", height: "100vh" }}>
			<Sidebar
				highlights={highlights}
				resetHighlights={resetHighlights}
				onDeleteHighlight={deleteHighlight}
				currentPdfFile={currentPdfFile}
				addHighlight={addHighlight}
				filteredTypes={filteredTypes}
				setFilteredTypes={setFilteredTypes}
				onFileUpload={handleFileUpload}
			/>

			<div
				className="pdf-viewer"
				style={{
					height: "100vh",
					width: "75vw",
					position: "relative",
				}}
			>
				<div 
					style={{
						position: "absolute",
						top: 0,
						left: 0,
						right: 0,
						padding: "10px",
						background: "#fff3cd",
						color: "#664d03",
						border: "1px solid #ffecb5",
						zIndex: 1000,
						textAlign: "center",
					}}
				>
					⚠️ This software is in development and not yet ready for production use. Always verify redactions manually.
				</div>
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
					<div className="pdf-viewer" />
				)}
			</div>
		</div>
	);
}

export default App;
