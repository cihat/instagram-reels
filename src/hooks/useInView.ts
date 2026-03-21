import { useEffect, useRef, useState } from "react"

interface UseInViewOptions {
	rootMargin?: string
	threshold?: number
	disabled?: boolean
}

export function useInView(options: UseInViewOptions = {}) {
	const { rootMargin = "200px", threshold = 0, disabled = false } = options
	const ref = useRef<HTMLDivElement | null>(null)
	const [inView, setInView] = useState(false)

	useEffect(() => {
		if (disabled) return
		const el = ref.current
		if (!el) return

		const observer = new IntersectionObserver(
			([entry]) => setInView(entry.isIntersecting),
			{ rootMargin, threshold },
		)
		observer.observe(el)
		return () => observer.disconnect()
	}, [rootMargin, threshold, disabled])

	return { ref, inView }
}
