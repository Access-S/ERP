import Link from "next/link"
import { ShieldAlert } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

interface PermissionDeniedProps {
  description?: string
  backHref?: string
  backLabel?: string
}

export function PermissionDenied({
  description = "Your assigned roles do not allow access to this area.",
  backHref = "/",
  backLabel = "Return to dashboard",
}: PermissionDeniedProps) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center p-6">
      <Card className="w-full max-w-lg">
        <CardHeader className="items-center text-center">
          <div className="mb-2 rounded-full bg-muted p-3">
            <ShieldAlert className="h-6 w-6 text-muted-foreground" />
          </div>
          <CardTitle>Access restricted</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5 text-center">
          <p className="text-sm text-muted-foreground">{description}</p>
          <Button variant="outline" asChild>
            <Link href={backHref}>{backLabel}</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
