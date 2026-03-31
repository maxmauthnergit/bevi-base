import type { DataSource } from './index'
import type { SyncStatus } from '../types'

// ─── Meta Ads Integration ─────────────────────────────────────────────────────
// Meta Marketing API
// Pulls: campaign spend, impressions, clicks, purchases, ROAS
// Sync: daily snapshot → Supabase
//
// Required env vars:
//   META_ACCESS_TOKEN    long-lived user access token or system user token
//   META_AD_ACCOUNT_ID   act_XXXXXXXXX

export const metaIntegration: DataSource = {
  name: 'meta',
  displayName: 'Meta Ads',

  async sync(): Promise<void> {
    // TODO Phase 2: pull insights from Meta Marketing API and store in Supabase
    // Endpoint: GET /{ad-account-id}/insights
    // Fields: spend, impressions, clicks, cpm, cpc, purchase_roas, actions
    throw new Error('Meta Ads sync not yet implemented')
  },

  async getStatus(): Promise<SyncStatus> {
    return {
      source: 'meta',
      status: 'idle',
      lastSync: null,
    }
  },
}
