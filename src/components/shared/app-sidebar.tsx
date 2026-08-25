// ───────────────── BLOCK 1: Imports ────────────────────────────
'use client'

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Separator } from "@/components/ui/separator"
import { useSession, signOut } from "next-auth/react"
import {
  LayoutDashboard,
  Package,
  Warehouse,
  ShoppingCart,
  TrendingUp,
  Cpu,
  ChevronDown,
  Table,
  LogOut, // ADDED: Icon for Sign Out
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
import { Button } from "@/components/ui/button" // ADDED: Button component
import { cn } from "@/lib/utils"

// ───────────────── BLOCK 2: Nav Groups Definition ────────────────
const navGroups: NavGroup[] = [
  {
    label: "Overview",
    items: [
      { title: "Dashboard", url: "/", icon: LayoutDashboard },
      { title: "UI Playground", url: "/playground", icon: LayoutDashboard },
      { title: "Table Test", url: "/table-test", icon: Table },
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

// ───────────────── BLOCK 3: Component ─────────────────────────
export function AppSidebar() {
  const pathname = usePathname()
  const { data: session } = useSession()
  
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(
    navGroups.reduce((acc, group) => ({ ...acc, [group.label]: true }), {})
  )

  const toggleGroup = (label: string) => {
    setOpenGroups((prev) => ({ ...prev, [label]: !prev[label] }))
  }

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
      
      <SidebarContent className="gap-1">
        {navGroups.map((group, index) => (
          <SidebarGroup key={group.label} className="p-0 px-2">
            
            <SidebarGroupLabel 
              asChild
              className="group/label w-full"
            >
              <button 
                onClick={() => toggleGroup(group.label)}
                onKeyDown={(e) => e.key === 'Enter' && toggleGroup(group.label)}
                className="flex items-center justify-between w-full cursor-pointer !text-xs font-heading tracking-[0.15em] text-muted-foreground/70 hover:text-foreground transition-colors duration-200 mb-1 uppercase text-left"
              >
                <span>{group.label}</span>
                <ChevronDown 
                  className={cn(
                    "h-3 w-3 transition-transform duration-300",
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
                            isActive={isActive(item.url)}
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
        {session?.user ? (
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-3 px-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary text-sm font-bold">
                {session.user.name?.charAt(0) || "U"}
              </div>
              <div className="flex flex-col overflow-hidden">
                <span className="text-sm font-medium truncate text-foreground">{session.user.name}</span>
                <span className="text-xs text-muted-foreground truncate">{session.user.role}</span>
              </div>
            </div>
            <Button 
              variant="ghost" 
              className="w-full justify-start h-11 motion-safe:transition-colors text-muted-foreground hover:text-foreground" 
              onClick={() => signOut({ callbackUrl: "/login" })}
            >
              <LogOut className="mr-2 h-4 w-4" />
              Sign Out
            </Button>
          </div>
        ) : (
          <div className="flex items-center justify-between opacity-70">
            <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-tighter">
              v0.1.0 - Alpha
            </p>
            <div className="flex gap-1">
              <div className="h-1 w-1 rounded-full bg-primary animate-ping" />
              <div className="h-1 w-1 rounded-full bg-primary" />
            </div>
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  )
}

// ───────────────── BLOCK 4: Exports ────────────────────────────
// (Default export handled in Block 3)