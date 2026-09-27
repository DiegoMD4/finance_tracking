import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

import { Category } from "@/types/categories.types"
import { getCategoryIcon } from "@/lib/category-icons"
import ActionsCategoryTable from "./ActionsCategoryTable"

interface TableCategoriesProps {
  data: Category[]
}

export function TableCategories({ data }: TableCategoriesProps) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Icon</TableHead>
          <TableHead>Name</TableHead>
          <TableHead>Color</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.length > 0 ? (
          data.map((category) => {
            const CategoryIcon = getCategoryIcon(category.icon)

            return (
              <TableRow key={category.categoryId}>
                <TableCell>
                  <CategoryIcon className="size-4" />
                </TableCell>
                <TableCell className="font-medium">{category.name}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <span
                      className="size-4 shrink-0 rounded-full border border-border"
                      style={{ backgroundColor: category.color ?? undefined }}
                    />
                    <span className="text-muted-foreground">
                      {category.color}
                    </span>
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  <ActionsCategoryTable category={category} />
                </TableCell>
              </TableRow>
            )
          })
        ) : (
          <TableRow>
            <TableCell className="text-center" colSpan={4}>
              There is no categories created for this user
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  )
}
