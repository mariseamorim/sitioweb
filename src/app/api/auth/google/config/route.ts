import { NextResponse } from 'next/server'
import { googleConfig } from '@/lib/google-auth'

export function GET() { return NextResponse.json({ enabled: !!googleConfig() }, { headers: { 'Cache-Control': 'no-store' } }) }
