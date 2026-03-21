"use client"

import { toast } from "sonner"
import { fetchSourcesMetadata } from "@/lib/fetch-sources-metadata"
import { isSourcesSessionOrCookieError } from "@/lib/sources-session-error"
import { metadataLoadingMessage } from "@/lib/metadata-toast-label"
import { invalidateSearchIndex, loadIndex } from "@/lib/search"

const TRIGGER_SECRET_STORAGE_KEY = "reels-sources-trigger-secret"

function readTriggerSecret(): string | undefined {
	if (typeof window === "undefined") return undefined
	try {
		const s = localStorage.getItem(TRIGGER_SECRET_STORAGE_KEY)?.trim()
		return s || undefined
	} catch {
		return undefined
	}
}

export type MetadataFetchToastCallbacks = {
	onSuccess?: () => void
	onSessionError?: () => void
}

/**
 * Queues a Sonner toast (stacks top-right with others) that fetches reel metadata
 * for the given accounts, then reloads the search index.
 */
export function enqueueMetadataFetchToast(
	accounts: string[],
	callbacks?: MetadataFetchToastCallbacks,
	secretOverride?: string,
): void {
	if (accounts.length === 0) return
	const trimmed = secretOverride?.trim()
	const secret = trimmed ? trimmed : readTriggerSecret()
	toast.promise(
		(async () => {
			const result = await fetchSourcesMetadata(accounts, secret)
			if (!result.ok) throw new Error(result.error)
			invalidateSearchIndex()
			await loadIndex()
			callbacks?.onSuccess?.()
			return result
		})(),
		{
			loading: metadataLoadingMessage(accounts),
			success: (result) =>
				result.warnings.length > 0
					? `Index updated — ${result.warnings.length} warning(s)`
					: "Index updated",
			error: (e) => {
				const msg = e instanceof Error ? e.message : "Request failed"
				if (isSourcesSessionOrCookieError(msg)) callbacks?.onSessionError?.()
				return msg
			},
		},
	)
}
