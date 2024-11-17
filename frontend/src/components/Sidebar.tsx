import { useState } from "react";
import type { IHighlight } from "react-pdf-highlighter";
import { COLORS } from "../styles/theme";
import { ENTITY_TYPES } from "../utils/entityTypes";
import { analyzePdf, saveAnnotations } from "../utils/pdfUtils";
import { Button } from "./Button";
import { FileUpload } from "./FileUpload";
import { ProcessingModeSelector } from "./ProcessingModeSelector";

export interface Props {
	highlights: Array<IHighlight>;
	resetHighlights: () => void;
	onDeleteHighlight: (id: string) => void;
	currentPdfFile: File | null;
	addHighlight: (highlight: IHighlight) => void;
	filteredTypes: Set<string>;
	setFilteredTypes: (types: Set<string>) => void;
	onFileUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
}

const updateHash = (highlight: IHighlight) => {
	document.location.hash = `highlight-${highlight.id}`;
};

export function Sidebar({
	highlights,
	resetHighlights,
	onDeleteHighlight,
	currentPdfFile,
	addHighlight,
	filteredTypes,
	setFilteredTypes,
	onFileUpload,
}: Props) {
	const [isAnalyzing, setIsAnalyzing] = useState(false);
	const [processingMode, setProcessingMode] = useState<"local" | "remote">(
		"local",
	);
	const [showTooltip, setShowTooltip] = useState(false);

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
			const visibleHighlights = highlights.filter((highlight) => {
				const type = highlight.comment?.text?.split(" ")[0];
				return filteredTypes.size === 0 || !filteredTypes.has(type);
			});

			await saveAnnotations(currentPdfFile, visibleHighlights);
		} catch (error) {
			console.error("Error saving annotations:", error);
			alert("Failed to save annotations");
		}
	};

	const handleAnalyzePdf = async () => {
		if (!currentPdfFile) return;
		setIsAnalyzing(true);
		try {
			await analyzePdf(
				currentPdfFile,
				(pageHighlights) => {
					// Add IDs to the new highlights and add them
					pageHighlights
						.map((h) => ({
							...h,
							id: String(Math.random()).slice(2),
						}))
						.forEach(addHighlight);
				},
				processingMode === "remote",
			);
		} catch (error) {
			console.error("Error analyzing PDF:", error);
		} finally {
			setIsAnalyzing(false);
		}
	};

	const entityCounts = highlights.reduce(
		(acc, h) => {
			const type = h.comment?.text?.split(" ")[0];
			if (type && type in ENTITY_TYPES) {
				acc[type] = (acc[type] || 0) + 1;
			}
			return acc;
		},
		{} as Record<string, number>,
	);

	const toggleEntityType = (type: string) => {
		const newSet = new Set(filteredTypes);
		if (newSet.has(type)) {
			newSet.delete(type);
		} else {
			newSet.add(type);
		}
		setFilteredTypes(newSet);
	};

	return (
		<div
			className="sidebar"
			style={{
				width: "20%",
				minWidth: "250px",
				padding: "2rem",
				display: "flex",
				flexDirection: "column",
				gap: "2rem",
				backgroundColor: "#f8fafc",
				borderRight: "1px solid #e2e8f0",
			}}
		>
			{/* Header */}
			<div
				style={{
					borderBottom: "1px solid #e2e8f0",
					paddingBottom: "1.5rem",
				}}
			>
				<div
					style={{
						display: "flex",
						alignItems: "center",
						gap: "0.5rem",
						fontSize: "1.5rem",
						fontWeight: "700",
						color: "#1e293b",
					}}
				>
					<span>⬛️</span>
					<span style={{ color: "#0f172a" }}>SecuRedact</span>
				</div>
				<div
					style={{
						fontSize: "0.9rem",
						color: "#3b82f6",
						marginTop: "0.5rem",
					}}
				>
					AI-powered document redaction
				</div>
			</div>

			{/* Main Content */}
			<div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
				<FileUpload
					onFileUpload={onFileUpload}
					variant="compact"
					currentFileName={currentPdfFile?.name}
				/>

				{currentPdfFile && (
					<Button variant="secondary" icon="💾" onClick={handleSave}>
						Save Redacted PDF
					</Button>
				)}

				{currentPdfFile && (
					<>
						<ProcessingModeSelector
							mode={processingMode}
							onChange={setProcessingMode}
						/>

						<Button
							variant="primary"
							icon="🔍"
							onClick={handleAnalyzePdf}
							disabled={isAnalyzing}
							isLoading={isAnalyzing}
						>
							{isAnalyzing ? "Analyzing PDF..." : "Get AI Redactions"}
						</Button>
					</>
				)}

				{currentPdfFile && Object.entries(entityCounts).length > 0 && (
					<div style={{ marginTop: "1rem" }}>
						<div
							style={{
								color: "#1e293b",
								fontSize: "0.9rem",
								fontWeight: "600",
								marginBottom: "0.75rem",
							}}
						>
							Found entities:
						</div>
						<div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
							{Object.entries(entityCounts).map(([type, count]) => (
								<Button
									key={type}
									variant="filter"
									isActive={filteredTypes.has(type)}
									onClick={() => toggleEntityType(type)}
								>
									{ENTITY_TYPES[type as keyof typeof ENTITY_TYPES]?.label ||
										type}
									<span style={{ fontWeight: "bold" }}>({count})</span>
								</Button>
							))}
						</div>
					</div>
				)}

				{currentPdfFile && (
					<div
						style={{
							padding: "1.25rem",
							backgroundColor: "#fff",
							borderRadius: "8px",
							fontSize: "0.85rem",
							color: "#1e293b",
							border: "1px solid #e2e8f0",
							boxShadow: "0 1px 3px rgba(0, 0, 0, 0.1)",
						}}
					>
						<div style={{ marginBottom: "0.75rem", fontWeight: "600" }}>
							💡 How to create redactions:
						</div>
						<ul
							style={{
								margin: "0",
								paddingLeft: "1.2rem",
								lineHeight: "1.4",
							}}
						>
							<li>Select text with your mouse to redact specific content</li>
							<li>Hold Alt and drag to redact rectangular areas</li>
							<li>
								All highlights will be converted to redactions when saving
							</li>
						</ul>
					</div>
				)}

				{highlights.length > 0 && (
					<>
						<div
							style={{
								display: "flex",
								justifyContent: "space-between",
								alignItems: "center",
								marginBottom: "0.5rem",
							}}
						>
							<div style={{ fontWeight: 600, color: "#1e293b" }}>
								Redactions
							</div>
							<button
								type="button"
								onClick={resetHighlights}
								style={{
									background: "none",
									border: "none",
									padding: "0.4rem 0.6rem",
									fontSize: "0.75rem",
									color: COLORS.neutral.text.secondary,
									cursor: "pointer",
									display: "flex",
									alignItems: "center",
									gap: "0.25rem",
									borderRadius: "4px",
									transition: "all 0.2s ease",
								}}
								onMouseOver={(e) => {
									e.currentTarget.style.backgroundColor = COLORS.action.hover;
									e.currentTarget.style.color = COLORS.neutral.text.primary;
								}}
								onFocus={(e) => {
									e.currentTarget.style.backgroundColor = COLORS.action.hover;
									e.currentTarget.style.color = COLORS.neutral.text.primary;
								}}
								onMouseOut={(e) => {
									e.currentTarget.style.backgroundColor = "transparent";
									e.currentTarget.style.color = COLORS.neutral.text.secondary;
								}}
								onBlur={(e) => {
									e.currentTarget.style.backgroundColor = "transparent";
									e.currentTarget.style.color = COLORS.neutral.text.secondary;
								}}
							>
								🗑️ Reset all
							</button>
						</div>
						<ul
							className="sidebar__highlights"
							style={{
								backgroundColor: "#ffffff",
								padding: "1rem",
								borderRadius: "8px",
								boxShadow: "0 2px 6px rgba(0, 0, 0, 0.06)",
								display: "flex",
								flexDirection: "column",
								gap: "0.75rem",
							}}
						>
							{sortedHighlights
								.filter((highlight) => {
									const type = highlight.comment?.text?.split(" ")[0];
									return filteredTypes.size === 0 || !filteredTypes.has(type);
								})
								.map((highlight, _index) => (
									<li
										key={highlight.id}
										className="sidebar__highlight"
										style={{
											padding: "0.75rem",
											backgroundColor: "#f0f9ff",
											borderRadius: "6px",
											border: "1px solid #bfdbfe",
											transition: "all 0.2s ease",
										}}
										onMouseOver={(e) => {
											e.currentTarget.style.backgroundColor = "#e0f2fe";
											e.currentTarget.style.borderColor = "#93c5fd";
										}}
										onFocus={(e) => {
											e.currentTarget.style.backgroundColor = "#e0f2fe";
											e.currentTarget.style.borderColor = "#93c5fd";
										}}
										onMouseOut={(e) => {
											e.currentTarget.style.backgroundColor = "#f0f9ff";
											e.currentTarget.style.borderColor = "#bfdbfe";
										}}
										onBlur={(e) => {
											e.currentTarget.style.backgroundColor = "#f0f9ff";
											e.currentTarget.style.borderColor = "#bfdbfe";
										}}
									>
										<div
											style={{
												display: "flex",
												justifyContent: "space-between",
												alignItems: "flex-start",
												gap: "8px",
												width: "100%",
											}}
										>
											<button
												type="button"
												style={{
													flex: 1,
													cursor: "pointer",
													minWidth: 0,
													background: "none",
													border: "none",
													padding: 0,
													textAlign: "left",
													width: "100%",
												}}
												onClick={() => updateHash(highlight)}
											>
												{highlight.comment?.text && (
													<div
														style={{
															display: "inline-block",
															fontSize: "0.7rem",
															padding: "0.2rem 0.4rem",
															borderRadius: "4px",
															marginBottom: "0.4rem",
															backgroundColor: "#ffd6a5",
															color: "#333",
															fontWeight: "500",
															maxWidth: "100%",
															overflow: "hidden",
															textOverflow: "ellipsis",
															whiteSpace: "nowrap",
														}}
													>
														{ENTITY_TYPES[
															highlight.comment.text.split(
																" ",
															)[0] as keyof typeof ENTITY_TYPES
														]?.label || highlight.comment.text.split(" ")[0]}
													</div>
												)}
												<div
													style={{
														display: "flex",
														justifyContent: "space-between",
														alignItems: "baseline",
														gap: "8px",
														width: "100%",
													}}
												>
													{highlight.content.text ? (
														<blockquote
															style={{
																flex: 1,
																margin: 0,
																fontSize: "0.85rem",
																lineHeight: "1.4",
																color: "#334155",
																overflow: "hidden",
																textOverflow: "ellipsis",
																display: "-webkit-box",
																WebkitLineClamp: 2,
																WebkitBoxOrient: "vertical",
																wordBreak: "break-word",
																minWidth: 0,
															}}
														>
															{highlight.content.text.trim()}
														</blockquote>
													) : highlight.content.image ? (
														<div className="highlight__image">
															<img
																src={highlight.content.image}
																alt="Screenshot"
																style={{
																	maxWidth: "100%",
																	height: "auto",
																}}
															/>
														</div>
													) : null}
													<div
														className="highlight__location"
														style={{
															whiteSpace: "nowrap",
															fontSize: "0.75rem",
															color: "#64748b",
															fontWeight: "500",
															flexShrink: 0,
														}}
													>
														Page {highlight.position.pageNumber}
													</div>
												</div>
											</button>
											<button
												type="button"
												onClick={() => onDeleteHighlight?.(highlight.id)}
												style={{
													background: "none",
													border: "none",
													cursor: "pointer",
													fontSize: "1.1rem",
													padding: "0 4px",
													color: "#94a3b8",
													lineHeight: 1,
													transition: "color 0.2s ease",
													flexShrink: 0,
												}}
												onMouseOver={(e) => {
													e.currentTarget.style.color = "#64748b";
												}}
												onFocus={(e) => {
													e.currentTarget.style.color = "#64748b";
												}}
												title="Remove redaction"
											>
												×
											</button>
										</div>
									</li>
								))}
						</ul>
					</>
				)}
			</div>

			{/* Footer */}
			<div
				style={{
					paddingTop: "1.5rem",
					borderTop: "1px solid #e2e8f0",
					fontSize: "0.85rem",
					color: "#3b82f6",
					marginTop: "auto",
				}}
			>
				<div
					style={{
						display: "flex",
						alignItems: "center",
						justifyContent: "space-between",
						gap: "0.75rem",
					}}
				>
					<div
						onMouseEnter={() => setShowTooltip(true)}
						onMouseLeave={() => setShowTooltip(false)}
						style={{
							display: "flex",
							alignItems: "center",
							gap: "0.5rem",
							padding: "0.4rem 0.6rem",
							borderRadius: "6px",
							cursor: "help",
							position: "relative",
							backgroundColor: showTooltip ? "#f3f4f6" : "transparent",
							transition: "all 0.2s ease",
						}}
					>
						<span style={{ fontSize: "1.2rem" }}>🇩🇪</span>
						<span style={{ fontSize: "1.2rem" }}>🇪🇺</span>
						<span style={{ fontSize: "1.2rem" }}>🇺🇳</span>
						{showTooltip && (
							<div
								style={{
									position: "absolute",
									bottom: "calc(100% + 12px)",
									left: 0,
									backgroundColor: "white",
									color: "#374151",
									padding: "1rem 1.25rem",
									borderRadius: "12px",
									fontSize: "0.75rem",
									lineHeight: "1.5",
									width: "220px",
									boxShadow: "0 4px 20px rgba(0, 0, 0, 0.12)",
									border: "1px solid #e5e7eb",
									zIndex: 10,
									animation: "tooltipFade 0.2s ease-out",
								}}
							>
								<div
									style={{
										marginBottom: "0.75rem",
										display: "flex",
										alignItems: "center",
										gap: "0.5rem",
									}}
								>
									<span style={{ fontSize: "1.1rem" }}>🇩🇪</span>
									Made in Germany
								</div>
								<div
									style={{
										marginBottom: "0.75rem",
										display: "flex",
										alignItems: "center",
										gap: "0.5rem",
									}}
								>
									<span style={{ fontSize: "1.1rem" }}>🇪🇺</span>
									With European privacy
								</div>
								<div
									style={{
										display: "flex",
										alignItems: "center",
										gap: "0.5rem",
									}}
								>
									<span style={{ fontSize: "1.1rem" }}>🇺🇳</span>
									As a Digital Public Good
								</div>
								<div
									style={{
										position: "absolute",
										bottom: "-6px",
										left: "20px",
										transform: "rotate(45deg)",
										width: "12px",
										height: "12px",
										backgroundColor: "white",
										border: "1px solid #e5e7eb",
										borderTop: "none",
										borderLeft: "none",
									}}
								/>
							</div>
						)}
					</div>

					<a
						href="https://github.com/davidpomerenke/securedact"
						target="_blank"
						rel="noopener noreferrer"
						style={{
							display: "flex",
							alignItems: "center",
							padding: "0.4rem 0.6rem",
							borderRadius: "6px",
							transition: "all 0.2s ease",
							fontSize: "1.2rem",
							color: "#666",
							textDecoration: "none",
							backgroundColor: "transparent",
						}}
						onMouseOver={(e) => {
							e.currentTarget.style.backgroundColor = "#f3f4f6";
						}}
						onFocus={(e) => {
							e.currentTarget.style.backgroundColor = "#f3f4f6";
						}}
						onMouseOut={(e) => {
							e.currentTarget.style.backgroundColor = "transparent";
						}}
						onBlur={(e) => {
							e.currentTarget.style.backgroundColor = "transparent";
						}}
					>
						<svg
							height="20"
							width="20"
							viewBox="0 0 16 16"
							style={{ fill: "currentColor" }}
						>
							<title>Contribute on Github</title>
							<path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
						</svg>
					</a>
				</div>
			</div>
		</div>
	);
}
