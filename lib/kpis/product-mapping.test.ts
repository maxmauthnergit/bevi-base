import { describe, expect, it } from 'vitest'
import { mapLineItem } from './product-mapping'

describe('mapLineItem', () => {
  it('maps the bag by SKU, else by colour in the title or variant', () => {
    expect(mapLineItem({ title: 'Bevi Bag', sku: '9180013220129', quantity: 1 }))
      .toEqual([{ productId: 'bevi-bag-beige', quantity: 1 }])
    expect(mapLineItem({ title: 'Bevi Bag Full Set', variant_title: 'Beige', quantity: 2 }))
      .toEqual([{ productId: 'bevi-bag-beige', quantity: 2 }])
    expect(mapLineItem({ title: 'Bevi Bag Full Set', variant_title: 'Black', quantity: 1 }))
      .toEqual([{ productId: 'bevi-bag-black', quantity: 1 }])
  })

  it('splits legacy bundles into their parts', () => {
    expect(mapLineItem({ title: 'Bevi Bundle L', quantity: 2 })).toEqual([
      { productId: 'bevi-bag-black', quantity: 2 },
      { productId: 'cleaning-kit',   quantity: 2 },
      { productId: 'phone-strap',    quantity: 2 },
    ])
    expect(mapLineItem({ title: 'Bevi Squad', variant_title: 'Beige', quantity: 1 }))
      .toEqual([{ productId: 'bevi-bag-beige', quantity: 3 }])
  })

  it('maps accessories and leaves unknown items unmapped', () => {
    expect(mapLineItem({ title: 'Bevi Water Bladder + Tubes', quantity: 1 }))
      .toEqual([{ productId: 'water-bladder', quantity: 1 }])
    expect(mapLineItem({ title: 'Gift Card', quantity: 1 })).toBeNull()
  })
})
