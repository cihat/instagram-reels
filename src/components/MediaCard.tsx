"use client"

import { Card, CardContent, CardFooter } from "@/components/ui/card"
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogTitle,
} from "@/components/ui/dialog"
import { usePlayingVideo } from "@/contexts/PlayingVideoContext"
import { useReelsScrollRoot } from "@/contexts/ReelsScrollRootContext"
import { useInView } from "@/hooks/useInView"
import {
	proxiedImageUrl,
	proxiedImageUrlAbsolute,
} from "@/lib/media-url"
import type { MediaItem } from "@/lib/types"
import { cn } from "@/lib/utils"
import { Calendar, ExternalLink, Heart, User } from "lucide-react"
import { useEffect, useRef, useState, type CSSProperties } from "react"

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
	return d.toLocaleDateString("en-US", {
		day: "numeric",
		month: "short",
		year: "numeric",
	})
}

function aspectRatioStyle(
	w: number | undefined,
	h: number | undefined,
): CSSProperties {
	if (w && h && w > 0 && h > 0) {
		return { aspectRatio: `${w} / ${h}` }
	}
	return { aspectRatio: "9 / 16" }
}

const mediaFrameClass =
	"relative w-full min-h-0 overflow-hidden rounded-lg bg-black"

const mediaFitClass =
	"absolute inset-0 h-full w-full object-contain object-center"

function shouldIgnoreCardClick(target: EventTarget | null): boolean {
	if (!(target instanceof HTMLElement)) return false
	return Boolean(
		target.closest("a[href]") ||
			target.closest("video") ||
			target.closest("button") ||
			target.closest('[role="slider"]'),
	)
}

export function MediaCard({ item, className }: MediaCardProps) {
	const snippet = truncate(item.description || "No description", 100)
	const hasVideo = Boolean(item.video_url?.trim())
	const rawThumb = item.display_url?.trim() || ""
	const thumbForLayer = rawThumb.length > 0

	const [imgOrigin, setImgOrigin] = useState("")
	useEffect(() => {
		setImgOrigin(typeof window !== "undefined" ? window.location.origin : "")
	}, [])

	const [imgSrc, setImgSrc] = useState("")
	useEffect(() => {
		const abs = proxiedImageUrlAbsolute(rawThumb, imgOrigin || undefined)
		const rel = proxiedImageUrl(rawThumb)
		setImgSrc(abs || rel || rawThumb || "")
	}, [rawThumb, imgOrigin])

	const posterAttr =
		proxiedImageUrlAbsolute(rawThumb, imgOrigin || undefined) ??
		proxiedImageUrl(rawThumb) ??
		(rawThumb.length > 0 ? rawThumb : undefined)

	const [videoSurfaceReady, setVideoSurfaceReady] = useState(false)
	const [modalVideoReady, setModalVideoReady] = useState(false)
	useEffect(() => {
		setVideoSurfaceReady(false)
		setModalVideoReady(false)
	}, [item.id])

	const [detailOpen, setDetailOpen] = useState(false)

	// Keep aspect ratio fixed from index metadata only — using decoded video dimensions
	// changes the box after load and retriggers virtualizer measure (scroll jump).
	const frameStyle = aspectRatioStyle(item.width, item.height)

	const reelsScrollRoot = useReelsScrollRoot()
	const { ref, inView } = useInView({
		root: reelsScrollRoot,
		rootMargin: "320px 0px",
	})

	useEffect(() => {
		if (!detailOpen) setModalVideoReady(false)
	}, [detailOpen])

	const videoRef = useRef<HTMLVideoElement>(null)
	const modalVideoRef = useRef<HTMLVideoElement>(null)
	const { playingId, setPlayingId } = usePlayingVideo()

	useEffect(() => {
		if (
			playingId !== null &&
			playingId !== item.id &&
			videoRef.current &&
			!videoRef.current.paused
		) {
			videoRef.current.pause()
		}
		if (
			playingId !== null &&
			playingId !== item.id &&
			modalVideoRef.current &&
			!modalVideoRef.current.paused
		) {
			modalVideoRef.current.pause()
		}
	}, [playingId, item.id])

	useEffect(() => {
		if (!inView && hasVideo && videoRef.current && !videoRef.current.paused) {
			videoRef.current.pause()
			if (playingId === item.id) setPlayingId(null)
		}
	}, [inView, hasVideo, playingId, item.id, setPlayingId])

	useEffect(() => {
		if (detailOpen) {
			videoRef.current?.pause()
		} else {
			modalVideoRef.current?.pause()
			if (playingId === item.id) setPlayingId(null)
		}
	}, [detailOpen, playingId, item.id, setPlayingId])

	const handleDetailOpenChange = (open: boolean) => {
		setDetailOpen(open)
		if (!open) {
			modalVideoRef.current?.pause()
			if (playingId === item.id) setPlayingId(null)
		}
	}

	const handleCardClick = (e: React.MouseEvent<HTMLDivElement>) => {
		if (shouldIgnoreCardClick(e.target)) return
		setDetailOpen(true)
	}

	const handleCardKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
		if (e.key !== "Enter" && e.key !== " ") return
		if (shouldIgnoreCardClick(e.target)) return
		e.preventDefault()
		setDetailOpen(true)
	}

	const videoWidthAttr =
		item.width && item.width > 0 ? Math.round(item.width) : undefined
	const videoHeightAttr =
		item.height && item.height > 0 ? Math.round(item.height) : undefined

	const fullDescription =
		item.description?.trim() || "No description."

	return (
		<>
			<Card
				tabIndex={0}
				aria-haspopup="dialog"
				aria-expanded={detailOpen}
				aria-label={`@${item.username} post — click or press Enter for details`}
				onClick={handleCardClick}
				onKeyDown={handleCardKeyDown}
				className={cn(
					"box-border h-auto min-h-0 w-full max-w-full cursor-pointer overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm outline-none md:hover:shadow-md focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background py-0 gap-3 [contain:layout]",
					className,
				)}
			>
				<CardContent className="min-h-0 p-0" ref={ref}>
					{hasVideo ? (
						<div
							className={cn(mediaFrameClass, "isolate")}
							style={frameStyle}
						>
							<video
								ref={videoRef}
								className={cn(
									mediaFitClass,
									"reel-grid-video",
									videoSurfaceReady
										? "z-[2] opacity-100"
										: "z-0 opacity-0 pointer-events-none",
								)}
								src={item.video_url}
								poster={thumbForLayer ? undefined : posterAttr}
								width={videoWidthAttr}
								height={videoHeightAttr}
								controls
								preload={inView ? "metadata" : "none"}
								playsInline
								onLoadedData={() => setVideoSurfaceReady(true)}
								onError={() => setVideoSurfaceReady(true)}
								onPlay={() => setPlayingId(item.id)}
								onPause={() => {
									if (playingId === item.id) setPlayingId(null)
								}}
							>
								Your browser does not support the video tag.
							</video>
							{thumbForLayer ? (
								// eslint-disable-next-line @next/next/no-img-element -- proxy / external CDN
								<img
									src={imgSrc || rawThumb}
									alt=""
									className={cn(
										mediaFitClass,
										"transition-opacity duration-150",
										videoSurfaceReady
											? "z-[1] opacity-0 pointer-events-none"
											: "z-[3]",
									)}
									loading="lazy"
									decoding="async"
									referrerPolicy="no-referrer"
									onError={() => {
										const abs = proxiedImageUrlAbsolute(
											rawThumb,
											imgOrigin || undefined,
										)
										const rel = proxiedImageUrl(rawThumb)
										if (abs && imgSrc === abs && rel) {
											setImgSrc(rel)
											return
										}
										if (rawThumb && imgSrc !== rawThumb) {
											setImgSrc(rawThumb)
										}
									}}
								/>
							) : null}
						</div>
					) : rawThumb ? (
						<div className={cn(mediaFrameClass, "block")} style={frameStyle}>
							{/* eslint-disable-next-line @next/next/no-img-element -- proxy / external CDN */}
							<img
								src={imgSrc || rawThumb}
								alt=""
								className={mediaFitClass}
								loading="lazy"
								decoding="async"
								referrerPolicy="no-referrer"
								onError={() => {
									const abs = proxiedImageUrlAbsolute(
										rawThumb,
										imgOrigin || undefined,
									)
									const rel = proxiedImageUrl(rawThumb)
									if (abs && imgSrc === abs && rel) {
										setImgSrc(rel)
										return
									}
									if (rawThumb && imgSrc !== rawThumb) {
										setImgSrc(rawThumb)
									}
								}}
							/>
						</div>
					) : (
						<div
							className={cn(
								mediaFrameClass,
								"flex items-center justify-center text-muted-foreground text-xs",
							)}
							style={frameStyle}
						>
							Video
						</div>
					)}
				</CardContent>

				<CardFooter className="flex flex-col items-stretch gap-2 px-3 py-2.5">
					<div className="flex flex-wrap items-center gap-2 text-muted-foreground">
						<span className="inline-flex items-center gap-1 text-xs">
							<Calendar className="size-3.5 shrink-0" />
							{formatDate(item.post_date)}
						</span>
						<span className="inline-flex items-center gap-1.5 text-xs">
							<Heart className="size-3.5 shrink-0" strokeWidth={1.8} />
							{item.likes > 0 ? item.likes.toLocaleString("en-US") : "0"}
						</span>
					</div>
					<p className="line-clamp-2 text-left text-xs text-muted-foreground">
						{snippet}
					</p>
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

			<Dialog open={detailOpen} onOpenChange={handleDetailOpenChange}>
				<DialogContent
					showCloseButton
					className="flex max-h-[min(92vh,900px)] w-[min(96vw,960px)] max-w-[min(96vw,960px)] flex-col gap-0 overflow-hidden rounded-2xl p-0 sm:max-w-[min(96vw,960px)]"
				>
					<DialogTitle className="sr-only">
						@{item.username} — {truncate(fullDescription, 80)}
					</DialogTitle>
					<DialogDescription className="sr-only">
						{fullDescription}
					</DialogDescription>

					<div className="flex min-h-0 flex-1 flex-col md:flex-row md:max-h-[min(88vh,860px)]">
						<div className="relative flex min-h-[200px] flex-1 items-center justify-center bg-black md:min-h-0 md:max-w-[min(48%,420px)]">
							{hasVideo ? (
								<div className="relative flex h-full min-h-[200px] w-full items-center justify-center">
									<video
										ref={modalVideoRef}
										className={cn(
											"reel-grid-video max-h-[min(50vh,720px)] w-full max-w-full object-contain md:max-h-[min(82vh,800px)]",
											modalVideoReady
												? "relative z-[2] opacity-100"
												: "absolute inset-0 z-0 mx-auto max-h-[min(50vh,720px)] w-full max-w-full object-contain opacity-0 pointer-events-none md:max-h-[min(82vh,800px)]",
										)}
										src={item.video_url}
										poster={thumbForLayer ? undefined : posterAttr}
										width={videoWidthAttr}
										height={videoHeightAttr}
										controls
										preload="metadata"
										playsInline
										onLoadedData={() => setModalVideoReady(true)}
										onError={() => setModalVideoReady(true)}
										onPlay={() => setPlayingId(item.id)}
										onPause={() => {
											if (playingId === item.id) setPlayingId(null)
										}}
									>
										Your browser does not support the video tag.
									</video>
									{thumbForLayer ? (
										// eslint-disable-next-line @next/next/no-img-element -- proxy / external CDN
										<img
											src={imgSrc || rawThumb}
											alt=""
											className={cn(
												"absolute inset-0 z-[3] m-auto max-h-[min(50vh,720px)] w-full max-w-full object-contain transition-opacity duration-150 md:max-h-[min(82vh,800px)]",
												modalVideoReady &&
													"z-[1] opacity-0 pointer-events-none",
											)}
											decoding="async"
											referrerPolicy="no-referrer"
										/>
									) : null}
								</div>
							) : rawThumb ? (
								// eslint-disable-next-line @next/next/no-img-element -- proxy / external CDN
								<img
									src={imgSrc || rawThumb}
									alt=""
									className="max-h-[min(50vh,720px)] w-full max-w-full object-contain md:max-h-[min(82vh,800px)]"
									referrerPolicy="no-referrer"
								/>
							) : null}
						</div>

						<div className="flex max-h-[42vh] min-h-0 w-full flex-col gap-3 overflow-y-auto border-t border-border p-4 md:max-h-none md:w-[min(100%,400px)] md:shrink-0 md:border-t-0 md:border-l">
							<div className="flex items-start gap-2">
								<User
									className="mt-0.5 size-4 shrink-0 text-muted-foreground"
									aria-hidden
								/>
								<div className="min-w-0">
									<p className="font-semibold leading-tight">
										{item.fullname || item.username}
									</p>
									<p className="text-sm text-muted-foreground">
										@{item.username}
									</p>
								</div>
							</div>

							<p className="whitespace-pre-wrap break-words text-sm leading-relaxed">
								{fullDescription}
							</p>

							{item.tags.length > 0 && (
								<div className="flex flex-wrap gap-1.5">
									{item.tags.map((tag) => (
										<span
											key={tag}
											className="rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground"
										>
											#{tag}
										</span>
									))}
								</div>
							)}

							<div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
								<span className="inline-flex items-center gap-1.5">
									<Calendar className="size-4 shrink-0" />
									{formatDate(item.post_date)}
								</span>
								<span className="inline-flex items-center gap-1.5">
									<Heart className="size-4 shrink-0" strokeWidth={1.8} />
									{item.likes > 0
										? item.likes.toLocaleString("en-US")
										: "0"}{" "}
									likes
								</span>
							</div>

							<a
								href={item.post_url}
								target="_blank"
								rel="noopener noreferrer"
								className="inline-flex w-fit items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium transition-colors hover:bg-muted"
							>
								<ExternalLink className="size-4" />
								Open on Instagram
							</a>
						</div>
					</div>
				</DialogContent>
			</Dialog>
		</>
	)
}
