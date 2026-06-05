"use client"
import { Field, FieldLabel } from "@/components/ui/field"
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useRouter } from "next/navigation"

interface PaginationTableProps {
  page: number
  pageSize: number
  hasMore?: boolean
  route: string
}

export default function PaginationTable({
  page,
  pageSize,
  hasMore,
  route,
}: PaginationTableProps) {
  const router = useRouter()
  const currentPage = isNaN(page) || page < 1 ? 1 : page
  const currentPageSize = isNaN(pageSize) ? 5 : pageSize

  const handlePageSizeChange = (value: string) => {
    router.push(`${route}?page=1&pageSize=${value}`)
  }
  const isFirstPage = currentPage <= 1
  const isLastPage = !hasMore
  return (
    <div className="flex items-center justify-between gap-4">
      <Field orientation="horizontal" className="w-fit">
        <FieldLabel htmlFor="select-rows-per-page">Rows per page</FieldLabel>
        <Select
          value={String(currentPageSize)}
          onValueChange={handlePageSizeChange}
        >
          <SelectTrigger className="w-20" id="select-rows-per-page">
            <SelectValue />
          </SelectTrigger>
          <SelectContent align="start">
            <SelectGroup>
              <SelectItem value="5">5</SelectItem>
              <SelectItem value="10">10</SelectItem>
              <SelectItem value="20">20</SelectItem>
              <SelectItem value="30">30</SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>
      </Field>
      <Pagination className="mx-0 w-auto">
        <PaginationContent>
          <PaginationItem>
            <PaginationPrevious
              tabIndex={isFirstPage ? -1 : 0}
              aria-disabled={isFirstPage}
              className={
                isFirstPage
                  ? "pointer-events-none cursor-not-allowed opacity-50"
                  : ""
              }
              href={`${route}?page=${currentPage <= 1 ? 1 : currentPage - 1}&pageSize=${currentPageSize}`}
            />
          </PaginationItem>
          <PaginationItem>
            <PaginationNext
              href={`${route}?page=${currentPage + 1}&pageSize=${currentPageSize}`}
              className={
                isLastPage
                  ? "pointer-events-none cursor-not-allowed opacity-50"
                  : ""
              }
              tabIndex={isLastPage ? -1 : 0}
              aria-disabled={isLastPage}
            />
          </PaginationItem>
        </PaginationContent>
      </Pagination>
    </div>
  )
}
