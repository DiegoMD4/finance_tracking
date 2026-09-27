import Link from "next/link"
import { Button } from "@/components/ui/button"

export default function CategoryNotFound() {
  return (
    <div className="flex min-h-100 w-full flex-col items-center justify-center gap-y-4">
      <div className="space-y-2 text-center">
        <h2 className="text-2xl font-bold tracking-tight">
          Category Not Found
        </h2>
        <p className="max-w-sm text-sm text-muted-foreground">
          The category you are trying to see doesnt exist or the URL
          parameters are incorrect.
        </p>
      </div>
      <Button asChild variant="outline">
        <Link href="/categories">Back to categories list</Link>
      </Button>
    </div>
  )
}
