import { Skeleton } from "@/components/ui/skeleton"
import {
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
  Table,
} from "@/components/ui/table"

export function SkeletonTable() {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Account Number</TableHead>
          <TableHead>Bank</TableHead>
          <TableHead>Created At</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {Array.from({ length: 5 }).map((_, index) => (
          <TableRow key={index}>
            <TableCell>
              <Skeleton className="h-4 w-32" />
            </TableCell>
            <TableCell>
              <Skeleton className="h-4 w-24" />
            </TableCell>
            <TableCell>
              <Skeleton className="h-4 w-20" />
            </TableCell>
            <TableCell className="flex justify-end text-right">
              <Skeleton className="h-4 w-12" />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
