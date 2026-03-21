export const REEL_CATEGORIES = [
	{ id: "film", label: "Film" },
	{ id: "music", label: "Music" },
	{ id: "football", label: "Football" },
	{ id: "tennis", label: "Tennis" },
	{ id: "basketball", label: "Basketball" },
	{ id: "fitness", label: "Fitness" },
	{ id: "food", label: "Food" },
	{ id: "travel", label: "Travel" },
	{ id: "fashion", label: "Fashion" },
	{ id: "gaming", label: "Gaming" },
	{ id: "comedy", label: "Comedy" },
	{ id: "tech", label: "Tech" },
	{ id: "beauty", label: "Beauty" },
	{ id: "cars", label: "Cars" },
	{ id: "dance", label: "Dance" },
	{ id: "photography", label: "Photography" },
	{ id: "art", label: "Art" },
	{ id: "books", label: "Books" },
	{ id: "business", label: "Business" },
	{ id: "science", label: "Science" },
	{ id: "nature", label: "Nature" },
	{ id: "pets", label: "Pets" },
	{ id: "home", label: "Home" },
	{ id: "diy", label: "DIY" },
	{ id: "parenting", label: "Parenting" },
	{ id: "education", label: "Education" },
	{ id: "anime", label: "Anime" },
	{ id: "nfl", label: "NFL" },
	{ id: "baseball", label: "Baseball" },
	{ id: "hockey", label: "Hockey" },
	{ id: "golf", label: "Golf" },
	{ id: "formula1", label: "F1" },
	{ id: "boxing", label: "Boxing" },
	{ id: "mma", label: "MMA" },
	{ id: "yoga", label: "Yoga" },
	{ id: "running", label: "Running" },
	{ id: "cycling", label: "Cycling" },
	{ id: "esports", label: "Esports" },
	{ id: "architecture", label: "Architecture" },
	{ id: "gardening", label: "Gardening" },
	{ id: "coffee", label: "Coffee" },
	{ id: "meditation", label: "Meditation" },
	{ id: "tattoos", label: "Tattoos" },
	{ id: "hiking", label: "Hiking" },
	{ id: "camping", label: "Camping" },
	{ id: "watches", label: "Watches" },
	{ id: "kpop", label: "K-Pop" },
	{ id: "skateboarding", label: "Skateboarding" },
	{ id: "surfing", label: "Surfing" },
	{ id: "asmr", label: "ASMR" },
	{ id: "news", label: "News" },
	{ id: "podcasts", label: "Podcasts" },
	{ id: "thrifting", label: "Thrifting" },
	{ id: "cricket", label: "Cricket" },
	{ id: "rugby", label: "Rugby" },
] as const

/** Synthetic bucket: index accounts not assigned to any real category (not in onboarding list) */
export const OTHER_CATEGORY_ID = "other" as const

/** Curated public handles used as category defaults and onboarding seeds */
export const DEFAULT_BUILTIN_CATEGORY_ACCOUNTS: Record<
	ReelCategoryId,
	readonly string[]
> = {
	film: [
		"a24",
		"netflix",
		"indiewire",
		"filmindependent",
		"criterioncollection",
	],
	music: [
		"billboard",
		"rollingstone",
		"spotify",
		"applemusic",
		"complexmusic",
	],
	football: [
		"433",
		"championsleague",
		"premierleague",
		"fifaworldcup",
		"espnfc",
	],
	tennis: ["atptour", "wta", "wimbledon", "usopen", "australianopen"],
	basketball: ["nba", "bleacherreport", "houseofhighlights", "espn", "sportscenter"],
	fitness: ["gymshark", "nike", "lululemon", "adidas", "onepeloton"],
	food: ["tastemade", "foodnetwork", "jamieoliver", "gordongram", "bonappetitmag"],
	travel: [
		"natgeotravel",
		"beautifuldestinations",
		"lonelyplanet",
		"visitdubai",
		"travelandleisure",
	],
	fashion: ["vogue", "hypebeast", "highsnobiety", "prada", "chanelofficial"],
	gaming: ["ign", "playstation", "xbox", "nintendo", "gameinformer"],
	comedy: ["comedycentral", "nbcsnl", "fallontonight", "ladbible", "funnyordie"],
	tech: ["mkbhd", "unboxtherapy", "wired", "theverge", "techcrunch"],
	beauty: ["sephora", "glossier", "fentybeauty", "rarebeauty", "ultabeauty"],
	cars: ["topgear", "motortrend", "carthrottle", "mclaren", "porsche"],
	dance: ["worldofdance", "1milliondance", "kinjaz", "danceon", "redbull"],
	photography: ["natgeo", "canonusa", "nikonusa", "leicacamera", "hasselblad"],
	art: ["themet", "artsy", "saatchi_gallery", "artnet", "moma"],
	books: [
		"penguinrandomhouse",
		"goodreads",
		"barnesandnoble",
		"audible",
		"bookriot",
	],
	business: ["forbes", "entrepreneur", "businessinsider", "wsj", "bloomberg"],
	science: ["nasa", "spacex", "sciencechannel", "newscientist", "iflscience"],
	nature: ["natgeowild", "bbcearth", "discovery", "ourplanetdaily", "natgeo"],
	pets: ["thedodo", "dogsofinstagram", "meowbox", "petco", "chewy"],
	home: ["archdigest", "apartmenttherapy", "ikea", "westelm", "anthropologie"],
	diy: ["hgtv", "fallfordiy", "studiodiy", "britandco", "handmadecharlotte"],
	parenting: ["parents", "scarymommy", "motherly", "whattoexpect", "babycenter"],
	education: ["ted", "khanacademy", "duolingo", "natgeo", "crashcourse"],
	anime: ["crunchyroll", "funimation", "vizmedia", "netflixanime", "toei_animation"],
	nfl: ["nfl", "espn", "bleacherreport", "chiefs", "dallascowboys"],
	baseball: ["mlb", "yankees", "dodgers", "redsox", "espnmlb"],
	hockey: ["nhl", "hockeynight", "espnnhl", "penguins", "mapleleafs"],
	golf: ["pgatour", "europeantour", "themasters", "rydercup", "golfdigest"],
	formula1: ["f1", "mercedesamgf1", "redbullracing", "scuderiaferrari", "landonorris"],
	boxing: ["matchroomboxing", "espnboxing", "showtimeboxing", "toprankboxing", "ringmagazine"],
	mma: ["ufc", "bellatormma", "espnmma", "onechampionship", "pflmma"],
	yoga: ["adidasyoga", "lululemon", "aloyoga", "yogajournal", "glo"],
	running: ["nike", "worldathletics", "garmin", "strava", "nikerunning"],
	cycling: ["letourdefrance", "giroditalia", "gcn", "specialized", "cannondale"],
	esports: ["eslcs", "riotgames", "teamliquid", "fazeclan", "eslcsgo"],
	architecture: ["archdigest", "archdaily", "dezeen", "designboom", "wallpapermag"],
	gardening: ["rhs_gardening", "epicgardening", "gardenersworldmag", "montydon", "thehappygardeninglife"],
	coffee: ["starbucks", "bluebottlecoffee", "intelligentsiacoffee", "stumptowncoffee", "nespresso"],
	meditation: ["headspace", "calm", "tenpercenthappier", "insighttimer", "wakingup"],
	tattoos: ["inkedmag", "worldtattoo", "tattoodo", "blackclaw", "savedtattoo"],
	hiking: ["rei", "nationalparkservice", "hikingproject", "alltrails", "thenorthface"],
	camping: ["rei", "patagonia", "thenorthface", "goretexna", "outsidemagazine"],
	watches: ["rolex", "omega", "hodinkee", "tudorwatch", "cartier"],
	kpop: ["bts.bighitofficial", "blackpinkofficial", "smtown", "jypentertainment", "yg_ent_official"],
	skateboarding: ["thrashermag", "berrics", "nikesb", "tonyhawk", "girlskateboards"],
	surfing: ["wsl", "kellyslater", "billabong", "quiksilver", "ripcurl"],
	asmr: ["asmr", "gibi_asmr", "sasasmr", "asmrzeitgeist", "asmrmpits"],
	news: ["cnn", "bbcnews", "reuters", "apnews", "nytimes"],
	podcasts: ["timferriss", "lexfridman", "hubermanlab", "jayshetty", "theminimalists"],
	thrifting: ["goodwillintl", "depop", "poshmark", "thredup", "salvationarmyus"],
	cricket: ["icc_cricket", "espncricinfo", "bcci", "ecb_cricket", "cricketworldcup"],
	rugby: ["worldrugby", "sixnationsrugby", "allblacks", "englandrugby", "wallabiesrugby"],
}

export type ReelCategoryId = (typeof REEL_CATEGORIES)[number]["id"]

export const BUILTIN_REEL_CATEGORY_IDS: ReadonlySet<string> = new Set([
	...REEL_CATEGORIES.map((c) => c.id),
	OTHER_CATEGORY_ID,
])

/** @deprecated Use BUILTIN_REEL_CATEGORY_IDS */
export const REEL_CATEGORY_IDS = BUILTIN_REEL_CATEGORY_IDS

export function getReelCategoryLabel(id: string): string {
	if (id === OTHER_CATEGORY_ID) return "Other"
	const row = REEL_CATEGORIES.find((c) => c.id === id)
	return row?.label ?? id
}

export function isReelCategoryId(id: string): id is ReelCategoryId {
	return BUILTIN_REEL_CATEGORY_IDS.has(id)
}

/** When the user has not set an explicit list (including empty), built-ins fall back to these */
export function getDefaultAccountsForBuiltinCategory(id: string): string[] {
	if (id === OTHER_CATEGORY_ID) return []
	if (!isReelCategoryId(id)) return []
	return [...DEFAULT_BUILTIN_CATEGORY_ACCOUNTS[id]]
}

/** Map common Latin letters with diacritics to ASCII for URL-safe category ids */
const SLUG_EXTRA_LATIN_MAP: [RegExp, string][] = [
	[/\u011f/g, "g"],
	[/\u00fc/g, "u"],
	[/\u015f/g, "s"],
	[/\u0131/g, "i"],
	[/\u00f6/g, "o"],
	[/\u00e7/g, "c"],
	[/\u011e/g, "g"],
	[/\u00dc/g, "u"],
	[/\u015e/g, "s"],
	[/\u0130/g, "i"],
	[/\u00d6/g, "o"],
	[/\u00c7/g, "c"],
]

/**
 * Builds a URL-like id for custom categories (lowercase, hyphenated).
 */
export function slugifyCustomReelCategoryId(displayName: string): string {
	let t = displayName.trim().toLowerCase()
	for (const [re, ch] of SLUG_EXTRA_LATIN_MAP) t = t.replace(re, ch)
	t = t
		.normalize("NFD")
		.replace(/\p{M}/gu, "")
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "")
	if (t.length > 48) t = t.slice(0, 48).replace(/-+$/, "")
	if (!t) t = "category"
	return t
}
