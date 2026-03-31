import type { DataSource } from './index'
import type { SyncStatus } from '../types'

// ─── WeShip EU/AT Integration ─────────────────────────────────────────────────
// Note: WeShip EU/AT (different from weship.com) does not currently offer a
// public API. All data is entered manually via the dashboard.
// This stub is ready for Phase 2 if an API becomes available.
//
// Manual inputs stored in Supabase via the Settings page:
//   - Monthly invoice total (arrives ~1st of month)
//   - Cost breakdown: packaging / shipping / storage
//   - Current inventory per SKU (weekly manual check)

export const weshipIntegration: DataSource = {
  name: 'weship',
  displayName: 'WeShip EU/AT',

  async sync(): Promise<void> {
    // Manual-entry only for now.
    // TODO Phase 2: if WeShip API becomes available, implement here
    throw new Error('WeShip has no API — data is entered manually')
  },

  async getStatus(): Promise<SyncStatus> {
    return {
      source: 'weship',
      status: 'idle',
      lastSync: null,
    }
  },
}
