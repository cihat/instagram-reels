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
	Bookmark,
	Calendar,
	ChevronLeft,
	ChevronRight,
	ExternalLink,
	Heart,
	Maximize2,
	Minimize2,
	User,
} from "lucide-react"
import {
	useCallback,
	useEffect,
	useLayoutEffect,
	useRef,
	useState,
} from "react"
import { createPortal } from "react-dom"

type SlideMode = "fade" | "next" | "prev"

type PlaybackHandoff = { time: number; paused: boolean }

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

/** Matches grid `MediaCard` bookmark control (glass pill). */
const detailMediaChromeButtonClass =
	"z-[4] flex size-7 cursor-pointer items-center justify-center rounded-full border border-border/40 bg-background/30 text-foreground shadow-sm backdrop-blur-md transition-[background-color,box-shadow] hover:bg-background/45 hover:shadow-md active:scale-95"

export interface PostDetailDialogProps {
	item: MediaItem
	open: boolean
	onOpenChange: (open: boolean) => void
	canGoPrev: boolean
	canGoNext: boolean
	onGoPrev: () => void
	onGoNext: () => void
	isBookmarked?: boolean
	onToggleBookmark?: (mediaId: string) => void
}

export function PostDetailDialog({
	item,
	open,
	onOpenChange,
	canGoPrev,
	canGoNext,
	onGoPrev,
	onGoNext,
	isBookmarked = false,
	onToggleBookmark,
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
	const expandedVideoRef = useRef<HTMLVideoElement>(null)
	const playbackHandoff = useRef<PlaybackHandoff>({ time: 0, paused: true })
	const shouldSeedExpandedPlayback = useRef(false)
	const shouldRestoreModalPlayback = useRef(false)
	const suppressModalLoadedAutoplay = useRef(false)
	const [viewportFillOpen, setViewportFillOpen] = useState(false)
	const [portalReady, setPortalReady] = useState(false)
	const { playingId, setPlayingId, setAudibleMediaId } = usePlayingVideo()

	useEffect(() => {
		setPortalReady(true)
	}, [])

	/** One global unmuted clip: modal video owns the slot while open. */
	useEffect(() => {
		if (!open) {
			setAudibleMediaId(null)
			return
		}
		if (hasVideo) setAudibleMediaId(item.id)
		else setAudibleMediaId(null)
		return () => {
			setAudibleMediaId(null)
		}
	}, [open, hasVideo, item.id, setAudibleMediaId])

	useEffect(() => {
		if (!open) setViewportFillOpen(false)
	}, [open])

	useEffect(() => {
		setViewportFillOpen(false)
	}, [item.id])

	const enterViewportFill = useCallback(() => {
		const v = modalVideoRef.current
		playbackHandoff.current = {
			time: v?.currentTime ?? 0,
			paused: v ? v.paused : true,
		}
		shouldSeedExpandedPlayback.current = true
		setViewportFillOpen(true)
	}, [])

	const exitViewportFill = useCallback(() => {
		const v = expandedVideoRef.current
		playbackHandoff.current = {
			time: v?.currentTime ?? 0,
			paused: v ? v.paused : true,
		}
		shouldRestoreModalPlayback.current = true
		suppressModalLoadedAutoplay.current = true
		setViewportFillOpen(false)
	}, [])

	useLayoutEffect(() => {
		if (!viewportFillOpen || !hasVideo || !shouldSeedExpandedPlayback.current)
			return

		const run = () => {
			const v = expandedVideoRef.current
			if (!v || !shouldSeedExpandedPlayback.current) return false
			shouldSeedExpandedPlayback.current = false
			const { time, paused } = playbackHandoff.current
			const seed = () => {
				try {
					v.currentTime = time
				} catch {
					/* ignore seek errors */
				}
				v.muted = false
				v.volume = 1
				if (!paused) void v.play().catch(() => {})
				else v.pause()
			}
			if (v.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) seed()
			else v.addEventListener("loadeddata", seed, { once: true })
			return true
		}

		if (run()) return
		queueMicrotask(() => {
			void run()
		})
	}, [viewportFillOpen, hasVideo, item.id, item.video_url])

	useLayoutEffect(() => {
		if (
			viewportFillOpen ||
			!open ||
			!hasVideo ||
			!shouldRestoreModalPlayback.current
		)
			return

		const run = () => {
			const v = modalVideoRef.current
			if (!v || !shouldRestoreModalPlayback.current) return false
			shouldRestoreModalPlayback.current = false
			const { time, paused } = playbackHandoff.current
			const restore = () => {
				try {
					v.currentTime = time
				} catch {
					/* ignore */
				}
				if (!paused) void v.play().catch(() => {})
				else v.pause()
				suppressModalLoadedAutoplay.current = false
			}
			if (v.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) restore()
			else v.addEventListener("loadeddata", restore, { once: true })
			return true
		}

		if (run()) return
		queueMicrotask(() => {
			void run()
		})
	}, [viewportFillOpen, open, hasVideo, item.id])

	const tryPlayModalVideo = useCallback(() => {
		const v = modalVideoRef.current
		if (!v) return
		v.muted = false
		v.volume = 1
		void v.play().catch(() => {})
	}, [])

	/** Autoplay when the dialog opens or when navigating to another reel (prev/next). */
	useEffect(() => {
		if (!open || !hasVideo || viewportFillOpen) return
		if (suppressModalLoadedAutoplay.current) return
		const v = modalVideoRef.current
		if (!v) return
		if (v.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) tryPlayModalVideo()
	}, [
		open,
		hasVideo,
		item.id,
		item.video_url,
		tryPlayModalVideo,
		viewportFillOpen,
		modalVideoReady,
	])

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

	const handleOpenChange = (next: boolean) => {
		onOpenChange(next)
		if (!next) {
			setViewportFillOpen(false)
			modalVideoRef.current?.pause()
			expandedVideoRef.current?.pause()
			if (playingId === item.id) setPlayingId(null)
		}
	}

	useEffect(() => {
		if (!open) return
		const onKey = (e: KeyboardEvent) => {
			if (viewportFillOpen && (e.key === "Escape" || e.code === "Escape")) {
				e.preventDefault()
				e.stopPropagation()
				exitViewportFill()
				return
			}
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
	}, [
		open,
		viewportFillOpen,
		exitViewportFill,
		canGoPrev,
		canGoNext,
		handlePrev,
		handleNext,
	])

	const fullDescription =
		item.description?.trim() || "No description."

	const navButtonClass =
		"absolute top-1/2 z-20 h-11 w-11 -translate-y-1/2 cursor-pointer rounded-full border border-white/20 bg-black/55 text-white shadow-md backdrop-blur-sm hover:bg-black/55 hover:text-white active:-translate-y-1/2 touch-manipulation"

	return (
		<Dialog open={open} onOpenChange={handleOpenChange}>
			<DialogContent
				showCloseButton
				className="flex max-h-[min(94vh,940px)] w-[min(98vw,1080px)] max-w-[min(98vw,1080px)] flex-col gap-0 overflow-hidden rounded-2xl p-0 sm:max-w-[min(98vw,1080px)]"
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
						"md:grid md:h-[min(90vh,920px)] md:max-h-[min(94vh,960px)] md:min-h-0 md:grid-cols-[minmax(0,min(580px,58%))_minmax(0,1fr)] md:grid-rows-1",
						slideMode === "next" && "reel-detail-enter-next",
						slideMode === "prev" && "reel-detail-enter-prev",
						slideMode === "fade" && "reel-detail-enter-fade",
					)}
				>
					{/* Media fills column; video uses natural aspect inside box (no fixed 9:16 — avoids tiny letterboxing). */}
					<div className="relative flex min-h-0 w-full flex-1 shrink-0 flex-col bg-black max-md:min-h-[min(62vh,720px)] md:h-full md:max-h-full md:flex-none">
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
						{hasVideo && !viewportFillOpen ? (
							<button
								type="button"
								className={cn(
									"absolute left-1.5 top-1.5 z-[40]",
									detailMediaChromeButtonClass,
								)}
								title="Fill screen"
								aria-label="Fill screen with video"
								onClick={(e) => {
									e.preventDefault()
									e.stopPropagation()
									enterViewportFill()
								}}
							>
								<Maximize2 className="size-3.5" strokeWidth={2} />
							</button>
						) : null}
						{onToggleBookmark ? (
							<button
								type="button"
								className={cn(
									"absolute right-1.5 top-1.5 z-[40]",
									detailMediaChromeButtonClass,
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

						<div
							className={cn(
								"relative min-h-0 w-full flex-1 overflow-hidden bg-black",
								"max-md:max-h-[min(82vh,920px)]",
								"md:h-full md:max-h-full",
							)}
						>
							{hasVideo ? (
								<>
									{!viewportFillOpen ? (
										<>
											<video
												ref={modalVideoRef}
												className={cn(
													"reel-modal-dialog-video absolute left-1/2 top-1/2 z-[2] max-h-full max-w-full -translate-x-1/2 -translate-y-1/2 object-contain",
													modalVideoReady
														? "opacity-100"
														: "pointer-events-none opacity-0",
												)}
												src={item.video_url}
												poster={thumbForLayer ? undefined : posterAttr}
												autoPlay
												muted={false}
												controls
												controlsList="nofullscreen"
												preload="auto"
												playsInline
												onLoadedData={() => {
													setModalVideoReady(true)
												}}
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
														"absolute left-1/2 top-1/2 z-[3] max-h-full max-w-full -translate-x-1/2 -translate-y-1/2 object-contain transition-opacity duration-150",
														modalVideoReady &&
															"pointer-events-none z-[1] opacity-0",
													)}
													decoding="async"
													referrerPolicy="no-referrer"
												/>
											) : null}
										</>
									) : null}
									{viewportFillOpen && portalReady
										? createPortal(
												<div
													className="fixed inset-0 z-[200] flex flex-col bg-black"
													role="presentation"
												>
													<button
														type="button"
														className={cn(
															"absolute right-2 top-2 z-10",
															detailMediaChromeButtonClass,
														)}
														title="Exit fill screen"
														aria-label="Exit fill screen"
														onClick={(e) => {
															e.preventDefault()
															e.stopPropagation()
															exitViewportFill()
														}}
													>
														<Minimize2 className="size-3.5" strokeWidth={2} />
													</button>
													<div className="flex min-h-0 flex-1 items-center justify-center p-2">
														<video
															ref={expandedVideoRef}
															className="reel-modal-viewport-fill-video z-[1]"
															src={item.video_url}
															poster={thumbForLayer ? undefined : posterAttr}
															muted={false}
															controls
															controlsList="nofullscreen"
															preload="auto"
															playsInline
															onPlay={() => setPlayingId(item.id)}
															onPause={() => {
																if (playingId === item.id) setPlayingId(null)
															}}
														>
															Your browser does not support the video tag.
														</video>
													</div>
												</div>,
												document.body,
											)
										: null}
								</>
							) : rawThumb ? (
								// eslint-disable-next-line @next/next/no-img-element -- proxy / external CDN
								<img
									src={imgSrc || rawThumb}
									alt=""
									className="absolute left-1/2 top-1/2 max-h-full max-w-full -translate-x-1/2 -translate-y-1/2 object-contain"
									referrerPolicy="no-referrer"
								/>
							) : null}
						</div>
					</div>

					<div className="flex max-h-[min(32vh,380px)] min-h-0 w-full shrink-0 flex-col gap-3 overflow-y-auto border-t border-border p-4 md:max-h-full md:min-h-0 md:min-w-0 md:border-t-0 md:border-l">
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
