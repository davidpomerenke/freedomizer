import { COLORS } from "../styles/theme";

interface Props {
	onFileUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
	variant?: "full" | "compact";
	currentFileName?: string;
}

export function FileUpload({ onFileUpload, currentFileName }: Props) {
	return (
		<div
			style={{
				position: "relative",
				padding: "0.75rem",
				backgroundColor: COLORS.neutral.white,
				borderRadius: "8px",
				border: `4px dashed ${COLORS.neutral.border}`,
				cursor: "pointer",
				transition: "all 0.2s ease",
			}}
			onMouseEnter={(e) => {
				e.currentTarget.style.borderColor = COLORS.primary.main;
				e.currentTarget.style.backgroundColor = COLORS.primary.light;
			}}
			onMouseLeave={(e) => {
				e.currentTarget.style.borderColor = COLORS.primary.light;
				e.currentTarget.style.backgroundColor = COLORS.neutral.white;
			}}
		>
			<input
				id="pdf-upload"
				type="file"
				accept="application/pdf"
				onChange={onFileUpload}
				style={{
					position: "absolute",
					top: 0,
					left: 0,
					width: "100%",
					height: "100%",
					opacity: 0,
					cursor: "pointer",
				}}
			/>
			<div
				style={{
					display: "flex",
					alignItems: "center",
					gap: "0.75rem",
					color: COLORS.neutral.text.secondary,
				}}
			>
				<span style={{ fontSize: "1.25rem", flexShrink: 0 }}>📄</span>
				<div
					style={{
						flex: 1,
						minWidth: 0,
					}}
				>
					{currentFileName ? (
						<>
							<div
								style={{
									fontSize: "0.9rem",
									fontWeight: 500,
									whiteSpace: "nowrap",
									overflow: "hidden",
									textOverflow: "ellipsis",
								}}
								title={currentFileName}
							>
								{currentFileName}
							</div>
							<div
								style={{
									fontSize: "0.75rem",
									color: "#888",
									whiteSpace: "nowrap",
								}}
							>
								Click to change document
							</div>
						</>
					) : (
						<>
							<div
								style={{
									fontSize: "0.9rem",
									fontWeight: 500,
									whiteSpace: "nowrap",
								}}
							>
								Upload PDF Document
							</div>
							<div
								style={{
									fontSize: "0.75rem",
									color: "#888",
									whiteSpace: "nowrap",
								}}
							>
								or drop file here
							</div>
						</>
					)}
				</div>
			</div>
		</div>
	);
}
