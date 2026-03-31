import type { SyncStatus } from '../types'

// ─── DataSource interface ─────────────────────────────────────────────────────
// Each integration implements this interface.
// Adding a new source = create one file, register it below. Nothing else changes.

export interface DataSource {
  name: string
  displayName: string
  sync(): Promise<void>
  getStatus(): Promise<SyncStatus>
}

// ─── Registry ─────────────────────────────────────────────────────────────────
// Import and register integrations here.

import { shopifyIntegration } from './shopify'
import { metaIntegration } from './meta'
import { paypalIntegration } from './paypal'
import { weshipIntegration } from './weship'

export const integrations: DataSource[] = [
  shopifyIntegration,
  metaIntegration,
  paypalIntegration,
  weshipIntegration,
]

export function getIntegration(name: string): DataSource | undefined {
  return integrations.find((i) => i.name === name)
}
