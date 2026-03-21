import { cn } from "@/lib/utils"

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn("relative overflow-hidden rounded-md bg-muted", className)}
      {...props}
    >
      <div
        className="pointer-events-none absolute inset-0 animate-[skeleton-shimmer_1.4s_ease-in-out_infinite] bg-linear-to-r from-transparent via-foreground/10 to-transparent dark:via-foreground/12"
        aria-hidden
      />
    </div>
  )
}

export { Skeleton }
