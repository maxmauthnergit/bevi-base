import { NextResponse } from 'next/server'
import { getMetaTokenInfo } from '@/lib/meta/token'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    return NextResponse.json(await getMetaTokenInfo())
  } catch (e) {
    const message = (e as Error).message
    const status  = message === 'META_ACCESS_TOKEN not set' ? 400 : 500
    return NextResponse.json({ error: message }, { status })
  }
}
