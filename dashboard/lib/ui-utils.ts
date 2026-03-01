/**
 * Shared UI utility functions for XDC SkyNet Dashboard
 * Centralizes common UI helper functions to avoid duplication across pages
 */

/**
 * Truncate an address for display
 * @param addr - The address to truncate
 * @param start - Number of characters to show at start
 * @param end - Number of characters to show at end
 * @returns Truncated address string
 */
export function truncateAddress(addr: string, start = 6, end = 4): string {
  if (!addr || addr.length <= start + end + 3) return addr;
  return `${addr.slice(0, start)}...${addr.slice(-end)}`;
}

/**
 * Convert Ethereum address to XDC address format
 * @param address - Ethereum format address (0x...)
 * @returns XDC format address (xdc...)
 */
export function toXdcAddress(address: string): string {
  if (!address) return '';
  if (address.toLowerCase().startsWith('0x')) {
    return 'xdc' + address.slice(2);
  }
  return address;
}

/**
 * Convert XDC address to Ethereum format
 * @param address - XDC format address (xdc...)
 * @returns Ethereum format address (0x...)
 */
export function fromXdcAddress(address: string): string {
  if (!address) return '';
  if (address.toLowerCase().startsWith('xdc')) {
    return '0x' + address.slice(3);
  }
  return address;
}

/**
 * Format a number as currency
 * @param value - Number to format
 * @param currency - Currency code
 * @param decimals - Number of decimal places
 * @returns Formatted currency string
 */
export function formatCurrency(
  value: number | string,
  currency = 'USD',
  decimals = 2
): string {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return '-';
  
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(num);
}

/**
 * Format a number with commas and fixed decimals
 * @param value - Number to format
 * @param decimals - Number of decimal places
 * @returns Formatted number string
 */
export function formatNumber(
  value: number | string,
  decimals = 0
): string {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return '-';
  
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(num);
}

/**
 * Format a percentage value
 * @param value - Number to format (e.g., 0.15 for 15%)
 * @param decimals - Number of decimal places
 * @returns Formatted percentage string
 */
export function formatPercent(
  value: number | string,
  decimals = 2
): string {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return '-';
  
  return new Intl.NumberFormat('en-US', {
    style: 'percent',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(num);
}

/**
 * Format bytes to human readable string
 * Re-export from formatters.ts to maintain backward compatibility
 * @param bytes - Number of bytes
 * @param decimals - Number of decimal places
 * @returns Human readable string (e.g., "1.5 GB")
 */
export { formatBytes } from './formatters';

/**
 * Format duration in milliseconds to human readable string
 * @param ms - Duration in milliseconds
 * @returns Human readable duration string
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  if (ms < 3600000) return `${(ms / 60000).toFixed(1)}m`;
  return `${(ms / 3600000).toFixed(1)}h`;
}

/**
 * Format a timestamp to relative time (e.g., "2 hours ago")
 * @param date - Date to format
 * @returns Relative time string
 */
export function formatRelativeTime(date: Date | string | number): string {
  const now = new Date();
  const then = new Date(date);
  const diffMs = now.getTime() - then.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);
  
  if (diffSecs < 60) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 30) return `${diffDays}d ago`;
  
  return then.toLocaleDateString();
}

/**
 * Get status color class based on status string
 * @param status - Status string
 * @returns Tailwind color class
 */
export function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    active: 'text-green-600 bg-green-100',
    healthy: 'text-green-600 bg-green-100',
    online: 'text-green-600 bg-green-100',
    standby: 'text-yellow-600 bg-yellow-100',
    warning: 'text-yellow-600 bg-yellow-100',
    penalized: 'text-red-600 bg-red-100',
    error: 'text-red-600 bg-red-100',
    offline: 'text-red-600 bg-red-100',
    critical: 'text-red-600 bg-red-100',
    inactive: 'text-gray-600 bg-gray-100',
    pending: 'text-blue-600 bg-blue-100',
    syncing: 'text-blue-600 bg-blue-100',
  };
  
  return colors[status.toLowerCase()] || 'text-gray-600 bg-gray-100';
}

/**
 * Get client type color class
 * @param clientType - Client type string
 * @returns Tailwind color class
 */
export function getClientColor(clientType: string): string {
  const colors: Record<string, string> = {
    geth: 'text-blue-600 bg-blue-100',
    erigon: 'text-purple-600 bg-purple-100',
    nethermind: 'text-orange-600 bg-orange-100',
    reth: 'text-pink-600 bg-pink-100',
    besu: 'text-indigo-600 bg-indigo-100',
  };
  
  return colors[clientType?.toLowerCase()] || 'text-gray-600 bg-gray-100';
}

/**
 * Copy text to clipboard
 * @param text - Text to copy
 * @returns Promise that resolves when copy is complete
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (err) {
    console.error('Failed to copy:', err);
    return false;
  }
}

/**
 * Debounce function calls
 * @param fn - Function to debounce
 * @param delay - Delay in milliseconds
 * @returns Debounced function
 */
export function debounce<T extends (...args: unknown[]) => unknown>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout>;
  
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
}

/**
 * Calculate health score color
 * @param score - Health score (0-100)
 * @returns Color code for the score
 */
export function getHealthScoreColor(score: number): string {
  if (score >= 90) return '#10b981'; // green-500
  if (score >= 70) return '#f59e0b'; // amber-500
  if (score >= 50) return '#f97316'; // orange-500
  return '#ef4444'; // red-500
}

/**
 * Calculate health score rating text
 * @param score - Health score (0-100)
 * @returns Rating text
 */
export function getHealthScoreRating(score: number): string {
  if (score >= 90) return 'Excellent';
  if (score >= 70) return 'Good';
  if (score >= 50) return 'Fair';
  return 'Poor';
}
