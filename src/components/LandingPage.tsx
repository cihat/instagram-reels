"use client"

import Link from "next/link"
import { ArrowRight, Layers, Radio, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
	Card,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card"

export function LandingPage() {
	return (
		<div className="min-h-dvh bg-background text-foreground">
			<header className="border-b border-border/80 bg-background/95 backdrop-blur-sm">
				<div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4 sm:px-6">
					<Link
						href="/"
						className="flex items-center gap-2 font-semibold tracking-tight"
					>
						<img
							src="/logo.svg"
							alt=""
							width={28}
							height={28}
							className="size-7 rounded-md"
						/>
						<span>Reels Search</span>
					</Link>
					<nav className="flex items-center gap-2">
						<Button
							variant="ghost"
							size="sm"
							nativeButton={false}
							render={<Link href="/sources" />}
						>
							Sources
						</Button>
						<Button size="sm" nativeButton={false} render={<Link href="/reels" />}>
							Open app
						</Button>
					</nav>
				</div>
			</header>

			<main>
				<section className="mx-auto max-w-5xl px-4 py-16 sm:px-6 sm:py-24">
					<p className="text-sm font-medium text-muted-foreground">
						Local-first reel discovery
					</p>
					<h1 className="mt-3 max-w-3xl text-4xl font-semibold tracking-tight sm:text-5xl">
						Search the short videos you actually care about
					</h1>
					<p className="mt-5 max-w-2xl text-lg text-muted-foreground leading-relaxed">
						Reels Search builds a searchable index from Instagram accounts you
						choose. Filter by category, narrow to specific creators, and find
						clips by caption, tags, or keywords — without endless scrolling the
						main feed.
					</p>
					<div className="mt-8 flex flex-wrap gap-3">
						<Button
							size="lg"
							className="gap-2"
							nativeButton={false}
							render={<Link href="/reels" />}
						>
							Start searching
							<ArrowRight className="size-4" />
						</Button>
						<Button
							size="lg"
							variant="outline"
							nativeButton={false}
							render={<Link href="/sources" />}
						>
							Connect accounts
						</Button>
					</div>
				</section>

				<section className="border-t border-border/60 bg-muted/30 py-16 sm:py-20">
					<div className="mx-auto max-w-5xl px-4 sm:px-6">
						<h2 className="text-2xl font-semibold tracking-tight">
							What it does
						</h2>
						<p className="mt-2 max-w-2xl text-muted-foreground">
							A focused viewer and search layer on top of metadata you control.
						</p>
						<div className="mt-10 grid gap-4 sm:grid-cols-3">
							<Card className="border-border/80 bg-card/80 shadow-none">
								<CardHeader>
									<Search className="mb-2 size-8 text-primary" />
									<CardTitle className="text-base">Full-text search</CardTitle>
									<CardDescription>
										Query captions and tags across everything in your index, with
										sorting by relevance, date, or likes.
									</CardDescription>
								</CardHeader>
							</Card>
							<Card className="border-border/80 bg-card/80 shadow-none">
								<CardHeader>
									<Layers className="mb-2 size-8 text-primary" />
									<CardTitle className="text-base">Categories</CardTitle>
									<CardDescription>
										Group accounts into themes (sports, music, film, or your own
										custom lists) and search inside a slice of the catalog.
									</CardDescription>
								</CardHeader>
							</Card>
							<Card className="border-border/80 bg-card/80 shadow-none">
								<CardHeader>
									<Radio className="mb-2 size-8 text-primary" />
									<CardTitle className="text-base">Your sources</CardTitle>
									<CardDescription>
										Metadata is fetched server-side from the accounts you add;
										when cloud storage is configured, the merged index persists as{" "}
										<code className="rounded bg-muted px-1 text-[11px]">
											index.json
										</code>
										.
									</CardDescription>
								</CardHeader>
							</Card>
						</div>
					</div>
				</section>

				<section className="mx-auto max-w-5xl px-4 py-16 sm:px-6 sm:py-20">
					<h2 className="text-2xl font-semibold tracking-tight">How it works</h2>
					<ol className="mt-8 space-y-6">
						{[
							{
								step: "1",
								title: "Add Instagram usernames",
								body: "On the Sources screen or from the in-app modal, list handles (no @ required). A shared secret can protect the fetch API in production.",
							},
							{
								step: "2",
								title: "Server fetches reel metadata",
								body: "The backend pulls public reel data using configured session cookies, merges it with any existing index, and optionally writes to object storage (e.g. R2) so updates survive deploys.",
							},
							{
								step: "3",
								title: "Search and watch in the app",
								body: "The UI loads the index, applies your category and account filters, and streams video where URLs are available. Open posts on Instagram when you need the original context.",
							},
						].map((item) => (
							<li
								key={item.step}
								className="flex gap-4 border-b border-border/50 pb-6 last:border-0 last:pb-0"
							>
								<span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
									{item.step}
								</span>
								<div>
									<h3 className="font-semibold">{item.title}</h3>
									<p className="mt-1 text-muted-foreground leading-relaxed">
										{item.body}
									</p>
								</div>
							</li>
						))}
					</ol>
				</section>

				<section className="border-t border-border/60 bg-muted/30 py-16 sm:py-20">
					<div className="mx-auto max-w-5xl px-4 sm:px-6">
						<h2 className="text-2xl font-semibold tracking-tight">Why it exists</h2>
						<p className="mt-4 max-w-3xl text-muted-foreground leading-relaxed">
							Feed algorithms optimize for engagement, not recall. Reels Search is
							for people who already know which creators or topics matter to them
							and want a calm, searchable archive-style view instead of another
							infinite recommendations stack. It is a small, explicit tool: you
							pick the inputs, the index is yours to refresh, and search is the
							main interface.
						</p>
					</div>
				</section>

				<section className="mx-auto max-w-5xl px-4 py-16 text-center sm:px-6 sm:py-20">
					<h2 className="text-xl font-semibold tracking-tight">
						Ready to try it?
					</h2>
					<p className="mx-auto mt-2 max-w-lg text-sm text-muted-foreground">
						Jump into the grid, or set up sources first if your index is empty.
					</p>
					<Button
						className="mt-6 gap-2"
						size="lg"
						nativeButton={false}
						render={<Link href="/reels" />}
					>
						Open Reels Search
						<ArrowRight className="size-4" />
					</Button>
				</section>
			</main>

			<footer className="border-t border-border/80 py-8 text-center text-xs text-muted-foreground">
				Built for personal, opt-in cataloging — not affiliated with Instagram.
			</footer>
		</div>
	)
}
