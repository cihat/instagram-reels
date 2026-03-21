/**
 * Turns internal fetch/parse errors into short, non-technical copy for the UI.
 * Avoids raw JSON, URL chains, and stack-style messages.
 */
export function humanizeInstagramFetchDetail(detail: string): string {
	const d = detail.trim()
	if (!d) return "Could not reach Instagram."

	if (/Redirect loop/i.test(d)) {
		return "Instagram kept redirecting (session or cookies may be invalid)."
	}
	if (/Too many redirects/i.test(d)) {
		return "Too many redirects — check cookies or try again later."
	}
	if (/\bhttps?:\/\/\S*instagram\.com\S*/i.test(d) && /instagram\.com\/?["'\s]*[,;|]/i.test(d)) {
		return "Instagram kept redirecting (session or cookies may be invalid)."
	}

	if (/API\s+401/i.test(d)) {
		if (/wait a few minutes/i.test(d)) {
			return "Rate limited — wait a few minutes, then try again."
		}
		if (/require_login/i.test(d)) {
			return "Sign-in required — add fresh Instagram cookies."
		}
		return "Request not allowed — refresh cookies or try later."
	}
	if (/API\s+429/i.test(d)) {
		return "Too many requests — try again shortly."
	}
	if (/API\s+403/i.test(d)) {
		return "Access denied — refresh your session."
	}
	if (/API\s+5\d\d/i.test(d)) {
		return "Instagram had a server error — try again later."
	}
	if (/API\s+4\d\d/i.test(d)) {
		return "Instagram rejected the request — try again later."
	}

	if (/please wait/i.test(d) && /minute/i.test(d)) {
		return "Instagram asked to wait — try again in a few minutes."
	}

	if (/response is not json/i.test(d)) {
		return "Got an unexpected response from Instagram."
	}

	if (
		/\bfetch failed\b/i.test(d) ||
		/\bnetwork error\b/i.test(d) ||
		/\bconnection\b/i.test(d) ||
		/\beconnreset\b/i.test(d) ||
		/\bsocket\b/i.test(d) ||
		/\btls\b/i.test(d) ||
		/\bcertificate\b/i.test(d)
	) {
		return "Network error — Instagram may be blocking this connection."
	}

	if (/HTTP\s+5\d\d/i.test(d)) {
		return "Instagram server error — try again later."
	}
	if (/HTTP\s+4\d\d/i.test(d)) {
		return "Page could not be loaded."
	}

	return "Could not load from Instagram — try again later."
}

/**
 * Strips legacy/internal warning shapes before JSON is sent to the client.
 * Handles older formats like `user web_profile_info: API 401 {...}` so deployed
 * bundles or tools that read `warnings[]` never surface raw payloads.
 */
export function sanitizeClientMetadataWarning(line: string): string {
	const t = line.trim()
	if (!t) return t

	const looksTechnical =
		/web_profile_info|could not load list|Redirect loop:|API\s+\d{3}\s*\{|"require_login"|"status"\s*:\s*"fail"|instagram\.com\/[^/\s]+\/reels\//i.test(
			t,
		)
	if (!looksTechnical) return t

	const fromWebProfile = /^([A-Za-z0-9._]+)\s+web_profile_info:/i.exec(t)?.[1]
	const fromColon = /^([A-Za-z0-9._]+):/.exec(t)?.[1]
	const account = fromWebProfile ?? fromColon

	const human = humanizeInstagramFetchDetail(t)
	if (account) return `${account}: ${human}`
	return human
}
