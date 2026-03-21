"use client"

import { useCallback, useEffect, useId, useState } from "react"
import { CloudDownload, Loader2, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { fetchSourcesMetadata } from "@/lib/fetch-sources-metadata"
import { invalidateSearchIndex } from "@/lib/search"
import { cn } from "@/lib/utils"

const STORAGE_ACCOUNTS = "reels-sources-accounts"
const STORAGE_SECRET = "reels-sources-trigger-secret"
/** Shown only when the user has never saved accounts (key absent). */
const DEFAULT_POPULAR_ACCOUNTS = [
	"instagram",
	"cristiano",
	"kyliejenner",
	"leomessi",
	"selenagomez",
] as const

export type SourcesSubmitPayload = {
	accounts: string[]
	secret: string
}

function normalizeAccount(raw: string): string {
	return raw.trim().replace(/^@+/, "").replace(/\s+/g, "")
}

function parseStoredAccounts(raw: string | null): string[] {
	if (!raw?.trim()) return []
	try {
		const j = JSON.parse(raw) as unknown
		if (Array.isArray(j) && j.every((x) => typeof x === "string")) {
			return [...new Set(j.map(normalizeAccount).filter(Boolean))]
		}
	} catch {
		// legacy: multi-line plain text
	}
	return [
		...new Set(
			raw
				.split(/[\n,]+/)
				.map(normalizeAccount)
				.filter(Boolean),
		),
	]
}

export interface SourcesFormProps {
	/** After a successful fetch (inline mode only) */
	onSuccess?: () => void | Promise<void>
	/**
	 * For modals: parent runs the request (toast); modal closes immediately.
	 * When set, this form does not fetch on its own.
	 */
	onDelegatedSubmit?: (payload: SourcesSubmitPayload) => void
	className?: string
}

export function SourcesForm({
	onSuccess,
	onDelegatedSubmit,
	className,
}: SourcesFormProps) {
	const formId = useId()
	const accountsFieldId = `${formId}-accounts`
	const secretFieldId = `${formId}-secret`

	const [accounts, setAccounts] = useState<string[]>([])
	const [draft, setDraft] = useState("")
	const [secret, setSecret] = useState("")
	const [loading, setLoading] = useState(false)
	const [error, setError] = useState<string | null>(null)

	useEffect(() => {
		try {
			const a = localStorage.getItem(STORAGE_ACCOUNTS)
			if (a === null) {
				setAccounts([...DEFAULT_POPULAR_ACCOUNTS])
			} else {
				setAccounts(parseStoredAccounts(a))
			}
			const s = localStorage.getItem(STORAGE_SECRET)
			if (s) setSecret(s)
		} catch {
			// ignore
		}
	}, [])

	const persist = useCallback(() => {
		try {
			localStorage.setItem(STORAGE_ACCOUNTS, JSON.stringify(accounts))
			localStorage.setItem(STORAGE_SECRET, secret)
		} catch {
			// ignore
		}
	}, [accounts, secret])

	const commitDraftTokens = useCallback(
		(raw: string) => {
			const parts = raw.split(/[\n,]+/).map(normalizeAccount).filter(Boolean)
			if (parts.length === 0) return
			setAccounts((prev) => [...new Set([...prev, ...parts])])
			setDraft("")
		},
		[],
	)

	const removeAccount = (u: string) => {
		setAccounts((prev) => prev.filter((x) => x !== u))
	}

	const handleAccountsKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
		if (e.key === "Enter" || e.key === ",") {
			e.preventDefault()
			const t = normalizeAccount(draft)
			if (t) {
				setAccounts((prev) => (prev.includes(t) ? prev : [...prev, t]))
				setDraft("")
			}
			return
		}
		if (e.key === "Backspace" && draft === "" && accounts.length > 0) {
			setAccounts((prev) => prev.slice(0, -1))
		}
	}

	const handleAccountsPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
		const text = e.clipboardData.getData("text")
		if (/[\n,]/.test(text)) {
			e.preventDefault()
			commitDraftTokens(text)
		}
	}

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault()
		setError(null)
		persist()

		if (accounts.length === 0) {
			setError(
				"Add at least one username (press Enter or comma to confirm).",
			)
			return
		}

		const payload: SourcesSubmitPayload = {
			accounts,
			secret: secret.trim(),
		}

		if (onDelegatedSubmit) {
			onDelegatedSubmit(payload)
			return
		}

		setLoading(true)
		try {
			const result = await fetchSourcesMetadata(
				payload.accounts,
				payload.secret || undefined,
			)
			if (!result.ok) {
				setError(result.error)
				return
			}
			invalidateSearchIndex()
			await onSuccess?.()
		} catch {
			setError("Network error — try again.")
		} finally {
			setLoading(false)
		}
	}

	return (
		<div className={cn("flex flex-col gap-5", className)}>
			<form onSubmit={handleSubmit} className="flex flex-col gap-5">
				<div>
					<label
						htmlFor={accountsFieldId}
						className="mb-1.5 block text-xs font-medium text-foreground"
					>
						Accounts
					</label>
					<div
						className={cn(
							"flex min-h-10 flex-wrap items-center gap-1.5 rounded-xl border border-input bg-background px-2 py-2 shadow-xs",
							"outline-none transition-colors focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50",
							"dark:bg-input/30",
						)}
					>
						{accounts.map((a) => (
							<span
								key={a}
								className="inline-flex max-w-full items-center gap-1 rounded-full border border-border/80 bg-muted/90 px-2.5 py-1 text-xs font-medium text-foreground"
							>
								@{a}
								<button
									type="button"
									onClick={() => removeAccount(a)}
									className="rounded-full p-0.5 text-muted-foreground transition-colors hover:bg-background/80 hover:text-foreground"
									aria-label={`Remove ${a}`}
								>
									<X className="size-3.5 shrink-0" strokeWidth={2} />
								</button>
							</span>
						))}
						<input
							id={accountsFieldId}
							type="text"
							value={draft}
							onChange={(e) => setDraft(e.target.value)}
							onKeyDown={handleAccountsKeyDown}
							onPaste={handleAccountsPaste}
							onBlur={() => {
								const t = normalizeAccount(draft)
								if (t) {
									setAccounts((prev) =>
										prev.includes(t) ? prev : [...prev, t],
									)
									setDraft("")
								}
							}}
							placeholder={accounts.length === 0 ? "username" : ""}
							className="min-w-[8rem] flex-1 border-0 bg-transparent py-0.5 text-sm outline-none placeholder:text-muted-foreground"
							autoComplete="off"
							spellCheck={false}
						/>
					</div>
					<p className="mt-1 text-xs text-muted-foreground">
						Press Enter or comma to add; paste supports multiple lines or commas.
					</p>
				</div>

				<div>
					<label
						htmlFor={secretFieldId}
						className="mb-1.5 block text-xs font-medium text-foreground"
					>
						Secret or Instagram cookies
					</label>
					<textarea
						id={secretFieldId}
						value={secret}
						onChange={(e) => setSecret(e.target.value)}
						placeholder="Deploy password, or paste cookies (see below)"
						autoComplete="off"
						spellCheck={false}
						rows={4}
						className={cn(
							"w-full min-h-[5.5rem] resize-y rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm transition-colors outline-none",
							"placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
							"dark:bg-input/30 font-mono leading-relaxed",
						)}
					/>
					<div className="mt-2 space-y-3 text-xs text-muted-foreground leading-relaxed">
						<p>
							Use the password your host expects,{" "}
							<strong className="font-semibold text-foreground">or</strong> paste an
							Instagram session: one line like{" "}
							<span className="font-mono text-[11px] text-foreground/90">
								sessionid=…; csrftoken=…
							</span>
							, several lines, or a full{" "}
							<strong className="font-semibold text-foreground">
								Netscape / curl cookie export
							</strong>{" "}
							— any of these formats is fine.
						</p>
						<details className="rounded-lg border border-border/70 bg-muted/15 px-3 py-2 dark:bg-muted/10">
							<summary className="cursor-pointer list-none text-sm font-medium text-foreground outline-none marker:content-none [&::-webkit-details-marker]:hidden">
								<span className="underline-offset-2 hover:underline">
									Browser cookie steps
								</span>
							</summary>
							<div className="mt-3 space-y-2 border-t border-border/60 pt-3">
								<p>
									<strong className="font-semibold text-foreground">
										Chrome / Edge:
									</strong>{" "}
									Log in at{" "}
									<strong className="font-semibold text-foreground">
										instagram.com
									</strong>
									, open DevTools (
									<strong className="font-semibold text-foreground">F12</strong>
									) →{" "}
									<strong className="font-semibold text-foreground">
										Application
									</strong>{" "}
									→{" "}
									<strong className="font-semibold text-foreground">
										Cookies
									</strong>{" "}
									→{" "}
									<span className="font-mono text-[11px] text-foreground/90">
										https://www.instagram.com
									</span>
									, then copy{" "}
									<span className="font-mono text-[11px] text-foreground/90">
										sessionid
									</span>{" "}
									and{" "}
									<span className="font-mono text-[11px] text-foreground/90">
										csrftoken
									</span>{" "}
									(e.g.{" "}
									<span className="font-mono text-[11px] text-foreground/90">
										sessionid=…; csrftoken=…
									</span>
									).
								</p>
								<p>
									<strong className="font-semibold text-foreground">
										Firefox:
									</strong>{" "}
									<strong className="font-semibold text-foreground">
										Storage
									</strong>{" "}
									→{" "}
									<strong className="font-semibold text-foreground">
										Cookies
									</strong>
									. You can also paste a Netscape-format export from a cookie
									extension.
								</p>
							</div>
						</details>
						<p>
							Your cookies are only sent with your own requests to this app so the
							server can read public reel metadata — treat them like a password.
						</p>
					</div>
				</div>

				<Button
					type="submit"
					disabled={loading}
					className="w-full gap-2 sm:w-auto"
				>
					{loading ? (
						<>
							<Loader2 className="size-4 animate-spin" aria-hidden />
							Sending…
						</>
					) : (
						<>
							<CloudDownload className="size-4" aria-hidden />
							Fetch Reels metadata
						</>
					)}
				</Button>
			</form>

			{error && (
				<p className="text-sm text-destructive" role="alert">
					{error}
				</p>
			)}
		</div>
	)
}
