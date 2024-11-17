import type { NewHighlight } from "react-pdf-highlighter";

// Generates a unique ID for new highlights
export const getNextId = () => String(Math.random()).slice(2);

// Extracts highlight ID from URL hash
export const parseIdFromHash = () => {
	const hash = document.location.hash;
	return hash.slice(hash.indexOf("highlight-") + "highlight-".length);
};

export const resetHash = () => {
	document.location.hash = "";
};

// Standard A4 dimensions in points (72 points = 1 inch)
export const PDF_DIMENSIONS = {
	WIDTH: 595.32,
	HEIGHT: 841.92,
} as const;

// Converts viewport coordinates to PDF coordinates
export const convertCoordinates = (highlight: NewHighlight) => {
	const { width: viewportWidth, height: viewportHeight } =
		highlight.position.boundingRect;
	const scaleX = PDF_DIMENSIONS.WIDTH / viewportWidth;
	const scaleY = PDF_DIMENSIONS.HEIGHT / viewportHeight;

	return {
		...highlight,
		position: {
			...highlight.position,
			boundingRect: scaleRect(highlight.position.boundingRect, scaleX, scaleY),
			rects: highlight.position.rects.map((rect) =>
				scaleRect(rect, scaleX, scaleY),
			),
		},
		id: getNextId(),
	};
};

// Helper function to scale individual rectangles
const scaleRect = (rect: any, scaleX: number, scaleY: number) => ({
	...rect,
	x1: rect.x1 * scaleX,
	y1: rect.y1 * scaleY,
	x2: rect.x2 * scaleX,
	y2: rect.y2 * scaleY,
	width: PDF_DIMENSIONS.WIDTH,
	height: PDF_DIMENSIONS.HEIGHT,
});
