"use client"

import { Card, CardContent, CardFooter } from "@/components/ui/card"
import { usePlayingVideo } from "@/contexts/PlayingVideoContext"
import { useReelsScrollRoot } from "@/contexts/ReelsScrollRootContext"
import { useInView } from "@/hooks/useInView"
import {
	proxiedImageUrl,
	proxiedImageUrlAbsolute,
} from "@/lib/media-url"
import type { MediaItem } from "@/lib/types"
import { cn } from "@/lib/utils"
import { Bookmark, Calendar, Heart, Volume2, VolumeX } from "lucide-react"
import { useEffect, useRef, useState, type CSSProperties } from "react"

interface MediaCardProps {
	item: MediaItem
	listIndex: number
	onOpenDetail: (index: number) => void
	/** When set, grid video is paused (e.g. detail modal open). */
	gridVideoSuspended?: boolean
	/** True when the global detail dialog is showing this card's post. */
	isDetailOpen?: boolean
	isBookmarked?: boolean
	onToggleBookmark?: (mediaId: string) => void
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

/** Compact glass-style controls on the media frame (bookmark + sound). */
const mediaChromeButtonClass =
	"z-[4] flex size-7 cursor-pointer items-center justify-center rounded-full border border-border/40 bg-background/30 text-foreground shadow-sm backdrop-blur-md transition-[background-color,box-shadow] hover:bg-background/45 hover:shadow-md active:scale-95"

function shouldIgnoreCardClick(target: EventTarget | null): boolean {
	if (!(target instanceof HTMLElement)) return false
	return Boolean(
		target.closest("a[href]") ||
			target.closest("[data-prevent-card-open]") ||
			target.closest('[role="slider"]'),
	)
}

export function MediaCard({
	item,
	listIndex,
	onOpenDetail,
	gridVideoSuspended = false,
	isDetailOpen = false,
	isBookmarked = false,
	onToggleBookmark,
	className,
}: MediaCardProps) {
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
	const [gridSoundOn, setGridSoundOn] = useState(false)
	useEffect(() => {
		setVideoSurfaceReady(false)
		setGridSoundOn(false)
	}, [item.id])

	// Keep aspect ratio fixed from index metadata only — using decoded video dimensions
	// changes the box after load and retriggers virtualizer measure (scroll jump).
	const frameStyle = aspectRatioStyle(item.width, item.height)

	const reelsScrollRoot = useReelsScrollRoot()
	const { ref, inView } = useInView({
		root: reelsScrollRoot,
		rootMargin: "320px 0px",
	})

	const videoRef = useRef<HTMLVideoElement>(null)
	const wasInViewRef = useRef(false)
	const { playingId, setPlayingId } = usePlayingVideo()

	useEffect(() => {
		if (!gridVideoSuspended) return
		if (videoRef.current && !videoRef.current.paused) {
			videoRef.current.pause()
			if (playingId === item.id) setPlayingId(null)
		}
	}, [gridVideoSuspended, playingId, item.id, setPlayingId])

	useEffect(() => {
		if (!hasVideo || !videoRef.current) {
			wasInViewRef.current = inView
			return
		}
		const v = videoRef.current
		const leftView = wasInViewRef.current && !inView
		wasInViewRef.current = inView
		if (!inView) {
			if (!v.paused) {
				v.pause()
				if (playingId === item.id) setPlayingId(null)
			}
			if (leftView) {
				v.muted = true
				setGridSoundOn(false)
			}
		}
	}, [inView, hasVideo, playingId, item.id, setPlayingId])

	/** Autoplay in view; muted unless user turned sound on for this tile. */
	useEffect(() => {
		if (!hasVideo || !inView || gridVideoSuspended) return
		const v = videoRef.current
		if (!v) return
		v.muted = !gridSoundOn
		if (gridSoundOn) v.volume = 1
		void v.play().catch(() => {})
	}, [
		hasVideo,
		inView,
		gridVideoSuspended,
		item.id,
		item.video_url,
		gridSoundOn,
	])

	const handleCardClick = (e: React.MouseEvent<HTMLDivElement>) => {
		if (shouldIgnoreCardClick(e.target)) return
		onOpenDetail(listIndex)
	}

	const handleCardKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
		if (e.key !== "Enter" && e.key !== " ") return
		if (shouldIgnoreCardClick(e.target)) return
		e.preventDefault()
		onOpenDetail(listIndex)
	}

	const videoWidthAttr =
		item.width && item.width > 0 ? Math.round(item.width) : undefined
	const videoHeightAttr =
		item.height && item.height > 0 ? Math.round(item.height) : undefined

	return (
		<Card
			tabIndex={0}
			aria-haspopup="dialog"
			aria-expanded={isDetailOpen}
			aria-label={`@${item.username} post — click or press Enter for details`}
			onClick={handleCardClick}
			onKeyDown={handleCardKeyDown}
			className={cn(
				"box-border h-auto min-h-0 w-full max-w-full cursor-pointer overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm outline-none md:hover:shadow-md focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background py-0 gap-3 [contain:layout]",
				className,
			)}
		>
				<CardContent className="relative min-h-0 p-0" ref={ref}>
					{onToggleBookmark ? (
						<button
							type="button"
							data-prevent-card-open
							className={cn(
								"absolute right-1.5 top-1.5",
								mediaChromeButtonClass,
								isBookmarked && "text-amber-600",
							)}
							title={
								isBookmarked ? "Remove from bookmarks" : "Save to bookmarks"
							}
							aria-label={
								isBookmarked ? "Remove from bookmarks" : "Save to bookmarks"
							}
							aria-pressed={isBookmarked}
							onClick={(e) => {
								e.preventDefault()
								e.stopPropagation()
								onToggleBookmark(item.id)
							}}
						>
							<Bookmark
								className={cn("size-3.5", isBookmarked && "fill-amber-400")}
								strokeWidth={2}
							/>
						</button>
					) : null}
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
								autoPlay
								muted={!gridSoundOn}
								loop
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
							<button
								type="button"
								data-prevent-card-open
								className={cn(
									"absolute bottom-1.5 right-1.5",
									mediaChromeButtonClass,
									gridSoundOn && "text-primary",
								)}
								title={gridSoundOn ? "Mute" : "Unmute"}
								aria-label={gridSoundOn ? "Mute video" : "Unmute video"}
								aria-pressed={gridSoundOn}
								onClick={(e) => {
									e.preventDefault()
									e.stopPropagation()
									setGridSoundOn((on) => {
										const next = !on
										const v = videoRef.current
										if (v) {
											v.muted = !next
											if (next) v.volume = 1
											void v.play().catch(() => {})
										}
										return next
									})
								}}
							>
								{gridSoundOn ? (
									<Volume2 className="size-3.5" strokeWidth={2} />
								) : (
									<VolumeX className="size-3.5" strokeWidth={2} />
								)}
							</button>
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
	)
}
