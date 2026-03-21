"use client"

import Link from "next/link"
import { useCallback, useEffect, useState } from "react"
import { ArrowLeft, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

const STORAGE_ACCOUNTS = "reels-sources-accounts"
const STORAGE_SECRET = "reels-sources-trigger-secret"

export function SourcesPage() {
	const [accountsText, setAccountsText] = useState("")
	const [secret, setSecret] = useState("")
	const [loading, setLoading] = useState(false)
	const [message, setMessage] = useState<string | null>(null)
	const [error, setError] = useState<string | null>(null)

	useEffect(() => {
		try {
			const a = localStorage.getItem(STORAGE_ACCOUNTS)
			if (a) setAccountsText(a)
			const s = localStorage.getItem(STORAGE_SECRET)
			if (s) setSecret(s)
		} catch {
			// ignore
		}
	}, [])

	const persist = useCallback(() => {
		try {
			localStorage.setItem(STORAGE_ACCOUNTS, accountsText)
			localStorage.setItem(STORAGE_SECRET, secret)
		} catch {
			// ignore
		}
	}, [accountsText, secret])

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault()
		setError(null)
		setMessage(null)
		persist()

		const accounts = accountsText
			.split(/[\n,]+/)
			.map((s) => s.trim().replace(/^@+/, ""))
			.filter(Boolean)

		if (accounts.length === 0) {
			setError("En az bir kullanıcı adı yazın (satır başına bir veya virgülle ayırın).")
			return
		}

		setLoading(true)
		try {
			const res = await fetch("/api/fetch-metadata", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({
					secret: secret.trim() || undefined,
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
				setError(
					[data.error, data.detail].filter(Boolean).join(": ") || "İstek başarısız",
				)
				return
			}
			const warnText =
				data.warnings?.filter(Boolean).join("\n") ?? ""
			const persistNote = data.persisted === false
				? "\n\nNot: R2’ye yazılamadı — üretimde Wrangler’da REELS_BUCKET bağlayın."
				: ""
			const body = [data.message, warnText ? `Uyarılar:\n${warnText}` : "", persistNote]
				.filter(Boolean)
				.join("\n\n")

			if (data.ok === false) {
				setError(body || "Çekim başarısız")
				return
			}
			setMessage(body)
		} catch {
			setError("Ağ hatası — tekrar deneyin.")
		} finally {
			setLoading(false)
		}
	}

	return (
		<div className="min-h-screen bg-background text-foreground">
			<header className="sticky top-0 z-10 border-b border-border/80 bg-background/95 backdrop-blur-sm px-4 py-3">
				<div className="mx-auto flex max-w-lg items-center gap-3">
					<Button variant="ghost" size="icon-sm" asChild className="shrink-0">
						<Link href="/" aria-label="Videolara dön">
							<ArrowLeft className="size-5" />
						</Link>
					</Button>
					<h1 className="text-sm font-semibold tracking-tight">
						Kaynak hesaplar
					</h1>
				</div>
			</header>

			<main className="mx-auto max-w-lg px-4 py-6 pb-12">
				<p className="mb-4 text-sm text-muted-foreground leading-relaxed">
					Takip etmek istediğiniz Instagram kullanıcı adlarını girin (@ olmadan). Bu sayfada video
					yok; sunucu Instagram’a doğrudan istek atar, gelen verileri indekse ekler (R2
					bağlıysa <code className="rounded bg-muted px-1 text-[11px]">index.json</code> güncellenir).
				</p>

				<form onSubmit={handleSubmit} className="flex flex-col gap-4">
					<div>
						<label
							htmlFor="accounts"
							className="mb-1.5 block text-xs font-medium text-foreground"
						>
							Hesaplar
						</label>
						<textarea
							id="accounts"
							value={accountsText}
							onChange={(e) => setAccountsText(e.target.value)}
							rows={8}
							placeholder={"axiomism\nbaska_hesap"}
							className={cn(
								"w-full resize-y rounded-md border border-input bg-transparent px-3 py-2 text-sm",
								"shadow-xs outline-none placeholder:text-muted-foreground",
								"focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50",
								"dark:bg-input/30",
							)}
							autoComplete="off"
							spellCheck={false}
						/>
						<p className="mt-1 text-xs text-muted-foreground">
							Satır başına bir ad veya virgülle ayırın.
						</p>
					</div>

					<div>
						<label
							htmlFor="trigger-secret"
							className="mb-1.5 block text-xs font-medium text-foreground"
						>
							Tetikleme anahtarı
						</label>
						<Input
							id="trigger-secret"
							type="password"
							value={secret}
							onChange={(e) => setSecret(e.target.value)}
							placeholder="Cloudflare / .env ile aynı FETCH_TRIGGER_SECRET"
							autoComplete="off"
						/>
						<p className="mt-1 text-xs text-muted-foreground">
							Üretimde sunucuda{" "}
							<code className="rounded bg-muted px-1 py-0.5 text-[11px]">FETCH_TRIGGER_SECRET</code>{" "}
							tanımlayın ve buraya aynı değeri girin. Tanımlı değilse yalnızca yerel denemede
							anahtarsız kabul edilir. Asıl oturum için{" "}
							<code className="rounded bg-muted px-1 py-0.5 text-[11px]">INSTAGRAM_COOKIES</code>{" "}
							(secret) gerekir — tarayıcıda giriş yaptıktan sonra istek başlığındaki{" "}
							<code className="rounded bg-muted px-1 py-0.5 text-[11px]">Cookie</code> değerini
							kopyalayın.
						</p>
					</div>

					<Button type="submit" disabled={loading} className="w-full sm:w-auto">
						{loading ? (
							<>
								<Loader2 className="size-4 animate-spin" aria-hidden />
								Gönderiliyor…
							</>
						) : (
							"Reels metadata çek"
						)}
					</Button>
				</form>

				{error && (
					<p
						className="mt-4 text-sm text-destructive"
						role="alert"
					>
						{error}
					</p>
				)}
				{message && (
					<p className="mt-4 text-sm text-muted-foreground">{message}</p>
				)}
			</main>
		</div>
	)
}
