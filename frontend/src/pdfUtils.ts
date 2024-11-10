import { PDFDocument } from "../node_modules/mupdf/dist/mupdf.js";
import {
	pipeline,
	type TokenClassificationPipeline,
	type TokenClassificationOutput,
} from "@huggingface/transformers";
import type { NewHighlight, Scaled } from "react-pdf-highlighter";
import { REGEX_PATTERNS } from "./entityTypes";

function findRegexEntities(text: string, entities: any[]) {
	// Find regex-based entities
	for (const [type, pattern] of Object.entries(REGEX_PATTERNS)) {
		let match;
		while ((match = pattern.exec(text)) !== null) {
			entities.push({
				text: match[0],
				type,
				score: 1,
				startIndex: match.index,
				endIndex: match.index + match[0].length,
			});
		}
	}
}

function processTokenClassificationOutput(
	output: TokenClassificationOutput,
	originalText: string,
) {
	const entities: any[] = [];
	let currentEntity = null;

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
				currentEntity.rawWords.reduce((text, word, i) => {
					if (i === 0) return word;
					return text + (word.startsWith("##") ? word.slice(2) : " " + word);
				}, ""),
				// Progressive join (try to find longest matching substring)
				currentEntity.words.reduce((text, word) => {
					const combined = text + word;
					const combinedWithSpace = text + " " + word;
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
	console.log(entities);
	return entities.sort((a, b) => a.startIndex - b.startIndex);
}

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
) {
	const fileBuffer = await file.arrayBuffer();
	const doc = new PDFDocument(fileBuffer);

	const structuredText = [...Array(doc.countPages())].map((_, i) =>
		doc.loadPage(i).toStructuredText(),
	);
	const text = structuredText.map((st) => st.asText());
	const model = "Xenova/bert-base-multilingual-cased-ner-hrl";
	const device = (navigator as Navigator & { gpu?: unknown }).gpu
		? "webgpu"
		: "wasm";
	const classifier = (await pipeline("token-classification", model, {
		device: device,
		dtype: "fp16",
	})) as TokenClassificationPipeline;

	// Process each page individually
	for (const [i, pageText] of text.entries()) {
		const start = performance.now();
		const output = (await classifier(pageText, {
			ignore_labels: [],
		})) as TokenClassificationOutput;
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

export async function saveAnnotations(
	file: File,
	highlights: Array<NewHighlight>,
) {
	const fileBuffer = await file.arrayBuffer();
	const doc = new PDFDocument(fileBuffer);

	// Process each highlight as a redaction
	for (const highlight of highlights) {
		const pageNumber = highlight.position.boundingRect.pageNumber - 1; // 0-based index
		const page = doc.loadPage(pageNumber);
		const rect = highlight.position.boundingRect; // attributes: x1, x2, y1, y2, height, width, pageNumber
		for (const rect of highlight.position.rects) {
			// Create redaction annotation
			const redaction = page.createAnnotation("Redact");
			redaction.setRect([rect.x1, rect.y1, rect.x2, rect.y2]);
			// Create more colorful overlay (color does not work for redactions)
			const overlay = page.createAnnotation("Square");
			overlay.setRect([rect.x1, rect.y1, rect.x2, rect.y2]);
			overlay.setInteriorColor([1, 0.41, 0.71]); // Pink color
			overlay.setBorderWidth(0);
		}

		// Apply the redaction
		page.applyRedactions(0); // since we have our own overlays, we use 0 to remove the redacted content without adding black boxes
	}

	// Save the redacted PDF
	const output = doc.saveToBuffer();

	// Create blob and download
	const blob = new Blob([output.asUint8Array()], { type: "application/pdf" });
	const url = URL.createObjectURL(blob);

	const a = document.createElement("a");
	a.href = url;
	a.download = file.name.replace(".pdf", "_redacted.pdf");
	document.body.appendChild(a);
	a.click();

	// Cleanup
	URL.revokeObjectURL(url);
	document.body.removeChild(a);
	doc.destroy();
}
