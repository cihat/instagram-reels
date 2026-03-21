/**
 * Turn pasted material (Netscape cookie file, Cookie header, or loose key=value lines)
 * into a single Cookie header value for Instagram requests.
 */
export function instagramCookieHeaderFromUserInput(raw: string): string | null {
	const s = raw.trim()
	if (!s) return null

	// Netscape / curl cookie jar: tab-separated, instagram domain in first column
	if (s.includes("\t") && /instagram\.com/i.test(s)) {
		const pairs: Record<string, string> = {}
		for (const line of s.split(/\r?\n/)) {
			const t = line.trim()
			if (!t || t.startsWith("#")) continue
			const parts = t.split("\t")
			if (parts.length < 7) continue
			const domain = parts[0].replace(/^#HttpOnly_/i, "")
			const host = domain.replace(/^\./, "")
			if (!host.toLowerCase().endsWith("instagram.com")) continue
			const name = parts[5]?.trim()
			const value = parts.slice(6).join("\t").trim()
			if (name && value) pairs[name] = value
		}
		const keys = Object.keys(pairs)
		if (keys.length === 0) return null
		return keys.map((k) => `${k}=${pairs[k]}`).join("; ")
	}

	// One block: newlines → "; ", collapse duplicate semicolons
	let oneLine = s
		.split(/\r?\n/)
		.map((l) => l.trim())
		.filter(Boolean)
		.join("; ")
		.replace(/;\s*;/g, ";")
		.trim()
	oneLine = oneLine.replace(/^cookie\s*:\s*/i, "").trim()

	if (
		/(^|[;\s])(sessionid|csrftoken|ds_user_id)\s*=/i.test(oneLine)
	) {
		return oneLine
	}

	return null
}
