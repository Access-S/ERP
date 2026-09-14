import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { ClickableTableRow } from "@/features/access-control/components/clickable-table-row"
import type { getCustomerOrders } from "../services/customer-order-service"

type CustomerOrderRow = Awaited<ReturnType<typeof getCustomerOrders>>[number]

const dateFormatter = new Intl.DateTimeFormat("en-AU", {
  day: "2-digit",
  month: "short",
  year: "numeric",
})

function statusLabel(status: string): string {
  return status.split("_").map((word) => word.charAt(0) + word.slice(1).toLowerCase()).join(" ")
}
function statusVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  if (status === "PO_CHECK") return "destructive"
  if (status === "ACTIVE" || status === "READY_FOR_PLANNING") return "default"
  if (status === "CANCELLED" || status === "CLOSED") return "outline"
  return "secondary"
}

export function CustomerOrdersTable({ orders }: { orders: readonly CustomerOrderRow[] }) {
  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead>ERP Order</TableHead>
            <TableHead>Customer PO</TableHead>
            <TableHead>Customer</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Received</TableHead>
            <TableHead>Release</TableHead>
            <TableHead>Expected value</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {orders.length === 0 ? (
            <TableRow className="hover:bg-transparent">
              <TableCell colSpan={8} className="h-28 text-center text-muted-foreground">
                No Customer Orders found.
              </TableCell>
            </TableRow>
          ) : orders.map((order) => (
            <ClickableTableRow key={order.id} href={`/customer-orders/${order.id}`}>
              <TableCell className="font-medium">{order.internalOrderNumber}</TableCell>
              <TableCell>{order.customerPoNumber}</TableCell>
              <TableCell>
                <div className="font-medium">{order.customerName}</div>
                <div className="text-xs text-muted-foreground">{order.customerCode}</div>
              </TableCell>
              <TableCell><Badge variant="outline">{statusLabel(order.type)}</Badge></TableCell>
              <TableCell>{dateFormatter.format(new Date(order.receivedDate))}</TableCell>
              <TableCell>{order.latestRelease?.internalReleaseNumber ?? `${order.releaseCount} releases`}</TableCell>
              <TableCell className="tabular-nums">
                {order.latestRelease?.expectedNetTotal === null || !order.latestRelease
                  ? "—"
                  : `${order.currency} ${Number(order.latestRelease.expectedNetTotal).toFixed(2)}`}
              </TableCell>
              <TableCell>
                <Badge variant={statusVariant(order.latestRelease?.status ?? order.status)}>
                  {statusLabel(order.latestRelease?.status ?? order.status)}
                </Badge>
              </TableCell>
            </ClickableTableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
