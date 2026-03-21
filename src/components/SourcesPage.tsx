"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import {
	ArrowLeft,
	Clapperboard,
	Cookie,
	ExternalLink,
	Github,
	ListOrdered,
	Shield,
	Users,
} from "lucide-react"
import { ShellHeader } from "@/components/ShellHeader"
import { SourcesForm } from "@/components/SourcesForm"
import { Button, buttonVariants } from "@/components/ui/button"
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card"
import { cn } from "@/lib/utils"

const REPO_URL = "https://github.com/cihat/instagram-reels"

export function SourcesPage() {
	const router = useRouter()

	const headerActions = (
		<a
			href={REPO_URL}
			target="_blank"
			rel="noopener noreferrer"
			className={cn(
				buttonVariants({ variant: "outline", size: "icon-sm" }),
				"no-underline",
			)}
			aria-label="Project on GitHub"
			title="GitHub"
		>
			<Github className="size-4" />
		</a>
	)

	return (
		<div className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-background text-foreground">
			<ShellHeader title="Source accounts" actions={headerActions} />

			<main className="mx-auto w-full max-w-6xl min-h-0 flex-1 overflow-y-auto px-4 py-8 pb-16 sm:px-6 lg:px-10">
				<div className="grid gap-10 lg:grid-cols-12 lg:gap-12 lg:items-start">
					<div className="space-y-6 lg:col-span-5">
						<div className="space-y-3">
							<p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
								Setup
							</p>
							<h2 className="text-balance text-2xl font-semibold tracking-tight sm:text-[1.65rem]">
								Choose who appears in your reels grid
							</h2>
							<p className="max-w-prose text-pretty text-[15px] leading-relaxed text-muted-foreground">
								This screen exists because the app only searches reels from
								accounts you explicitly list. Nothing is inferred from your
								personal Instagram login — you curate the index yourself, then
								trigger a metadata fetch so thumbnails and titles can show up in
								search.
							</p>
						</div>

						<Card className="border-border/80 shadow-sm">
							<CardHeader className="pb-3">
								<CardTitle className="flex items-center gap-2 text-base">
									<Users className="size-4 shrink-0 text-primary" aria-hidden />
									What you configure
								</CardTitle>
								<CardDescription className="text-pretty leading-relaxed">
									<strong className="font-medium text-foreground">
										Accounts
									</strong>{" "}
									are merged into one list (stored in your browser) and define
									which profiles the grid can include.
								</CardDescription>
							</CardHeader>
						</Card>

						<Card className="border-border/80 shadow-sm">
							<CardHeader className="pb-3">
								<CardTitle className="flex items-center gap-2 text-base">
									<ListOrdered
										className="size-4 shrink-0 text-primary"
										aria-hidden
									/>
									How it works
								</CardTitle>
							</CardHeader>
							<CardContent className="space-y-3 pt-0 text-sm leading-relaxed text-muted-foreground">
								<ol className="list-decimal space-y-2.5 pl-5 marker:font-medium marker:text-foreground">
									<li>
										Add usernames (with or without @). Confirm with Enter or a
										comma; you can paste several at once.
									</li>
									<li>
										Provide{" "}
										<strong className="font-medium text-foreground">
											access
										</strong>
										: your deploy password{" "}
										<span className="text-foreground">or</span> Instagram
										session cookies so the server can request public metadata the
										same way a logged-in browser would.
									</li>
									<li>
										Click{" "}
										<strong className="font-medium text-foreground">
											Fetch Reels metadata
										</strong>
										. That refreshes what the search index knows about those
										accounts.
									</li>
								</ol>
							</CardContent>
						</Card>

						<Card className="border-border/80 shadow-sm">
							<CardHeader className="pb-3">
								<CardTitle className="flex items-center gap-2 text-base">
									<Cookie className="size-4 shrink-0 text-primary" aria-hidden />
									Instagram access
								</CardTitle>
								<CardDescription className="text-pretty leading-relaxed">
									The secret field accepts your host&apos;s password, or values
									like{" "}
									<code className="rounded bg-muted px-1 py-0.5 font-mono text-[11px] text-foreground">
										sessionid
									</code>{" "}
									and{" "}
									<code className="rounded bg-muted px-1 py-0.5 font-mono text-[11px] text-foreground">
										csrftoken
									</code>
									. Step-by-step browser copy instructions live inside the form
									panel — expand &quot;Browser cookie steps&quot; when you need
									them.
								</CardDescription>
							</CardHeader>
						</Card>

						<Card className="border-border/80 bg-muted/20 shadow-none">
							<CardHeader className="pb-3">
								<CardTitle className="flex items-center gap-2 text-base">
									<Shield className="size-4 shrink-0 text-primary" aria-hidden />
									Privacy
								</CardTitle>
								<CardDescription className="text-pretty leading-relaxed">
									Treat cookies like a password. They travel only with your own
									fetch requests to this app; nothing here is a black box — the
									project is open source.
								</CardDescription>
							</CardHeader>
							<CardContent className="pt-0">
								<a
									href={REPO_URL}
									target="_blank"
									rel="noopener noreferrer"
									className={cn(
										buttonVariants({ variant: "outline", size: "sm" }),
										"inline-flex gap-2 no-underline",
									)}
								>
									<Github className="size-4" aria-hidden />
									View source on GitHub
									<ExternalLink className="size-3.5 opacity-70" aria-hidden />
								</a>
							</CardContent>
						</Card>
					</div>

					<div className="space-y-6 lg:col-span-7">
						<Card className="border-border/80 shadow-md">
							<CardHeader className="gap-1 border-b border-border/60 pb-4">
								<CardTitle className="text-lg tracking-tight">
									Your accounts &amp; access
								</CardTitle>
								<CardDescription>
									Edit the list and secret below, then fetch. Settings persist in
									this browser until you change them.
								</CardDescription>
							</CardHeader>
							<CardContent className="space-y-6 pt-6">
								<SourcesForm onSuccess={() => router.push("/reels")} />
							</CardContent>
						</Card>

						<div className="flex flex-col items-stretch gap-2 sm:flex-row sm:justify-end">
							<Button
								type="button"
								variant="secondary"
								className="gap-2"
								onClick={() => router.push("/reels")}
							>
								<Clapperboard className="size-4" aria-hidden />
								Back to reels
							</Button>
							<Button
								variant="outline"
								className="gap-2"
								nativeButton={false}
								render={<Link href="/reels" prefetch={false} />}
							>
								<ArrowLeft className="size-4" aria-hidden />
								Home
							</Button>
						</div>
					</div>
				</div>
			</main>
		</div>
	)
}
