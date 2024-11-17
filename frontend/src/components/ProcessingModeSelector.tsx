import { COLORS } from "../styles/theme";

interface Props {
	mode: "local" | "remote";
	onChange: (mode: "local" | "remote") => void;
}

const modes = {
	local: {
		icon: "🔒",
		title: "Private Mode",
		description: "Process in browser",
	},
	remote: {
		icon: "⚡️",
		title: "Fast Mode",
		description: "Process on server",
	},
} as const;

export function ProcessingModeSelector({ mode, onChange }: Props) {
	return (
		<div
			style={{
				display: "flex",
				gap: "0.5rem",
				padding: "0.25rem",
				backgroundColor: COLORS.neutral.white,
				borderRadius: "8px",
				border: `1px solid ${COLORS.neutral.border}`,
			}}
		>
			{(["local", "remote"] as const).map((option) => (
				<button
					type="button"
					key={option}
					onClick={() => onChange(option)}
					style={{
						flex: 1,
						display: "flex",
						alignItems: "center",
						gap: "6px",
						padding: "0.5rem",
						border: "none",
						borderRadius: "6px",
						cursor: "pointer",
						backgroundColor:
							mode === option ? COLORS.primary.light : COLORS.neutral.white,
						boxShadow: mode === option ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
						transition: "all 0.2s ease",
						color:
							mode === option
								? COLORS.primary.main
								: COLORS.neutral.text.secondary,
					}}
				>
					<span style={{ fontSize: "1.1rem" }}>{modes[option].icon}</span>
					<div style={{ textAlign: "left" }}>
						<div
							style={{
								fontSize: "0.9rem",
								fontWeight: mode === option ? "500" : "normal",
							}}
						>
							{modes[option].title}
						</div>
						<div
							style={{
								fontSize: "0.75rem",
								opacity: 0.7,
							}}
						>
							{modes[option].description}
						</div>
					</div>
				</button>
			))}
		</div>
	);
}
