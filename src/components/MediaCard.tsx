"use client"

import { Card, CardContent, CardFooter } from "@/components/ui/card"
import { usePlayingVideo } from "@/contexts/PlayingVideoContext"
import { useInView } from "@/hooks/useInView"
import type { MediaItem } from "@/lib/types"
import { cn } from "@/lib/utils"
import { Calendar, ExternalLink, Heart } from "lucide-react"
import { useEffect, useRef } from "react"

interface MediaCardProps {
	item: MediaItem
	className?: string
}

function truncate(str: string, max: number) {
	if (str.length <= max) return str
	return str.slice(0, max) + "…"
}

function formatDate(dateStr: string): string {
	if (!dateStr?.trim()) return "—"
	const d = new Date(dateStr.replace(" ", "T"))
	if (Number.isNaN(d.getTime())) return dateStr
	return d.toLocaleDateString("tr-TR", {
		day: "numeric",
		month: "short",
		year: "numeric",
	})
}

const mediaPlaceholderClass =
	"aspect-[9/16] w-full rounded-lg object-cover bg-muted"

export function MediaCard({ item, className }: MediaCardProps) {
	const snippet = truncate(item.description || "Açıklama yok", 100)
	const hasVideo = Boolean(item.video_url?.trim())
	const { ref, inView } = useInView({ rootMargin: "200px" })
	const videoRef = useRef<HTMLVideoElement>(null)
	const { playingId, setPlayingId } = usePlayingVideo()

	useEffect(() => {
		if (playingId !== null && playingId !== item.id && videoRef.current && !videoRef.current.paused) {
			videoRef.current.pause()
		}
	}, [playingId, item.id])

	useEffect(() => {
		if (!inView && hasVideo && videoRef.current && !videoRef.current.paused) {
			videoRef.current.pause()
			if (playingId === item.id) setPlayingId(null)
		}
	}, [inView, hasVideo, playingId, item.id, setPlayingId])

	return (
		<Card
			className={cn(
				"min-h-0 w-full overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm transition-shadow hover:shadow-md py-0 gap-3",
				className,
			)}
		>
			<CardContent className="min-h-0 p-0" ref={ref}>
				{!inView ? (
					<div
						className={cn(
							mediaPlaceholderClass,
							"flex items-center justify-center",
						)}
					>
						<span className="text-muted-foreground text-xs">Yükleniyor…</span>
					</div>
				) : hasVideo ? (
					<video
						ref={videoRef}
						src={item.video_url}
						poster={item.display_url || undefined}
						controls
						preload="metadata"
						playsInline
						className={cn(mediaPlaceholderClass, "object-cover")}
						onPlay={() => setPlayingId(item.id)}
						onPause={() => {
							if (playingId === item.id) setPlayingId(null)
						}}
					>
						Tarayıcınız video etiketini desteklemiyor.
					</video>
				) : item.display_url ? (
					<a
						href={item.post_url}
						target="_blank"
						rel="noopener noreferrer"
						className="block"
					>
						{/* eslint-disable-next-line @next/next/no-img-element -- external Instagram CDN */}
						<img
							src={item.display_url}
							alt=""
							className={cn(mediaPlaceholderClass, "object-cover")}
							loading="lazy"
						/>
					</a>
				) : (
					<a
						href={item.post_url}
						target="_blank"
						rel="noopener noreferrer"
						className="block"
					>
						<div
							className={cn(
								mediaPlaceholderClass,
								"flex items-center justify-center text-muted-foreground text-xs",
							)}
						>
							Video
						</div>
					</a>
				)}
			</CardContent>

			<CardFooter className="flex flex-col items-stretch gap-2 px-3 py-2.5">
				<div className="flex flex-wrap items-center justify-between gap-2">
					<div className="flex items-center gap-2 text-muted-foreground">
						<span className="inline-flex items-center gap-1 text-xs">
							<Calendar className="size-3.5 shrink-0" />
							{formatDate(item.post_date)}
						</span>
						<span className="inline-flex items-center gap-1.5 text-xs">
							<Heart className="size-3.5 shrink-0" strokeWidth={1.8} />
							{item.likes > 0 ? item.likes.toLocaleString("tr-TR") : "0"}
						</span>
					</div>
					<a
						href={item.post_url}
						target="_blank"
						rel="noopener noreferrer"
						className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
						title={"Gönderiyi Instagram\u2019da aç"}
					>
						<ExternalLink className="size-3.5" />
						{"Instagram\u2019da aç"}
					</a>
				</div>
				<p className="line-clamp-2 text-xs text-muted-foreground">{snippet}</p>
				{item.tags.length > 0 && (
					<div className="flex flex-wrap gap-1">
						{item.tags.slice(0, 4).map((tag) => (
							<span
								key={tag}
								className="rounded bg-muted/80 px-1.5 py-0.5 text-[10px] text-muted-foreground"
							>
								{tag}
							</span>
						))}
						{item.tags.length > 4 && (
							<span className="text-[10px] text-muted-foreground">
								+{item.tags.length - 4}
							</span>
						)}
					</div>
				)}
			</CardFooter>
		</Card>
	)
}
