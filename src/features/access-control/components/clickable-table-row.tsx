"use client"

import type { KeyboardEvent, MouseEvent, ReactNode } from "react"
import { useRouter } from "next/navigation"
import { TableRow } from "@/components/ui/table"

export function ClickableTableRow({
  href,
  children,
}: {
  href: string
  children: ReactNode
}) {
  const router = useRouter()

  function open(event: MouseEvent<HTMLTableRowElement>) {
    if (event.defaultPrevented || event.button !== 0) return
    router.push(href)
  }

  function openWithKeyboard(event: KeyboardEvent<HTMLTableRowElement>) {
    if (event.key !== "Enter" && event.key !== " ") return
    event.preventDefault()
    router.push(href)
  }

  return (
    <TableRow
      role="link"
      tabIndex={0}
      className="cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
      onClick={open}
      onKeyDown={openWithKeyboard}
    >
      {children}
    </TableRow>
  )
}
