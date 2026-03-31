import type { DataSource } from './index'
import type { SyncStatus } from '../types'

// ─── Shopify Integration ──────────────────────────────────────────────────────
// REST Admin API
// Pulls: orders, products, sessions
// Sync: nightly cron + on-demand for today's numbers
//
// Required env vars:
//   SHOPIFY_STORE_DOMAIN   e.g. bevi-bag.myshopify.com
//   SHOPIFY_ACCESS_TOKEN   private app token

export const shopifyIntegration: DataSource = {
  name: 'shopify',
  displayName: 'Shopify',

  async sync(): Promise<void> {
    // TODO Phase 2: pull orders from Shopify REST API and upsert into Supabase
    // Endpoint: GET /admin/api/2024-01/orders.json
    // Auth: X-Shopify-Access-Token header
    throw new Error('Shopify sync not yet implemented')
  },

  async getStatus(): Promise<SyncStatus> {
    // TODO Phase 2: read last sync timestamp from Supabase
    return {
      source: 'shopify',
      status: 'idle',
      lastSync: null,
    }
  },
}
