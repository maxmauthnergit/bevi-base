import type { StockLevel } from '../types'

export const mockStockLevels: StockLevel[] = [
  {
    sku: 'BB-BLACK-001',
    product_name: 'Bevi Bag',
    variant: 'Black',
    units: 38,
    reorder_threshold: 250,
    is_low: true,
    color: 'black',
  },
  {
    sku: 'BB-BEIGE-001',
    product_name: 'Bevi Bag',
    variant: 'Beige',
    units: 72,
    reorder_threshold: 100,
    is_low: true,
    color: 'beige',
  },
  {
    sku: 'BB-STRAP-BLK',
    product_name: 'Replacement Strap',
    variant: 'Black',
    units: 120,
    reorder_threshold: 100,
    is_low: false,
    color: 'black',
  },
  {
    sku: 'BB-STRAP-BGE',
    product_name: 'Replacement Strap',
    variant: 'Beige',
    units: 85,
    reorder_threshold: 100,
    is_low: true,
    color: 'beige',
  },
]

export const mockLowStockItems = mockStockLevels.filter((s) => s.is_low)
