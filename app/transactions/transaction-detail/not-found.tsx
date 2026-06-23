// app/bank-accounts/not-found.tsx
import Link from "next/link"
import { Button } from "@/components/ui/button"

export default function TransactionNotFound() {
  return (
    <div className="flex min-h-100 w-full flex-col items-center justify-center gap-y-4">
      <div className="space-y-2 text-center">
        <h2 className="text-2xl font-bold tracking-tight">Transaction Not Found</h2>
        <p className="max-w-sm text-sm text-muted-foreground">
          The transaction you are trying to see doesnt exist or the URL
          parameters are incorrect.
        </p>
      </div>
      <Button asChild variant="outline">
        <Link href="/transactions">Back to transactions list</Link>
      </Button>
    </div>
  )
}
