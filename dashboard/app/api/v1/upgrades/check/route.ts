import { NextRequest, NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import { authenticateRequest, unauthorizedResponse } from '@/lib/auth';

// Cache for Docker Hub version checks
let cachedVersion: { version: string; timestamp: number } | null = null;
const CACHE_DURATION_MS = 5 * 60 * 1000; // 5 minutes

async function fetchLatestDockerVersion(): Promise<string | null> {
  try {
    // Fetch from Docker Hub API for xdcnode/xdc image
    const response = await fetch(
      'https://hub.docker.com/v2/repositories/xdcnode/xdc/tags?page_size=20&ordering=last_updated',
      { next: { revalidate: 300 } } // Cache for 5 minutes
    );

    if (!response.ok) {
      console.error('Docker Hub API error:', response.status);
      return null;
    }

    const data = await response.json();
    
    // Find the latest stable version tag (not "latest" or "mainnet" or "testnet")
    const versionTag = data.results?.find((tag: any) => {
      const name = tag.name;
      return name.match(/^v?\d+\.\d+\.\d+$/); // Match semantic version patterns like v2.6.8 or 2.6.8
    });

    return versionTag?.name || null;
  } catch (error) {
    console.error('Error fetching Docker Hub version:', error);
    return null;
  }
}

/**
 * GET /api/v1/upgrades/check
 * Returns latest available XDC version from Docker Hub
 * Cache for 5 minutes
 * Response: { latest: "v2.6.8", current?: "v2.6.7", updateAvailable: boolean }
 * Auth: Bearer API key
 */
export async function GET(request: NextRequest) {
  try {
    // Authenticate request
    const auth = await authenticateRequest(request);
    if (!auth.valid) {
      return unauthorizedResponse(auth.error);
    }

    // Check cache
    const now = Date.now();
    let latestVersion: string | null = null;

    if (cachedVersion && (now - cachedVersion.timestamp) < CACHE_DURATION_MS) {
      latestVersion = cachedVersion.version;
    } else {
      latestVersion = await fetchLatestDockerVersion();
      if (latestVersion) {
        cachedVersion = { version: latestVersion, timestamp: now };
      }
    }

    // Get current version from query param (if provided by caller)
    const { searchParams } = new URL(request.url);
    const currentVersion = searchParams.get('current') || undefined;

    // Determine if update is available
    let updateAvailable = false;
    if (latestVersion && currentVersion) {
      // Simple version comparison - can be improved with semver
      const cleanLatest = latestVersion.replace(/^v/, '');
      const cleanCurrent = currentVersion.replace(/^v/, '');
      updateAvailable = cleanLatest !== cleanCurrent;
    }

    if (!latestVersion) {
      return NextResponse.json(
        { error: 'Unable to fetch latest version from Docker Hub', code: 'FETCH_ERROR' },
        { status: 503 }
      );
    }

    return NextResponse.json({
      latest: latestVersion,
      current: currentVersion,
      updateAvailable,
      cached: cachedVersion?.timestamp === now ? false : true,
    });
  } catch (error: any) {
    console.error('Error checking upgrades:', error);
    
    return NextResponse.json(
      { error: 'Failed to check upgrades', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}
