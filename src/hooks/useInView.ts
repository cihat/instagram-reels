import { useEffect, useRef, useState } from "react"

interface UseInViewOptions {
	/** When scrolling is nested (e.g. overflow-y-auto), pass that element so visibility is correct. */
	root?: Element | null
	rootMargin?: string
	threshold?: number
	disabled?: boolean
}

export function useInView(options: UseInViewOptions = {}) {
	const {
		root = null,
		rootMargin = "200px",
		threshold = 0,
		disabled = false,
	} = options
	const ref = useRef<HTMLDivElement | null>(null)
	const [inView, setInView] = useState(false)

	useEffect(() => {
		if (disabled) return
		const el = ref.current
		if (!el) return

		const observer = new IntersectionObserver(
			([entry]) => setInView(entry.isIntersecting),
			{
				...(root != null ? { root } : {}),
				rootMargin,
				threshold,
			},
		)
		observer.observe(el)
		return () => observer.disconnect()
	}, [root, rootMargin, threshold, disabled])

	return { ref, inView }
}
