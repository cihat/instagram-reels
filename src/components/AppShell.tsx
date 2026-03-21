"use client"

import { AppSidebar } from "@/components/AppSidebar"
import { InterestOnboardingModal } from "@/components/InterestOnboardingModal"
import {
	SidebarInset,
	SidebarProvider,
} from "@/components/ui/sidebar"
import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"
import { CategoryFilterProvider } from "@/contexts/CategoryFilterContext"

export function AppShell({ children }: { children: React.ReactNode }) {
	return (
		<TooltipProvider delay={0}>
			<CategoryFilterProvider>
				<InterestOnboardingModal />
				<SidebarProvider className="flex h-dvh max-h-dvh min-h-0 w-full overflow-hidden">
					<AppSidebar />
					<SidebarInset className="min-h-0 min-w-0 flex-1 overflow-hidden">
						{children}
					</SidebarInset>
				</SidebarProvider>
			</CategoryFilterProvider>
			<Toaster richColors closeButton />
		</TooltipProvider>
	)
}
