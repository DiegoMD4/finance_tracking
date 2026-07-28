"use client"
import { Card, CardContent } from "@/components/ui/card"
import {
  CollapsibleTrigger,
  CollapsibleContent,
  Collapsible,
} from "@/components/ui/collapsible"
import { Button } from "@/components/ui/button"
import { getCategoryIcon } from "@/lib/category-icons"
import { Category } from "@/types/categories.types"
import { ChevronDownIcon } from "lucide-react"
import ActionsCategoryTable from "./ActionsCategoryTable"

interface CardCategoriesProps {
  data: Category[]
}

export default function CardCategories({ data }: CardCategoriesProps) {
  if (data.length === 0) {
    return (
      <p className="px-2 text-sm text-muted-foreground">
        There is no categories created for this user.
      </p>
    )
  }

  return (
    <section className="flex flex-col gap-y-4 px-2">
      {data.map((category) => {
        const CategoryIcon = getCategoryIcon(category.icon)

        return (
          <Card
            className="mx-auto w-full max-w-sm"
            key={category.categoryId}
            size="sm"
          >
            <CardContent className="px-1 py-0">
              <Collapsible className="rounded-md transition-colors data-[state=open]:bg-muted/40">
                <CollapsibleTrigger asChild>
                  <Button
                    variant="ghost"
                    className="group h-auto w-full justify-start px-4 py-3 text-left"
                  >
                    <div className="flex max-w-[85%] flex-row items-center gap-x-3">
                      <CategoryIcon className="size-4 shrink-0" />
                      <span className="w-full truncate font-mono font-bold">
                        {category.name}
                      </span>
                    </div>
                    <ChevronDownIcon className="ml-auto h-4 w-4 shrink-0 opacity-50 transition-transform duration-200 group-data-[state=open]:rotate-180" />
                  </Button>
                </CollapsibleTrigger>

                <CollapsibleContent className="flex flex-col gap-y-4 p-4 pt-2 font-mono text-xs">
                  <ul className="space-y-1.5 border-t border-muted/50 pt-3 text-muted-foreground">
                    <li className="flex justify-between">
                      <span>Color:</span>
                      <span className="flex items-center gap-2 font-medium text-foreground">
                        <span
                          className="size-4 shrink-0 rounded-full border border-border"
                          style={{
                            backgroundColor: category.color ?? undefined,
                          }}
                        />
                        {category.color}
                      </span>
                    </li>
                  </ul>

                  <ActionsCategoryTable category={category} variant="buttons" />
                </CollapsibleContent>
              </Collapsible>
            </CardContent>
          </Card>
        )
      })}
    </section>
  )
}
