interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
	variant?: "primary" | "secondary" | "filter";
	icon?: string;
	isActive?: boolean;
	isLoading?: boolean;
}

export function Button({
	variant = "secondary",
	icon,
	children,
	isActive,
	isLoading,
	...props
}: ButtonProps) {
	const baseStyles = {
		display: "flex",
		alignItems: "center",
		justifyContent: "center",
		gap: "8px",
		padding: "0.75rem",
		width: "100%",
		border: "none",
		borderRadius: "8px",
		fontSize: "0.9rem",
		fontWeight: 500,
		cursor: props.disabled ? "not-allowed" : "pointer",
		transition: "all 0.2s ease",
		opacity: props.disabled ? 0.7 : 1,
	};

	const variants = {
		primary: {
			backgroundColor: "#2563eb",
			color: "white",
			boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
			":hover": {
				backgroundColor: "#1d4ed8",
			},
		},
		secondary: {
			backgroundColor: "#f3f4f6",
			color: "#374151",
			border: "1px solid #e5e7eb",
			":hover": {
				backgroundColor: "#e5e7eb",
			},
		},
		filter: {
			backgroundColor: isActive ? "#e0f2fe" : "#fff",
			color: isActive ? "#0369a1" : "#374151",
			padding: "0.4rem 0.75rem",
			border: `1px solid ${isActive ? "#7dd3fc" : "#e5e7eb"}`,
			width: "auto",
			fontSize: "0.8rem",
			fontWeight: isActive ? "500" : "400",
			transition: "all 0.15s ease",
			"&:hover": {
				backgroundColor: isActive ? "#e0f2fe" : "#f0f9ff",
				borderColor: isActive ? "#7dd3fc" : "#bae6fd",
			},
		},
	};

	return (
		<button
			{...props}
			style={{
				...baseStyles,
				...variants[variant],
			}}
		>
			{isLoading && <div className="spinner-small" />}
			{icon && <span style={{ fontSize: "1.1rem" }}>{icon}</span>}
			{children}
		</button>
	);
}
