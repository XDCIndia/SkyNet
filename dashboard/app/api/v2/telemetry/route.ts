// Redirect to /report or /nodes
import { NextResponse } from 'next/server';
export async function GET() {
  return NextResponse.json({ endpoints: ['/api/v2/telemetry/report (POST)', '/api/v2/telemetry/nodes (GET)'] });
}
