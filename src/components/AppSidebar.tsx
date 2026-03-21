"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
	Activity,
	ArrowRightLeft,
	AudioLines,
	Baby,
	Bike,
	BookOpen,
	Brain,
	Briefcase,
	Building2,
	Camera,
	Car,
	Clapperboard,
	CircleDot,
	Coffee,
	Cpu,
	Crosshair,
	Eye,
	Cuboid,
	Dumbbell,
	Flame,
	FolderOpen,
	Footprints,
	Flower2,
	Gamepad2,
	GraduationCap,
	Hammer,
	Headphones,
	Home,
	Landmark,
	Laugh,
	LeafyGreen,
	Layers,
	Medal,
	Microscope,
	MonitorPlay,
	Mountain,
	Music2,
	Newspaper,
	Palette,
	PawPrint,
	Pencil,
	PenLine,
	Plane,
	Plus,
	Podcast,
	Settings,
	Shirt,
	Shield,
	ShoppingBag,
	Snowflake,
	Sparkles,
	Star,
	Swords,
	Target,
	Tent,
	Trees,
	Trophy,
	Utensils,
	Video,
	Volleyball,
	Watch,
	Waves,
	Zap,
} from "lucide-react"
import { toast } from "sonner"
import { AccountOrganizeModal } from "@/components/AccountOrganizeModal"
import { CategoryAccountsModal } from "@/components/CategoryAccountsModal"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
	Sidebar,
	SidebarContent,
	SidebarFooter,
	SidebarGroup,
	SidebarGroupContent,
	SidebarGroupLabel,
	SidebarHeader,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	SidebarRail,
} from "@/components/ui/sidebar"
import { useCategoryFilter } from "@/contexts/CategoryFilterContext"
import {
	OTHER_CATEGORY_ID,
	type ReelCategoryId,
} from "@/lib/reel-categories"

const CATEGORY_ICONS: Record<ReelCategoryId, typeof Video> = {
	film: Clapperboard,
	music: Music2,
	football: Trophy,
	tennis: Activity,
	basketball: Volleyball,
	fitness: Dumbbell,
	food: Utensils,
	travel: Plane,
	fashion: Shirt,
	gaming: Gamepad2,
	comedy: Laugh,
	tech: Cpu,
	beauty: Sparkles,
	cars: Car,
	dance: AudioLines,
	photography: Camera,
	art: Palette,
	books: BookOpen,
	business: Briefcase,
	science: Microscope,
	nature: Trees,
	pets: PawPrint,
	home: Home,
	diy: Hammer,
	parenting: Baby,
	education: GraduationCap,
	anime: MonitorPlay,
	nfl: Medal,
	baseball: CircleDot,
	hockey: Snowflake,
	golf: Target,
	formula1: Zap,
	boxing: Swords,
	mma: Flame,
	yoga: Flower2,
	running: Footprints,
	cycling: Bike,
	esports: Crosshair,
	architecture: Building2,
	gardening: LeafyGreen,
	coffee: Coffee,
	meditation: Brain,
	tattoos: PenLine,
	hiking: Mountain,
	camping: Tent,
	watches: Watch,
	kpop: Star,
	skateboarding: Cuboid,
	surfing: Waves,
	asmr: Headphones,
	news: Newspaper,
	podcasts: Podcast,
	thrifting: ShoppingBag,
	cricket: Landmark,
	rugby: Shield,
}

const REELS_PATH = "/reels"
const SOURCES_PATH = "/sources"

export function AppSidebar() {
	const pathname = usePathname()
	const {
		selectedCategory,
		setSelectedCategory,
		getCategoryMemberAccounts,
		getHiddenNormsForCategory,
		setCategoryAccountsWithHidden,
		hideCustomCategory,
		unhideCustomCategory,
		customCategories,
		isBuiltinCategory,
		bumpIndexEpoch,
		sidebarCategories,
		setSourcesModalOpen,
		addCustomCategory,
		getCategoryLabel,
	} = useCategoryFilter()

	const [editOpen, setEditOpen] = useState(false)
	const [organizeOpen, setOrganizeOpen] = useState(false)
	const [editingCategoryId, setEditingCategoryId] = useState<string | null>(
		null,
	)
	const [newCategoryName, setNewCategoryName] = useState("")

	const submitNewCategory = () => {
		const r = addCustomCategory(newCategoryName)
		if (!r.ok) {
			toast.error(r.error)
			return
		}
		setNewCategoryName("")
		setEditingCategoryId(r.id)
		setEditOpen(true)
	}

	return (
		<Sidebar collapsible="icon" variant="sidebar">
			<SidebarHeader className="border-b border-sidebar-border px-2 py-3">
				<span className="truncate px-2 text-sm font-semibold group-data-[collapsible=icon]:hidden">
					Reels
				</span>
			</SidebarHeader>
			<SidebarContent className="overflow-hidden">
				<div className="flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden group-data-[collapsible=icon]:overflow-hidden">
					<SidebarGroup>
						<SidebarGroupLabel>Menu</SidebarGroupLabel>
						<SidebarGroupContent>
							<SidebarMenu>
								<SidebarMenuItem>
									<SidebarMenuButton
										isActive={
											pathname === REELS_PATH && selectedCategory == null
										}
										tooltip="All videos"
										render={<Link href={REELS_PATH} />}
										onClick={() => setSelectedCategory(null)}
									>
										<Video />
										<span>All Videos</span>
									</SidebarMenuButton>
								</SidebarMenuItem>
							</SidebarMenu>
						</SidebarGroupContent>
					</SidebarGroup>

					<SidebarGroup>
						<SidebarGroupLabel className="flex items-center justify-between gap-2 pr-1">
							<span>Categories</span>
							<Button
								type="button"
								variant="ghost"
								size="icon-sm"
								className="h-7 w-7 shrink-0 text-muted-foreground hover:text-foreground group-data-[collapsible=icon]:hidden"
								title="Organize accounts (drag between categories)"
								aria-label="Organize accounts"
								onClick={() => setOrganizeOpen(true)}
							>
								<ArrowRightLeft className="size-3.5" />
							</Button>
						</SidebarGroupLabel>
						<SidebarGroupContent>
							<SidebarMenu>
								{sidebarCategories.map(({ id, label }) => {
									const builtinIcon = CATEGORY_ICONS[id as ReelCategoryId]
									const Icon =
										id === OTHER_CATEGORY_ID
											? Layers
											: (builtinIcon ?? FolderOpen)
									return (
										<SidebarMenuItem key={id}>
											<div className="flex w-full min-w-0 items-center gap-0.5 pr-0.5">
												<SidebarMenuButton
													className="min-w-0 flex-1"
													isActive={
														pathname === REELS_PATH &&
														selectedCategory === id
													}
													tooltip={label}
													render={<Link href={REELS_PATH} />}
													onClick={() => setSelectedCategory(id)}
												>
													<Icon />
													<span className="truncate">{label}</span>
												</SidebarMenuButton>
												<Button
													type="button"
													variant="ghost"
													size="icon-sm"
													className="h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground group-data-[collapsible=icon]:hidden"
													onClick={(e) => {
														e.preventDefault()
														e.stopPropagation()
														if (id === OTHER_CATEGORY_ID) {
															setOrganizeOpen(true)
															return
														}
														setEditingCategoryId(id)
														setEditOpen(true)
													}}
													title={
														id === OTHER_CATEGORY_ID
															? `${label} — organize unassigned accounts`
															: `${label} — accounts`
													}
													aria-label={
														id === OTHER_CATEGORY_ID
															? `Organize ${label} accounts`
															: `Edit accounts for ${label}`
													}
												>
													<Pencil className="size-4" />
												</Button>
											</div>
										</SidebarMenuItem>
									)
								})}
							</SidebarMenu>

							<div className="mt-2 px-2 pb-1 group-data-[collapsible=icon]:hidden">
								<div className="flex gap-1.5">
									<Input
										value={newCategoryName}
										onChange={(e) => setNewCategoryName(e.target.value)}
										onKeyDown={(e) => {
											if (e.key === "Enter") {
												e.preventDefault()
												submitNewCategory()
											}
										}}
										placeholder="e.g. World news"
										className="h-8 min-w-0 flex-1 text-sm"
										autoComplete="off"
									/>
									<Button
										type="button"
										size="sm"
										variant="secondary"
										className="h-8 shrink-0 gap-1 px-2.5"
										onClick={submitNewCategory}
										title="Add category"
									>
										<Plus className="size-4" />
										<span className="sr-only sm:not-sr-only">Add</span>
									</Button>
								</div>
							</div>

							{customCategories.some((c) => c.hidden) ? (
								<div className="mt-2 space-y-1 border-t border-sidebar-border px-2 pt-2 group-data-[collapsible=icon]:hidden">
									<p className="px-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
										Hidden
									</p>
									{customCategories
										.filter((c) => c.hidden)
										.map((c) => (
											<Button
												key={c.id}
												type="button"
												variant="ghost"
												size="sm"
												className="h-8 w-full justify-start gap-2 px-2 text-xs text-muted-foreground hover:text-foreground"
												onClick={() => unhideCustomCategory(c.id)}
											>
												<Eye className="size-3.5 shrink-0" aria-hidden />
												<span className="truncate">Show “{c.label}”</span>
											</Button>
										))}
								</div>
							) : null}
						</SidebarGroupContent>
					</SidebarGroup>
				</div>
			</SidebarContent>
			<SidebarFooter className="shrink-0 border-t border-sidebar-border p-2">
				<SidebarMenu>
					<SidebarMenuItem>
						<SidebarMenuButton
							isActive={pathname === SOURCES_PATH}
							tooltip="Source accounts"
							render={
								pathname === REELS_PATH ? (
									<button
										type="button"
										onClick={() => setSourcesModalOpen(true)}
									/>
								) : (
									<Link href={SOURCES_PATH} />
								)
							}
						>
							<Settings />
							<span>Sources</span>
						</SidebarMenuButton>
					</SidebarMenuItem>
				</SidebarMenu>
			</SidebarFooter>
			<SidebarRail />

			<AccountOrganizeModal
				open={organizeOpen}
				onOpenChange={setOrganizeOpen}
			/>
			<CategoryAccountsModal
				open={editOpen}
				onOpenChange={(open) => {
					setEditOpen(open)
					if (!open) setEditingCategoryId(null)
				}}
				categoryId={editingCategoryId}
				categoryLabel={
					editingCategoryId
						? getCategoryLabel(editingCategoryId)
						: undefined
				}
				memberAccounts={
					editingCategoryId
						? getCategoryMemberAccounts(editingCategoryId)
						: []
				}
				hiddenNormalized={
					editingCategoryId
						? getHiddenNormsForCategory(editingCategoryId)
						: []
				}
				onPersistAccounts={(usernames, hiddenNorms) => {
					if (editingCategoryId)
						setCategoryAccountsWithHidden(
							editingCategoryId,
							usernames,
							hiddenNorms,
						)
				}}
				onAfterMetadataSynced={bumpIndexEpoch}
				showHideCategory={
					editingCategoryId != null &&
					!isBuiltinCategory(editingCategoryId)
				}
				onHideCategory={() => {
					if (!editingCategoryId) return
					hideCustomCategory(editingCategoryId)
					setEditOpen(false)
					setEditingCategoryId(null)
				}}
			/>
		</Sidebar>
	)
}
