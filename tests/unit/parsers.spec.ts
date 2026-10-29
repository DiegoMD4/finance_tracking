import { describe, expect, it } from "vitest"
import { getFileSource } from "@/lib/parsers/file-extractor"

describe("getFileSource", () => {
  it("L-13: detecta archivos CSV", () => {
    expect(getFileSource("estado.csv")).toBe("csv")
  })
})
