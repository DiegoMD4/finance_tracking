export interface InventoryItem {
  id: string
  name: string
  sku: string
  stock: number
  status: "available" | "maintenance" | "out_of_stock"
  created_at: Date
}
