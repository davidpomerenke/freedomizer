import { useCallback, useState } from "react";
import type {
	Content,
	IHighlight,
	NewHighlight,
	ScaledPosition,
} from "react-pdf-highlighter";
import { convertCoordinates } from "../utils/highlightUtils";

// Custom hook to manage highlight state and operations
export const useHighlights = () => {
	const [highlights, setHighlights] = useState<Array<IHighlight>>([]);

	// Add new highlight with converted coordinates
	const addHighlight = useCallback((highlight: NewHighlight) => {
		const enrichedHighlight = convertCoordinates(highlight);
		setHighlights((prev) => [enrichedHighlight, ...prev]);
	}, []);

	// Update existing highlight's position or content
	const updateHighlight = useCallback(
		(
			highlightId: string,
			position: Partial<ScaledPosition>,
			content: Partial<Content>,
		) => {
			setHighlights((prev) =>
				prev.map((h) => {
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
		},
		[],
	);

	const deleteHighlight = useCallback((id: string) => {
		setHighlights((prev) => prev.filter((hl) => hl.id !== id));
	}, []);

	const resetHighlights = useCallback(() => {
		setHighlights([]);
	}, []);

	return {
		highlights,
		addHighlight,
		updateHighlight,
		deleteHighlight,
		resetHighlights,
	};
};
