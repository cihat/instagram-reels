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
				? "Metadata was fetched but could not be saved on the server; the grid may not update."
				: ""
		const parts = [
			data.message,
			warnText.length ? `Warnings: ${warnText.join("; ")}` : "",
			persistNote,
		].filter(Boolean)
		const detailBody = parts.join("\n\n")

		if (data.ok === false) {
			return { ok: false, error: detailBody || "Fetch failed" }
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
