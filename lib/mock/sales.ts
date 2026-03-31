// ─── Mock data for Sales & Products page ────────────────────────────────────

export const mockMonthlyRevenue = [
  { month: 'Oct', revenue_gross: 7_200, revenue_net: 6_048, orders: 91 },
  { month: 'Nov', revenue_gross: 9_840, revenue_net: 8_266, orders: 124 },
  { month: 'Dec', revenue_gross: 14_100, revenue_net: 11_844, orders: 178 },
  { month: 'Jan', revenue_gross: 8_620, revenue_net: 7_241, orders: 109 },
  { month: 'Feb', revenue_gross: 10_440, revenue_net: 8_770, orders: 132 },
  { month: 'Mar', revenue_gross: 14_820, revenue_net: 12_449, orders: 186 },
]

export const mockUnitsBySku = [
  { sku: 'BB-BLACK-001', name: 'Bevi Bag Black', units: 412, revenue: 32_960 },
  { sku: 'BB-BEIGE-001', name: 'Bevi Bag Beige', units: 284, revenue: 22_720 },
  { sku: 'BB-STRAP-BLK', name: 'Strap Black', units: 89, revenue: 2_225 },
  { sku: 'BB-STRAP-BGE', name: 'Strap Beige', units: 64, revenue: 1_600 },
]

export const mockAovTrend = [
  { month: 'Oct', aov_gross: 79.1 },
  { month: 'Nov', aov_gross: 79.4 },
  { month: 'Dec', aov_gross: 79.2 },
  { month: 'Jan', aov_gross: 79.1 },
  { month: 'Feb', aov_gross: 79.1 },
  { month: 'Mar', aov_gross: 79.7 },
]

export const mockRevenueByCountry = [
  { country: 'Germany', code: 'DE', revenue: 41_200, percent: 62.8 },
  { country: 'Austria', code: 'AT', revenue: 12_400, percent: 18.9 },
  { country: 'Switzerland', code: 'CH', revenue: 5_800, percent: 8.8 },
  { country: 'Netherlands', code: 'NL', revenue: 2_100, percent: 3.2 },
  { country: 'Belgium', code: 'BE', revenue: 1_200, percent: 1.8 },
  { country: 'Other', code: 'XX', revenue: 2_900, percent: 4.4 },
]

export const mockReturnRate = [
  { month: 'Oct', rate: 2.2 },
  { month: 'Nov', rate: 2.4 },
  { month: 'Dec', rate: 3.1 },
  { month: 'Jan', rate: 2.8 },
  { month: 'Feb', rate: 2.3 },
  { month: 'Mar', rate: 1.9 },
]

export const mockBundleAttachRate = [
  { month: 'Oct', rate: 18.4 },
  { month: 'Nov', rate: 19.1 },
  { month: 'Dec', rate: 21.3 },
  { month: 'Jan', rate: 20.2 },
  { month: 'Feb', rate: 22.8 },
  { month: 'Mar', rate: 24.1 },
]
