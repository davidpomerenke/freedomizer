export const ENTITY_TYPES = {
	PER: { label: "Person", color: "#ffadad" },
	ORG: { label: "Organization", color: "#ffd6a5" },
	LOC: { label: "Location", color: "#caffbf" },
	PHONE: { label: "Phone", color: "#9bf6ff" },
	EMAIL: { label: "Email", color: "#bdb2ff" },
	MONEY: { label: "Financial", color: "#ffc6ff" },
	DATE: { label: "Date", color: "#a0c4ff" },
} as const;

// Helper functions for complex patterns
const createMoneyPattern = () => {
	const currencies = [
		// Major currencies
		"$",
		"€",
		"£",
		"¥",
		"₹",
		"₽",
		"₿",
		"CHF",
		"₣",
		"₩",
		// Currency codes
		"USD",
		"EUR",
		"GBP",
		"JPY",
		"CNY",
		"INR",
		"RUB",
		"BTC",
		"AUD",
		"CAD",
		"NZD",
		"CHF",
		"HKD",
		"SGD",
		"SEK",
		"DKK",
		"PLN",
		"NOK",
		"CZK",
		"ZAR",
	];

	// Support both dot and comma as decimal separators
	const numberPattern = "\\d+(?:[.,]\\d{3})*(?:[.,]\\d{2})?";

	// Extended suffix pattern with international abbreviations
	const suffixPattern = [
		// English
		"[KkMmBbTt]n?\\b",
		"thousand",
		"million",
		"billion",
		"trillion",
		// German/Dutch
		"Tsd\\.?",
		"Mio\\.?",
		"Mrd\\.?",
		"Bio\\.?",
		"Bil\\.?",
		// French
		"k€?",
		"M€?",
		"Md€?",
		"Mds€?",
		// Spanish/Portuguese
		"mil",
		"millón",
		"millones",
		"billón",
		"billones",
		"milhão",
		"milhões",
		"bilhão",
		"bilhões",
		// Italian
		"mila",
		"mln\\.?",
		"mlrd\\.?",
		// Scandinavian
		"mkr",
		"mdkr",
		"tkr",
		// Russian
		"тыс\\.?",
		"млн\\.?",
		"млрд\\.?",
		"трлн\\.?",
		// Chinese/Japanese
		"万",
		"億",
		"兆",
	].join("|");

	const patterns = [
		// Standard currency formats (€100, 100€, EUR 100)
		...currencies.flatMap((curr) => {
			const escaped = curr.replace("$", "\\$");
			return [
				`${escaped}\\s*${numberPattern}`,
				`${numberPattern}\\s*${escaped}`,
			];
		}),

		// Amounts with suffixes (5M$, $5B, 5 million EUR, 14,5 mio. EUR)
		...currencies.flatMap((curr) => {
			const escaped = curr.replace("$", "\\$");
			return [
				`${escaped}\\s*\\d+(?:[.,]\\d+)?\\s*(?:${suffixPattern})`,
				`\\d+(?:[.,]\\d+)?\\s*(?:${suffixPattern})\\s*${escaped}`,
			];
		}),

		// Numbers with currency words
		`${numberPattern}\\s*(?:dollars|euros|pounds|yen|yuan|rupees|rubles|francs|won)\\b`,

		// Chinese/Japanese style (e.g., 100万円, 100億ドル)
		`${numberPattern}(?:${suffixPattern})?\\s*[円元¥]`,
		`${numberPattern}(?:${suffixPattern})?\\s*ドル`,

		// Indian format (e.g., 1,00,000)
		"\\d+(?:,\\d{2})+(?:\\.\\d{2})?\\s*(?:Rs\\.?|₹)",
	];

	return new RegExp(patterns.join("|"), "gi");
};

const createDatePattern = () => {
	// Common month names in different languages
	const monthNames = {
		en: "Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?",
		de: "Jan(?:uar)?|Feb(?:ruar)?|Mär(?:z)?|Apr(?:il)?|Mai|Jun(?:i)?|Jul(?:i)?|Aug(?:ust)?|Sep(?:tember)?|Okt(?:ober)?|Nov(?:ember)?|Dez(?:ember)?",
		fr: "janv(?:ier)?|févr(?:ier)?|mars|avr(?:il)?|mai|juin|juil(?:let)?|août|sept(?:embre)?|oct(?:obre)?|nov(?:embre)?|déc(?:embre)?",
		es: "ene(?:ro)?|feb(?:rero)?|mar(?:zo)?|abr(?:il)?|may(?:o)?|jun(?:io)?|jul(?:io)?|ago(?:sto)?|sep(?:tiembre)?|oct(?:ubre)?|nov(?:iembre)?|dic(?:iembre)?",
		it: "gen(?:naio)?|feb(?:braio)?|mar(?:zo)?|apr(?:ile)?|mag(?:gio)?|giu(?:gno)?|lug(?:lio)?|ago(?:sto)?|set(?:tembre)?|ott(?:obre)?|nov(?:embre)?|dic(?:embre)?",
		nl: "jan(?:uari)?|feb(?:ruari)?|maart|apr(?:il)?|mei|jun(?:i)?|jul(?:i)?|aug(?:ustus)?|sep(?:tember)?|okt(?:ober)?|nov(?:ember)?|dec(?:ember)?",
	};

	const allMonthNames = Object.values(monthNames).join("|");

	// Time pattern components
	const timePattern =
		"(?:(?:[01]?\\d|2[0-3]):[0-5]\\d(?::[0-5]\\d)?(?:\\s*[AaPp][Mm])?|(?:[01]?\\d|2[0-3])\\s*[Uu][Hh][Rr])";
	const timeZonePattern =
		"(?:GMT|UTC|EST|EDT|CST|CDT|MST|MDT|PST|PDT|[+-]\\d{2}:?\\d{2}|[A-Z]{3,5})";

	const patterns = [
		// ISO dates (2024-03-14, 2024/03/14)
		"\\b\\d{4}[-/.]\\d{1,2}[-/.]\\d{1,2}\\b",

		// European formats (14.03.2024, 14-03-2024, 14/03/2024)
		"\\b\\d{1,2}[-/.]\\d{1,2}[-/.]\\d{2,4}\\b",

		// American format (03/14/2024)
		"\\b\\d{1,2}/\\d{1,2}/\\d{2,4}\\b",

		// German format (14. März 2024, 14.März 2024, 14. Maerz 2024)
		`\\b\\d{1,2}(?:\\.|ter|e)?\\s*(?:${monthNames.de})\\s*\\d{2,4}\\b`,

		// French format (14 mars 2024, 14 mars, 2024)
		`\\b\\d{1,2}(?:er)?\\s+(?:${monthNames.fr})\\s+\\d{2,4}\\b`,

		// Spanish format (14 de marzo de 2024)
		`\\b\\d{1,2}\\s+(?:de\\s+)?(?:${monthNames.es})(?:\\s+de)?\\s+\\d{2,4}\\b`,

		// Italian format (14 marzo 2024)
		`\\b\\d{1,2}\\s+(?:${monthNames.it})\\s+\\d{2,4}\\b`,

		// Dutch format (14 maart 2024)
		`\\b\\d{1,2}\\s+(?:${monthNames.nl})\\s+\\d{2,4}\\b`,

		// All languages - month first (March 14, 2024)
		`\\b(?:${allMonthNames})\\s+\\d{1,2}(?:st|nd|rd|th)?(?:[,\\s]+\\d{2,4})?\\b`,

		// All languages - year first (2024, March 14)
		`\\b\\d{4}\\s+(?:${allMonthNames})\\s+\\d{1,2}(?:st|nd|rd|th)?\\b`,

		// Standalone years
		"\\b(?:19[0-9]{2}|20[0-9]{2}|2100)\\b", // Years from 1900-2100

		// Quarter/Half notation (various languages)
		"\\b(?:Q[1-4]|H[1-2]|[1-4]Q|[1-2]H)\\s*/?\\s*\\d{4}\\b",
		"\\b(?:Quartal\\s*[1-4]|Halbjahr\\s*[1-2])\\s+\\d{4}\\b", // German
		"\\b(?:Trimestre\\s*[1-4]|Semestre\\s*[1-2])\\s+\\d{4}\\b", // French

		// Abbreviated year formats (common in Europe)
		"\\b\\d{1,2}[-./]\\d{1,2}[-./]\\d{2}\\b",

		// Chinese/Japanese date format (2024年3月14日)
		"\\b\\d{4}年\\s*\\d{1,2}月\\s*\\d{1,2}日\\b",

		// Islamic date format
		"\\b\\d{1,2}\\s+(?:Muharram|Safar|Rabi\\s*al-[aA]wwal|Rabi\\s*al-[tT]hani|Jumada\\s*al-[aA]wwal|Jumada\\s*al-[tT]hani|Rajab|Sha[']ban|Ramadan|Shawwal|Dhu\\s*al-[qQ]adah|Dhu\\s*al-[hH]ijjah)\\s+\\d{4}\\b",

		// Time patterns
		`\\b${timePattern}\\b`,
		`\\b${timePattern}\\s*${timeZonePattern}\\b`,

		// Date + Time combinations
		// ISO format with time
		"\\b\\d{4}[-/.]\\d{1,2}[-/.]\\d{1,2}[T ]\\d{2}:\\d{2}(?::\\d{2})?(?:\\.\\d{1,3})?(?:Z|[+-]\\d{2}:?\\d{2})?\\b",

		// European format with time
		`\\b\\d{1,2}[-/.]\\d{1,2}[-/.]\\d{2,4}[,\\s]+${timePattern}\\b`,

		// American format with time
		`\\b\\d{1,2}/\\d{1,2}/\\d{2,4}[,\\s]+${timePattern}\\b`,

		// Text format with time
		`\\b(?:${allMonthNames})\\s+\\d{1,2}(?:st|nd|rd|th)?(?:[,\\s]+\\d{2,4})?[,\\s]+${timePattern}\\b`,

		// Japanese format with time
		`\\b\\d{4}年\\s*\\d{1,2}月\\s*\\d{1,2}日\\s*${timePattern}\\b`,

		// 24-hour time ranges
		`\\b${timePattern}\\s*[-–—~to]+\\s*${timePattern}\\b`,
	];

	return new RegExp(patterns.join("|"), "gi");
};

const createPhonePattern = () => {
	const patterns = [
		// International format with country code
		"\\+\\d{1,3}[-. ]?\\(?\\d{1,4}\\)?[-. ]?\\d{1,4}[-. ]?\\d{1,9}",

		// US/Canada format
		"(?:\\+?1[-. ]?)?\\(?\\d{3}\\)?[-. ]?\\d{3}[-. ]?\\d{4}",

		// European format
		"\\+\\d{2}[-. ]?\\d{2}[-. ]?\\d{3}[-. ]?\\d{2}[-. ]?\\d{2}",

		// Extension formats
		"(?:ext|x|ext\\.|extension)[-. ]?\\d{1,5}",
	].join("|");

	// Negative lookahead to avoid matching years and other numeric patterns
	return new RegExp(`(?<!\\d)(?:${patterns})(?!\\d)`, "g");
};

// International patterns
export const REGEX_PATTERNS = {
	PHONE: createPhonePattern(),
	EMAIL: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
	MONEY: createMoneyPattern(),
	DATE: createDatePattern(),
} as const;
