// ─── Mock data for Marketing page ────────────────────────────────────────────

export const mockMonthlyAdSpend = [
  { month: 'Oct', meta: 2_100, google: 0, influencer: 400, total: 2_500 },
  { month: 'Nov', meta: 2_640, google: 0, influencer: 600, total: 3_240 },
  { month: 'Dec', meta: 3_800, google: 0, influencer: 800, total: 4_600 },
  { month: 'Jan', meta: 2_480, google: 0, influencer: 200, total: 2_680 },
  { month: 'Feb', meta: 2_890, google: 0, influencer: 400, total: 3_290 },
  { month: 'Mar', meta: 3_210, google: 0, influencer: 500, total: 3_710 },
]

export const mockRoasTrend = [
  { month: 'Oct', roas: 2.88 },
  { month: 'Nov', roas: 3.04 },
  { month: 'Dec', roas: 3.07 },
  { month: 'Jan', roas: 3.21 },
  { month: 'Feb', roas: 3.17 },
  { month: 'Mar', roas: 3.99 },
]

export const mockCacTrend = [
  { month: 'Oct', cac: 42.3 },
  { month: 'Nov', cac: 38.8 },
  { month: 'Dec', cac: 38.2 },
  { month: 'Jan', cac: 40.1 },
  { month: 'Feb', cac: 37.8 },
  { month: 'Mar', cac: 35.2 },
]

export const mockSpendVsRevenue = [
  { month: 'Oct', spend: 2_500, revenue: 7_200 },
  { month: 'Nov', spend: 3_240, revenue: 9_840 },
  { month: 'Dec', spend: 4_600, revenue: 14_100 },
  { month: 'Jan', spend: 2_680, revenue: 8_620 },
  { month: 'Feb', spend: 3_290, revenue: 10_440 },
  { month: 'Mar', spend: 3_710, revenue: 14_820 },
]

// Instagram follower count — manual input
export const mockInstagramFollowers = {
  current: 14_820,
  lastMonth: 13_240,
  delta: 1_580,
  deltaPercent: 11.9,
}
