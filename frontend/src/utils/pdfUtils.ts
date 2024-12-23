import {
	type TokenClassificationOutput,
	type TokenClassificationPipeline,
	pipeline,
} from "@huggingface/transformers";
import type { NewHighlight, Scaled } from "react-pdf-highlighter";
import { PDFDocument } from "../../node_modules/mupdf/dist/mupdf.js";
import { REGEX_PATTERNS } from "./entityTypes.js";

// biome-ignore lint/suspicious/noExplicitAny: <explanation>
function findRegexEntities(text: string, entities: any[]) {
	// First find regex-based entities
	for (const [type, pattern] of Object.entries(REGEX_PATTERNS) as [
		string,
		RegExp,
	][]) {
		let match: RegExpExecArray | null;
		match = pattern.exec(text);
		while (match !== null) {
			entities.push({
				text: match[0],
				type,
				score: 1,
				startIndex: match.index,
				endIndex: match.index + match[0].length,
			});
			match = pattern.exec(text);
		}
	}

	// Then look for numbers adjacent to locations
	const locationEntities = entities.filter((e) => e.type === "LOC");
	for (const locEntity of locationEntities) {
		const beforeText = text.slice(
			Math.max(0, locEntity.startIndex - 20),
			locEntity.startIndex,
		);
		const afterText = text.slice(
			locEntity.endIndex,
			Math.min(text.length, locEntity.endIndex + 20),
		);

		// Check for numbers before or after the location
		const numberBefore = /(\d+)\s*$/.exec(beforeText);
		const numberAfter = /^\s*(\d+)/.exec(afterText);

		if (numberBefore) {
			const extension = numberBefore[0];
			locEntity.text = extension + locEntity.text;
			locEntity.startIndex -= extension.length;
		}

		if (numberAfter) {
			const extension = numberAfter[0];
			locEntity.text = locEntity.text + extension;
			locEntity.endIndex += extension.length;
		}
	}
}

function processTokenClassificationOutput(
	output: TokenClassificationOutput,
	originalText: string,
) {
	// biome-ignore lint/suspicious/noExplicitAny: <explanation>
	const entities: any[] = [];
	// biome-ignore lint/suspicious/noExplicitAny: <explanation>
	let currentEntity: any | null = null;

	for (const token of output) {
		const cleanWord = token.word.replace("##", "");

		if (token.entity === "O") {
			if (currentEntity) {
				findAndAddEntity(currentEntity, originalText, entities);
				currentEntity = null;
			}
			continue;
		}

		if (token.entity.startsWith("B-")) {
			if (currentEntity) {
				findAndAddEntity(currentEntity, originalText, entities);
			}
			currentEntity = {
				text: cleanWord,
				type: token.entity.slice(2),
				score: token.score,
				words: [cleanWord],
				rawWords: [token.word], // Keep original tokens for reference
			};
		} else if (token.entity.startsWith("I-") && currentEntity) {
			currentEntity.words.push(cleanWord);
			currentEntity.rawWords.push(token.word);

			// Try different text reconstruction strategies
			const reconstructions = [
				// Direct join of clean words
				currentEntity.words.join(""),
				// Join with spaces
				currentEntity.words.join(" "),
				// Smart join (combine ##-prefixed tokens without spaces)
				currentEntity.rawWords.reduce(
					(text: string, word: string, i: number) => {
						if (i === 0) return word;
						return text + (word.startsWith("##") ? word.slice(2) : ` ${word}`);
					},
					"",
				),
				// Progressive join (try to find longest matching substring)
				currentEntity.words.reduce((text: string, word: string) => {
					const combined = `${text}${word}`;
					const combinedWithSpace = `${text} ${word}`;
					if (originalText.includes(combined)) return combined;
					if (originalText.includes(combinedWithSpace))
						return combinedWithSpace;
					return text;
				}, currentEntity.words[0]),
			];

			// Find the longest matching reconstruction
			for (const reconstruction of reconstructions) {
				if (
					originalText.includes(reconstruction) &&
					(!currentEntity.text ||
						reconstruction.length > currentEntity.text.length)
				) {
					currentEntity.text = reconstruction;
				}
			}

			currentEntity.score = Math.min(currentEntity.score, token.score);
		}
	}

	if (currentEntity) {
		findAndAddEntity(currentEntity, originalText, entities);
	}

	// Add regex-based entities
	findRegexEntities(originalText, entities);

	// Sort entities by start position
	return entities.sort((a, b) => a.startIndex - b.startIndex);
}

// biome-ignore lint/suspicious/noExplicitAny: <explanation>
function findAndAddEntity(entity: any, originalText: string, entities: any[]) {
	if (!entity.text) return;

	// Find the complete entity in the original text
	const startPos = originalText.indexOf(entity.text);
	if (startPos !== -1) {
		entity.startIndex = startPos;
		entity.endIndex = startPos + entity.text.length;
		entities.push(entity);
	}
}

export async function analyzePdf(
	file: File,
	onPageProcessed: (highlights: NewHighlight[]) => void,
	useBackend: boolean,
	onModelLoadingStatusChange?: (isLoading: boolean, progress?: number) => void,
) {
	const fileBuffer = await file.arrayBuffer();
	const doc = new PDFDocument(fileBuffer);

	const structuredText = [...Array(doc.countPages())].map((_, i) =>
		doc.loadPage(i).toStructuredText(),
	);
	const text = structuredText.map((st) => st.asText());
	let classifier: TokenClassificationPipeline | null = null;

	if (!useBackend) {
		try {
			onModelLoadingStatusChange?.(true, 0);
			const model = "Xenova/bert-base-multilingual-cased-ner-hrl";
			const device = (navigator as Navigator & { gpu?: unknown }).gpu
				? "webgpu"
				: "wasm";
			classifier = (await pipeline("token-classification", model, {
				device: device,
				dtype: "fp16",
				progress_callback: (progressInfo: any) => {
					// Handle both old and new progress info formats
					const progressValue = progressInfo.progress !== undefined
						? progressInfo.progress
						: progressInfo.percentage !== undefined
							? progressInfo.percentage / 100
							: undefined;

					// Only update if we have a valid progress value
					if (progressValue !== undefined) {
						const normalizedProgress = Number.isNaN(progressValue)
							? 100
							: Math.round(progressValue * 100) / 100;
						onModelLoadingStatusChange?.(true, normalizedProgress);
					}
				},
			})) as TokenClassificationPipeline;
		} finally {
			onModelLoadingStatusChange?.(false);
		}
	}

	// Process each page individually
	for (const [i, pageText] of text.entries()) {
		const start = performance.now();
		let output: TokenClassificationOutput;
		if (useBackend) {
			const response = await fetch("/api/analyze-text", {
				method: "POST",
				headers: {
					"Content-Type": "text/plain",
				},
				body: pageText,
			});

			if (!response.ok) {
				throw new Error(`HTTP error! status: ${response.status}`);
			}

			const data = await response.json();
			output = data.entities;
		} else {
			output = (await (classifier as TokenClassificationPipeline)(pageText, {
				ignore_labels: [],
			})) as TokenClassificationOutput;
		}
		const end = performance.now();
		console.log(`Time taken: ${end - start} milliseconds`);

		const entities = processTokenClassificationOutput(output, pageText);
		const page = doc.loadPage(i);
		const [_x, _y, pageWidth, pageHeight] = page.getBounds();

		const pageHighlights: NewHighlight[] = [];

		for (const entity of entities) {
			const matches = page.search(entity.text);
			for (const quads of matches) {
				// Combine all quads into a single bounding rect
				const allXs = quads.flatMap((quad) => [
					quad[0],
					quad[2],
					quad[4],
					quad[6],
				]);
				const allYs = quads.flatMap((quad) => [
					quad[1],
					quad[3],
					quad[5],
					quad[7],
				]);
				const boundingRect = {
					x1: Math.min(...allXs),
					y1: Math.min(...allYs),
					x2: Math.max(...allXs),
					y2: Math.max(...allYs),
					width: pageWidth,
					height: pageHeight,
					pageNumber: i + 1,
				} as Scaled;

				pageHighlights.push({
					content: {
						text: entity.text,
					},
					comment: {
						text: `${entity.type} (confidence: ${(entity.score * 100).toFixed(1)}%)`,
						emoji: "",
					},
					position: {
						pageNumber: i + 1,
						boundingRect: boundingRect,
						rects: quads.map((quad) => ({
							x1: quad[0],
							y1: quad[1],
							x2: quad[2],
							y2: quad[5],
							width: pageWidth,
							height: pageHeight,
							pageNumber: i + 1,
						})),
					},
				} as NewHighlight);
			}
		}

		// Send highlights for this page to the callback
		onPageProcessed(pageHighlights);
	}
}

// Helper function to handle PDF download
function downloadPdf(blob: Blob, originalFileName: string) {
	const url = URL.createObjectURL(blob);
	const a = document.createElement("a");
	a.href = url;
	a.download = originalFileName.replace(".pdf", "_redacted.pdf");
	document.body.appendChild(a);
	a.click();

	// Cleanup
	URL.revokeObjectURL(url);
	document.body.removeChild(a);
}

export async function saveAnnotations(
	file: File,
	highlights: Array<NewHighlight>,
	useBackend = false,
) {
	let pdfBlob: Blob;

	if (useBackend) {
		// Use the backend endpoint
		const formData = new FormData();
		formData.append("file", file);
		formData.append("annotations", JSON.stringify(highlights));

		const response = await fetch("/api/save-with-redactions", {
			method: "POST",
			body: formData,
		});

		if (!response.ok) {
			throw new Error(`HTTP error! status: ${response.status}`);
		}

		pdfBlob = await response.blob();
	} else {
		// Local processing
		const fileBuffer = await file.arrayBuffer();
		const doc = new PDFDocument(fileBuffer);

		// Process each highlight as a redaction
		for (const highlight of highlights) {
			const pageNumber = highlight.position.pageNumber - 1; // 0-based index
			const page = doc.loadPage(pageNumber);
			for (const rect of highlight.position.rects) {
				// Create redaction annotation
				const redaction = page.createAnnotation("Redact");
				redaction.setRect([rect.x1, rect.y1, rect.x2, rect.y2]);
			}
			// Apply the redaction
			page.applyRedactions(1, 1);
		}

		// Save the redacted PDF
		const output = doc.saveToBuffer();
		pdfBlob = new Blob([output.asUint8Array()], { type: "application/pdf" });

		// Cleanup
		doc.destroy();
	}

	// Download the PDF (same for both paths)
	downloadPdf(pdfBlob, file.name);
}
