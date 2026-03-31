import type { DataSource } from './index'
import type { SyncStatus } from '../types'

// ─── PayPal Integration ───────────────────────────────────────────────────────
// PayPal REST API (v2)
// Pulls: transactions, current balance
// Sync: daily snapshot
//
// Required env vars:
//   PAYPAL_CLIENT_ID
//   PAYPAL_CLIENT_SECRET
//   PAYPAL_ENV   'sandbox' | 'live'

export const paypalIntegration: DataSource = {
  name: 'paypal',
  displayName: 'PayPal',

  async sync(): Promise<void> {
    // TODO Phase 2: authenticate with PayPal OAuth2 and pull transaction list
    // Auth endpoint: POST /v1/oauth2/token
    // Transactions: GET /v1/reporting/transactions
    // Balance: GET /v1/reporting/balances
    throw new Error('PayPal sync not yet implemented')
  },

  async getStatus(): Promise<SyncStatus> {
    return {
      source: 'paypal',
      status: 'idle',
      lastSync: null,
    }
  },
}
