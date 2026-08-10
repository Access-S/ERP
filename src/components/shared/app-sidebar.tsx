'use client'

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  LayoutDashboard,
  Package,
  Warehouse,
  ShoppingCart,
  TrendingUp,
  Cpu,
  ChevronDown,
} from "lucide-react"
// Import from our new global types folder
import type { NavItem, NavGroup } from "@/types/navigation"

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
} from "@/components/ui/sidebar"
import { cn } from "@/lib/utils"

const navGroups: NavGroup[] = [
  {
    label: "Overview",
    items: [
      { title: "Dashboard", url: "/", icon: LayoutDashboard },
      { title: "UI Playground", url: "/playground", icon: LayoutDashboard },
    ],
  },
  {
    label: "Supply Chain",
    items: [
      { title: "Products & BOM", url: "/products", icon: Package },
      { title: "Inventory (SOH)", url: "/inventory", icon: Warehouse },
    ],
  },
  {
    label: "Procurement",
    items: [
      { title: "Purchase Orders", url: "/purchasing", icon: ShoppingCart },
    ],
  },
  {
    label: "Planning & Analytics",
    items: [
      { title: "Forecasts", url: "/forecasts", icon: TrendingUp },
      { title: "MRP Engine", url: "/mrp", icon: Cpu },
    ],
  },
]

export function AppSidebar() {
  const pathname = usePathname()
  
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(
    navGroups.reduce((acc, group) => ({ ...acc, [group.label]: true }), {})
  )

  const toggleGroup = (label: string) => {
    setOpenGroups((prev) => ({ ...prev, [label]: !prev[label] }))
  }

  // FIX: Active Link Logic for sub-pages
  const isActive = useCallback((url: string) => {
    if (url === "/" && pathname !== "/") return false
    return pathname === url || pathname.startsWith(`${url}/`)
  }, [pathname])

  return (
    <Sidebar>
      <SidebarHeader className="p-6 pb-4">
        <h1 className="text-3xl font-heading tracking-wider text-primary">MRP SYSTEM</h1>
        <p className="text-sm text-muted-foreground mt-1 font-sans italic">Manufacturing Resource Planner</p>
      </SidebarHeader>
      
      <SidebarContent>
        {navGroups.map((group) => (
          <SidebarGroup key={group.label} className="-mt-3">
            
            {/* FIX: Accessibility. Changed to a button-based trigger */}
            <SidebarGroupLabel 
              asChild
              className="group/label w-full"
            >
              <button 
                onClick={() => toggleGroup(group.label)}
                onKeyDown={(e) => e.key === 'Enter' && toggleGroup(group.label)}
                className="flex items-center justify-between w-full cursor-pointer !text-sm font-heading tracking-[0.2em] text-foreground/50 hover:text-foreground transition-colors duration-200 mb-2 uppercase text-left"
              >
                <span>{group.label}</span>
                <ChevronDown 
                  className={cn(
                    "h-3.5 w-3.5 transition-transform duration-300",
                    openGroups[group.label] ? "rotate-180" : "rotate-0"
                  )} 
                />
              </button>
            </SidebarGroupLabel>
            
            <AnimatePresence initial={false}>
              {openGroups[group.label] && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2, ease: "easeInOut" }}
                  className="overflow-hidden"
                >
                  <SidebarGroupContent>
                    <SidebarMenu className="space-y-1">
                      {group.items.map((item) => (
                        <SidebarMenuItem key={item.title}>
                          <SidebarMenuButton 
                            asChild 
                            isActive={isActive(item.url)} // Uses improved logic
                            className="text-sm font-sans leading-relaxed"
                          >
                            <Link href={item.url}>
                              <item.icon className="h-4 w-4 text-muted-foreground group-data-[active=true]:text-primary" />
                              <span>{item.title}</span>
                            </Link>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      ))}
                    </SidebarMenu>
                  </SidebarGroupContent>
                </motion.div>
              )}
            </AnimatePresence>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter className="p-4 border-t border-border/50">
        <div className="flex items-center justify-between opacity-70">
          <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-tighter">
            v0.1.0 - Alpha
          </p>
          <div className="flex gap-1">
            <div className="h-1 w-1 rounded-full bg-primary animate-ping" />
            <div className="h-1 w-1 rounded-full bg-primary" />
          </div>
        </div>
      </SidebarFooter>
    </Sidebar>
  )
}