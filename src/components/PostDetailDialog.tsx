"use client"

import { Button } from "@/components/ui/button"
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogTitle,
} from "@/components/ui/dialog"
import { usePlayingVideo } from "@/contexts/PlayingVideoContext"
import {
	proxiedImageUrl,
	proxiedImageUrlAbsolute,
} from "@/lib/media-url"
import type { MediaItem } from "@/lib/types"
import { cn } from "@/lib/utils"
import {
	Calendar,
	ChevronLeft,
	ChevronRight,
	ExternalLink,
	Heart,
	User,
} from "lucide-react"
import { useCallback, useEffect, useRef, useState } from "react"

type SlideMode = "fade" | "next" | "prev"

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

const mediaFitClass =
	"absolute inset-0 h-full w-full object-contain object-center"

export interface PostDetailDialogProps {
	item: MediaItem
	open: boolean
	onOpenChange: (open: boolean) => void
	canGoPrev: boolean
	canGoNext: boolean
	onGoPrev: () => void
	onGoNext: () => void
}

export function PostDetailDialog({
	item,
	open,
	onOpenChange,
	canGoPrev,
	canGoNext,
	onGoPrev,
	onGoNext,
}: PostDetailDialogProps) {
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

	const [modalVideoReady, setModalVideoReady] = useState(false)
	useEffect(() => {
		setModalVideoReady(false)
	}, [item.id])

	useEffect(() => {
		if (!open) setModalVideoReady(false)
	}, [open])

	const modalVideoRef = useRef<HTMLVideoElement>(null)
	const { playingId, setPlayingId } = usePlayingVideo()

	const [slideMode, setSlideMode] = useState<SlideMode>("fade")

	useEffect(() => {
		if (!open) setSlideMode("fade")
	}, [open])

	const handlePrev = useCallback(() => {
		if (!canGoPrev) return
		setSlideMode("prev")
		onGoPrev()
	}, [canGoPrev, onGoPrev])

	const handleNext = useCallback(() => {
		if (!canGoNext) return
		setSlideMode("next")
		onGoNext()
	}, [canGoNext, onGoNext])

	useEffect(() => {
		if (
			playingId !== null &&
			playingId !== item.id &&
			modalVideoRef.current &&
			!modalVideoRef.current.paused
		) {
			modalVideoRef.current.pause()
		}
	}, [playingId, item.id])

	const handleOpenChange = (next: boolean) => {
		onOpenChange(next)
		if (!next) {
			modalVideoRef.current?.pause()
			if (playingId === item.id) setPlayingId(null)
		}
	}

	useEffect(() => {
		if (!open) return
		const onKey = (e: KeyboardEvent) => {
			const left = e.key === "ArrowLeft" || e.code === "ArrowLeft"
			const right = e.key === "ArrowRight" || e.code === "ArrowRight"
			if (left && canGoPrev) {
				e.preventDefault()
				e.stopPropagation()
				handlePrev()
			} else if (right && canGoNext) {
				e.preventDefault()
				e.stopPropagation()
				handleNext()
			}
		}
		window.addEventListener("keydown", onKey, true)
		return () => window.removeEventListener("keydown", onKey, true)
	}, [open, canGoPrev, canGoNext, handlePrev, handleNext])

	const videoWidthAttr =
		item.width && item.width > 0 ? Math.round(item.width) : undefined
	const videoHeightAttr =
		item.height && item.height > 0 ? Math.round(item.height) : undefined

	const fullDescription =
		item.description?.trim() || "No description."

	const navButtonClass =
		"absolute top-1/2 z-20 h-11 w-11 -translate-y-1/2 rounded-full border border-white/20 bg-black/55 text-white shadow-md backdrop-blur-sm hover:bg-black/55 hover:text-white active:-translate-y-1/2 touch-manipulation"

	return (
		<Dialog open={open} onOpenChange={handleOpenChange}>
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

				<div
					key={item.id}
					className={cn(
						"flex min-h-0 flex-1 flex-col overflow-hidden",
						"md:grid md:h-[min(82vh,800px)] md:max-h-[min(88vh,860px)] md:min-h-0 md:grid-cols-[minmax(0,min(420px,48%))_minmax(0,1fr)] md:grid-rows-1",
						slideMode === "next" && "reel-detail-enter-next",
						slideMode === "prev" && "reel-detail-enter-prev",
						slideMode === "fade" && "reel-detail-enter-fade",
					)}
				>
					{/* Fixed-height media slot (9:16) avoids layout jump between posts */}
					<div className="relative flex min-h-0 w-full shrink-0 items-center justify-center bg-black md:h-full md:min-h-0 md:max-h-full">
						{canGoPrev ? (
							<Button
								type="button"
								variant="ghost"
								size="icon"
								className={cn(navButtonClass, "left-2 z-30")}
								aria-label="Previous post"
								onClick={(e) => {
									e.stopPropagation()
									handlePrev()
								}}
							>
								<ChevronLeft className="size-6" strokeWidth={2.25} />
							</Button>
						) : null}
						{canGoNext ? (
							<Button
								type="button"
								variant="ghost"
								size="icon"
								className={cn(navButtonClass, "right-2 z-30")}
								aria-label="Next post"
								onClick={(e) => {
									e.stopPropagation()
									handleNext()
								}}
							>
								<ChevronRight className="size-6" strokeWidth={2.25} />
							</Button>
						) : null}

						<div
							className={cn(
								"relative mx-auto flex w-full max-w-full items-center justify-center overflow-hidden bg-black",
								"aspect-[9/16] max-h-[min(52vh,720px)]",
								"md:mx-0 md:h-full md:max-h-full md:w-auto md:max-w-full md:shrink-0 md:aspect-[9/16]",
							)}
						>
						{hasVideo ? (
							<div className="absolute inset-0 flex items-center justify-center">
								<video
									ref={modalVideoRef}
									className={cn(
										"reel-grid-video relative z-[2] h-full w-full max-h-full max-w-full object-contain",
										modalVideoReady
											? "opacity-100"
											: "pointer-events-none opacity-0",
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
											"absolute inset-0 z-[3] m-auto h-full w-full max-h-full max-w-full object-contain transition-opacity duration-150",
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
								className="h-full w-full max-h-full max-w-full object-contain"
								referrerPolicy="no-referrer"
							/>
						) : null}
						</div>
					</div>

					<div className="flex max-h-[42vh] min-h-0 w-full flex-col gap-3 overflow-y-auto border-t border-border p-4 md:max-h-full md:min-h-0 md:min-w-0 md:border-t-0 md:border-l">
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
	)
}
