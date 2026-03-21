import { getCloudflareContext } from "@opennextjs/cloudflare"
import { fetchReelsForUser } from "@/lib/instagram-reels"
import type { MediaItem } from "@/lib/types"
import { NextResponse } from "next/server"

function getEnv(name: string): string | undefined {
	const v = process.env[name]
	return typeof v === "string" && v.length > 0 ? v : undefined
}

function normalizeAccounts(raw: unknown): string[] {
	if (!Array.isArray(raw)) return []
	const out: string[] = []
	const seen = new Set<string>()
	for (const x of raw) {
		if (typeof x !== "string") continue
		const u = x.trim().replace(/^@+/, "").replace(/\s+/g, "")
		if (!u || seen.has(u)) continue
		seen.add(u)
		out.push(u)
	}
	return out
}

function mergeByShortcode(existing: MediaItem[], incoming: MediaItem[]): MediaItem[] {
	const map = new Map<string, MediaItem>()
	for (const i of existing) {
		map.set(i.shortcode || i.id, i)
	}
	for (const i of incoming) {
		map.set(i.shortcode || i.id, i)
	}
	return [...map.values()]
}

const MAX_ACCOUNTS_PER_REQUEST = 8

/**
 * Instagram’a doğrudan fetch; sonucu R2 `index.json` ile birleştirir (binding varsa).
 */
export async function POST(request: Request) {
	let body: { secret?: string; accounts?: unknown }
	try {
		body = (await request.json()) as { secret?: string; accounts?: unknown }
	} catch {
		return NextResponse.json({ error: "Geçersiz JSON" }, { status: 400 })
	}

	const expectedSecret = getEnv("FETCH_TRIGGER_SECRET")
	if (expectedSecret && body.secret !== expectedSecret) {
		return NextResponse.json({ error: "Yetkisiz" }, { status: 401 })
	}

	const cookie = getEnv("INSTAGRAM_COOKIES")
	if (!cookie) {
		return NextResponse.json(
			{
				error:
					"INSTAGRAM_COOKIES tanımlı değil. Tarayıcıdan kopyaladığınız Cookie üstbilgisini (sessionid, csrftoken, …) Cloudflare secret / .dev.vars olarak ekleyin.",
			},
			{ status: 503 },
		)
	}

	const accounts = normalizeAccounts(body.accounts)
	if (accounts.length === 0) {
		return NextResponse.json(
			{ error: "En az bir geçerli kullanıcı adı gerekli" },
			{ status: 400 },
		)
	}

	if (accounts.length > MAX_ACCOUNTS_PER_REQUEST) {
		return NextResponse.json(
			{
				error: `En fazla ${MAX_ACCOUNTS_PER_REQUEST} hesap (üst sınır).`,
			},
			{ status: 400 },
		)
	}

	let bucket: R2Bucket | undefined
	try {
		const { env } = await getCloudflareContext({ async: true })
		bucket = env.REELS_BUCKET
	} catch {
		bucket = undefined
	}

	const allWarnings: string[] = []
	const fetched: MediaItem[] = []

	for (const u of accounts) {
		const { items, warnings } = await fetchReelsForUser(u, cookie)
		allWarnings.push(...warnings)
		fetched.push(...items)
	}

	let existing: MediaItem[] = []
	if (bucket) {
		try {
			const obj = await bucket.get("index.json")
			if (obj) {
				const parsed = JSON.parse(await obj.text()) as unknown
				if (Array.isArray(parsed)) existing = parsed as MediaItem[]
			}
		} catch {
			allWarnings.push("Mevcut index.json okunamadı; yalnızca yeni öğeler yazılacak.")
		}
	}

	const merged = mergeByShortcode(existing, fetched)

	let persisted = false
	if (bucket) {
		try {
			await bucket.put("index.json", JSON.stringify(merged), {
				httpMetadata: { contentType: "application/json" },
			})
			persisted = true
		} catch (e) {
			allWarnings.push(
				`R2 yazılamadı: ${e instanceof Error ? e.message : String(e)}`,
			)
		}
	} else {
		allWarnings.push(
			"REELS_BUCKET bağlı değil — bu ortamda index kalıcı güncellenmedi (OpenNext/Wrangler ile R2 ekleyin).",
		)
	}

	const message =
		fetched.length === 0
			? persisted
				? "Yeni öğe yok; mevcut index korundu. Uyarıları okuyun."
				: "Yeni öğe çekilemedi. Uyarıları okuyun."
			: persisted
				? "Metadata çekildi ve index güncellendi. Sayfayı yenileyin."
				: "Metadata çekildi; R2 yoksa uygulama eski index’i gösterebilir."

	return NextResponse.json({
		ok: fetched.length > 0,
		persisted,
		accounts,
		fetchedCount: fetched.length,
		mergedCount: merged.length,
		warnings: allWarnings,
		message,
	})
}
