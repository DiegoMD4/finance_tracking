// components/dynamic-breadcrumb.tsx
"use client"

import React from "react"
import { usePathname } from "next/navigation"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { Fragment } from "react"

export function DynamicBreadcrumb() {
  const pathname = usePathname()

  // Dividimos la ruta y quitamos strings vacíos
  const segments = pathname.split("/").filter((item) => item !== "")

  return (
    <Breadcrumb>
      <BreadcrumbList>
        {/* Link a Home opcional */}
        <BreadcrumbItem className="hidden md:block">
          <BreadcrumbLink href="/">Inicio</BreadcrumbLink>
        </BreadcrumbItem>

        {segments.map((segment, index) => {
          const href = `/${segments.slice(0, index + 1).join("/")}`
          const isLast = index === segments.length - 1

          // Formateamos el texto (ej: "resumen-sucursales" -> "Resumen Sucursales")
          const title =
            segment.charAt(0).toUpperCase() +
            segment.slice(1).replace(/-/g, " ")

          return (
            <Fragment key={href}>
              <BreadcrumbSeparator className="hidden md:block" />
              <BreadcrumbItem>
                {isLast ? (
                  <BreadcrumbPage>{title}</BreadcrumbPage>
                ) : (
                  <BreadcrumbLink href={href} className="hidden md:block">
                    {title}
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>
            </Fragment>
          )
        })}
      </BreadcrumbList>
    </Breadcrumb>
  )
}
