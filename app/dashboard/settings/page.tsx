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
        <h1
          style={{
            fontFamily: "'Gustavo', 'Helvetica Neue', Helvetica, Arial, sans-serif",
            fontSize: '1.75rem',
            fontWeight: 600,
            color: '#111110',
            margin: 0,
          }}
        >
          Settings
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
              style={{ borderBottom: i < integrations.length - 1 ? '1px solid #F0EFE9' : 'none' }}
            >
              <div>
                <span
                  style={{
                    fontFamily: "'Gustavo', 'Helvetica Neue', Helvetica, Arial, sans-serif",
                    fontSize: '0.875rem',
                    color: '#111110',
                    display: 'block',
                    marginBottom: 2,
                  }}
                >
                  {integration.displayName}
                </span>
                <span className="label">
                  {integration.name === 'weship' ? 'Manual entry only' : 'Nightly sync · API'}
                </span>
              </div>

              <div className="flex items-center gap-3">
                <span className="label">Last sync: —</span>

                {/* Status badge */}
                <div
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 5,
                    padding: '3px 10px',
                    borderRadius: 6,
                    backgroundColor: 'rgba(220,38,38,0.08)',
                    border: '1px solid rgba(220,38,38,0.2)',
                  }}
                >
                  <span
                    style={{
                      width: 5,
                      height: 5,
                      borderRadius: '50%',
                      backgroundColor: '#DC2626',
                      display: 'inline-block',
                    }}
                  />
                  <span className="label" style={{ color: '#DC2626' }}>
                    {integration.name === 'weship' ? 'Manual' : 'Not connected'}
                  </span>
                </div>

                {/* Sync button stub */}
                {integration.name !== 'weship' && (
                  <button
                    disabled
                    style={{
                      padding: '4px 12px',
                      borderRadius: 8,
                      border: '1px solid #E3E2DC',
                      backgroundColor: '#FFFFFF',
                      color: '#9E9D98',
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
            <span className="label">Stored in .env.local</span>
          }
        />
        <div className="flex flex-col gap-3">
          {apiCredentialFields.map((api) => (
            <div
              key={api.source}
              style={{
                padding: '14px 16px',
                backgroundColor: '#F5F4F0',
                borderRadius: 10,
                border: '1px solid #E3E2DC',
              }}
            >
              <div className="flex items-center justify-between mb-3">
                <span
                  style={{
                    fontFamily: "'Gustavo', 'Helvetica Neue', Helvetica, Arial, sans-serif",
                    fontSize: '0.875rem',
                    color: '#111110',
                  }}
                >
                  {api.source}
                </span>
                <span className="label">{api.status}</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {api.fields.map((field) => (
                  <span
                    key={field}
                    className="metric"
                    style={{
                      fontSize: '0.6875rem',
                      color: '#6B6A64',
                      backgroundColor: '#EDECEA',
                      border: '1px solid #E3E2DC',
                      borderRadius: 4,
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
            color: '#9E9D98',
            marginTop: 12,
            marginBottom: 0,
          }}
        >
          Configure credentials in <code style={{ color: '#6B6A64', fontFamily: 'monospace' }}>.env.local</code> —
          see <code style={{ color: '#6B6A64', fontFamily: 'monospace' }}>.env.local.example</code> for all required keys.
        </p>
      </Card>

      {/* Manual data entry */}
      <Card>
        <CardHeader
          label="Manual Data Entry"
          action={
            <span className="label">Stored in Supabase · manual_entries</span>
          }
        />
        <div className="flex flex-col">
          {manualInputFields.map((field, i) => (
            <div
              key={field.id}
              className="flex items-center justify-between py-3"
              style={{ borderBottom: i < manualInputFields.length - 1 ? '1px solid #F0EFE9' : 'none' }}
            >
              <div>
                <span
                  style={{
                    fontFamily: "'Gustavo', 'Helvetica Neue', Helvetica, Arial, sans-serif",
                    fontSize: '0.875rem',
                    color: '#111110',
                    display: 'block',
                    marginBottom: 2,
                  }}
                >
                  {field.label}
                </span>
                <span className="label">{field.description}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="label">{field.frequency}</span>
                <button
                  disabled
                  style={{
                    padding: '5px 14px',
                    borderRadius: 8,
                    border: '1px solid #E3E2DC',
                    backgroundColor: '#FFFFFF',
                    color: '#9E9D98',
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
            color: '#9E9D98',
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
