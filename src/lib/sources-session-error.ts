/**
 * True when a fetch-metadata failure indicates missing/invalid Instagram session or cookies.
 * Used to send the user to /sources to fix the secret/cookie field.
 */
export function isSourcesSessionOrCookieError(message: string): boolean {
	const m = message.toLowerCase()
	if (m.includes("no instagram session")) return true
	if (m.includes("cookie export")) return true
	if (m.includes("instagram_cookies")) return true
	if (m.includes("sessionid") && m.includes("csrftoken")) return true
	if (m.includes("instagram") && m.includes("cookie")) return true
	if (m.includes("refresh cookies")) return true
	if (m.includes("sign-in required")) return true
	if (m.includes("cookies may be invalid")) return true
	if (m.includes("cookies may be expired")) return true
	/* fetch-metadata: wrong deploy secret and no valid cookie paste */
	if (m === "unauthorized") return true
	return false
}
