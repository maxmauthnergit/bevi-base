import { Card, CardHeader } from '@/components/ui/Card'
import { integrations } from '@/lib/integrations'

const manualInputFields = [
  {
    id: 'bank_balance',
    label: 'Bank Balance (Sparkasse)',
    type: 'euro',
    frequency: 'Ad hoc',
    description: 'Current balance of the Sparkasse business account',
  },
  {
    id: 'weship_invoice',
    label: 'WeShip Monthly Invoice',
    type: 'euro',
    frequency: 'Monthly',
    description: 'Total invoice amount from WeShip EU/AT (~1st of month)',
  },
  {
    id: 'inventory',
    label: 'Inventory Level (per SKU)',
    type: 'number',
    frequency: 'Weekly',
    description: 'Current stock units — check WeShip portal',
  },
  {
    id: 'liability',
    label: 'Outstanding Liability',
    type: 'euro',
    frequency: 'As needed',
    description: 'Patent costs, shareholder loan, or other obligations',
  },
] as const

const apiCredentialFields = [
  {
    source: 'Shopify',
    fields: ['SHOPIFY_STORE_DOMAIN', 'SHOPIFY_ACCESS_TOKEN'],
    status: 'Not configured',
  },
  {
    source: 'Meta Ads',
    fields: ['META_ACCESS_TOKEN', 'META_AD_ACCOUNT_ID'],
    status: 'Not configured',
  },
  {
    source: 'PayPal',
    fields: ['PAYPAL_CLIENT_ID', 'PAYPAL_CLIENT_SECRET'],
    status: 'Not configured',
  },
  {
    source: 'WeShip EU/AT',
    fields: ['No API available'],
    status: 'Manual only',
  },
]

export default function SettingsPage() {
  return (
    <main style={{ padding: '32px 40px', maxWidth: 1000 }}>
      {/* Header */}
      <div className="mb-8">
        <span className="label" style={{ display: 'block', marginBottom: 8 }}>Configuration</span>
        <h1
          style={{
            fontFamily: "'Gustavo', 'Helvetica Neue', Helvetica, Arial, sans-serif",
            fontSize: '1.5rem',
            fontWeight: 500,
            color: '#FFFFFF',
            margin: 0,
          }}
        >
          Settings & Data Sync
        </h1>
      </div>

      {/* Data sources status */}
      <Card className="mb-4">
        <CardHeader label="Data Sources" />
        <div className="flex flex-col gap-0">
          {integrations.map((integration, i) => (
            <div
              key={integration.name}
              className="flex items-center justify-between py-3"
              style={{ borderBottom: i < integrations.length - 1 ? '1px solid #1C1C1C' : 'none' }}
            >
              <div>
                <span
                  style={{
                    fontFamily: "'Gustavo', 'Helvetica Neue', Helvetica, Arial, sans-serif",
                    fontSize: '0.875rem',
                    color: '#CCC',
                    display: 'block',
                    marginBottom: 2,
                  }}
                >
                  {integration.displayName}
                </span>
                <span className="label" style={{ color: '#333' }}>
                  {integration.name === 'weship' ? 'Manual entry only' : 'Nightly sync · API'}
                </span>
              </div>

              <div className="flex items-center gap-3">
                <span className="label" style={{ color: '#444' }}>Last sync: —</span>

                {/* Status badge */}
                <div
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 5,
                    padding: '3px 10px',
                    borderRadius: '2px',
                    backgroundColor: 'rgba(255,68,68,0.08)',
                    border: '1px solid rgba(255,68,68,0.2)',
                  }}
                >
                  <span
                    style={{
                      width: 5,
                      height: 5,
                      borderRadius: '50%',
                      backgroundColor: '#FF4444',
                      display: 'inline-block',
                    }}
                  />
                  <span className="label" style={{ color: '#FF4444' }}>
                    {integration.name === 'weship' ? 'Manual' : 'Not connected'}
                  </span>
                </div>

                {/* Sync button stub */}
                {integration.name !== 'weship' && (
                  <button
                    disabled
                    style={{
                      padding: '4px 12px',
                      borderRadius: '2px',
                      border: '1px solid #2A2A2A',
                      backgroundColor: 'transparent',
                      color: '#444',
                      fontFamily: "'Gustavo', 'Helvetica Neue', Helvetica, Arial, sans-serif",
                      fontSize: '0.75rem',
                      cursor: 'not-allowed',
                      letterSpacing: '0.04em',
                    }}
                  >
                    Sync now
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* API credentials */}
      <Card className="mb-4">
        <CardHeader
          label="API Credentials"
          action={
            <span className="label" style={{ color: '#333' }}>
              Stored encrypted in Supabase
            </span>
          }
        />
        <div className="flex flex-col gap-4">
          {apiCredentialFields.map((api) => (
            <div
              key={api.source}
              style={{
                padding: '14px 16px',
                backgroundColor: '#111',
                borderRadius: '4px',
                border: '1px solid #1C1C1C',
              }}
            >
              <div className="flex items-center justify-between mb-3">
                <span
                  style={{
                    fontFamily: "'Gustavo', 'Helvetica Neue', Helvetica, Arial, sans-serif",
                    fontSize: '0.875rem',
                    color: '#999',
                  }}
                >
                  {api.source}
                </span>
                <span className="label" style={{ color: '#333' }}>{api.status}</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {api.fields.map((field) => (
                  <span
                    key={field}
                    className="metric"
                    style={{
                      fontSize: '0.6875rem',
                      color: '#333',
                      backgroundColor: '#0D0D0D',
                      border: '1px solid #1A1A1A',
                      borderRadius: '2px',
                      padding: '2px 7px',
                    }}
                  >
                    {field}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
        <p
          style={{
            fontFamily: "'Gustavo', 'Helvetica Neue', Helvetica, Arial, sans-serif",
            fontSize: '0.75rem',
            color: '#333',
            marginTop: 12,
            marginBottom: 0,
          }}
        >
          Configure credentials in <code style={{ color: '#444', fontFamily: 'monospace' }}>.env.local</code> —
          see <code style={{ color: '#444', fontFamily: 'monospace' }}>.env.local.example</code> for all required keys.
        </p>
      </Card>

      {/* Manual data entry */}
      <Card>
        <CardHeader
          label="Manual Data Entry"
          action={
            <span className="label" style={{ color: '#333' }}>Stored in Supabase · manual_entries</span>
          }
        />
        <div className="flex flex-col gap-3">
          {manualInputFields.map((field) => (
            <div
              key={field.id}
              className="flex items-center justify-between py-3"
              style={{ borderBottom: '1px solid #1A1A1A' }}
            >
              <div>
                <span
                  style={{
                    fontFamily: "'Gustavo', 'Helvetica Neue', Helvetica, Arial, sans-serif",
                    fontSize: '0.875rem',
                    color: '#CCC',
                    display: 'block',
                    marginBottom: 2,
                  }}
                >
                  {field.label}
                </span>
                <span className="label" style={{ color: '#333' }}>{field.description}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="label" style={{ color: '#333' }}>{field.frequency}</span>
                <button
                  disabled
                  style={{
                    padding: '5px 14px',
                    borderRadius: '2px',
                    border: '1px solid #2A2A2A',
                    backgroundColor: 'transparent',
                    color: '#555',
                    fontFamily: "'Gustavo', 'Helvetica Neue', Helvetica, Arial, sans-serif",
                    fontSize: '0.75rem',
                    cursor: 'not-allowed',
                    letterSpacing: '0.04em',
                  }}
                >
                  Enter value
                </button>
              </div>
            </div>
          ))}
        </div>
        <p
          style={{
            fontFamily: "'Gustavo', 'Helvetica Neue', Helvetica, Arial, sans-serif",
            fontSize: '0.75rem',
            color: '#333',
            marginTop: 12,
            marginBottom: 0,
          }}
        >
          Manual entry forms will be wired to Supabase in Phase 2.
        </p>
      </Card>
    </main>
  )
}
