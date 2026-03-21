/** Short error for forms/toasts — never append raw API `warnings[]`. */
function userFacingMetadataFailureMessage(
	message: string | undefined,
	warnings: string[],
	accountCount: number,
	persistNote: string,
): string {
	const base = (message ?? "").trim() || "Could not fetch new reels."
	if (warnings.length === 0) {
		return persistNote ? `${base} ${persistNote}`.trim() : base
	}

	const joined = warnings.join(" ").toLowerCase()
	let hint = ""
	if (
		/rate limit|redirect|cookie|session|sign-in|not allowed|401|blocked|reach instagram/i.test(
			joined,
		)
	) {
		hint =
			accountCount > 1
				? "Instagram rate-limited or blocked some accounts — wait a bit or update cookies."
				: "Instagram rate-limited or blocked the request — wait a bit or update cookies."
	} else if (
		/storage|catalog|saved|bucket|configured|read the saved|save the catalog/i.test(joined)
	) {
		hint =
			"There was a problem reading or saving the catalog on the server."
	} else {
		hint = "Try again in a few minutes."
	}

	return [base, hint, persistNote].filter(Boolean).join(" ").replace(/\s+/g, " ").trim()
}

export type SourcesMetadataResult =
	| {
			ok: true
			message?: string
			warnings: string[]
			persisted?: boolean
	  }
	| { ok: false; error: string }

export async function fetchSourcesMetadata(
	accounts: string[],
	secret?: string,
): Promise<SourcesMetadataResult> {
	try {
		const res = await fetch("/api/fetch-metadata", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({
				secret: secret?.trim() || undefined,
				accounts,
			}),
		})
		const data = (await res.json()) as {
			ok?: boolean
			message?: string
			error?: string
			detail?: string
			warnings?: string[]
			persisted?: boolean
		}

		if (!res.ok) {
			return {
				ok: false,
				error:
					[data.error, data.detail].filter(Boolean).join(": ") || "Request failed",
			}
		}

		const warnText = data.warnings?.filter(Boolean) ?? []
		const persistNote =
			data.persisted === false
				? "Fetched data could not be saved; refresh may not show changes."
				: ""

		if (data.ok === false) {
			return {
				ok: false,
				error: userFacingMetadataFailureMessage(
					data.message,
					warnText,
					accounts.length,
					persistNote,
				),
			}
		}

		return {
			ok: true,
			message: data.message,
			warnings: warnText,
			persisted: data.persisted,
		}
	} catch {
		return { ok: false, error: "Network error — try again." }
	}
}
