import { Suspense } from 'react';
import { Metadata } from 'next';
import NodesPageContent from './NodesPageContent';
import { RefreshCw } from 'lucide-react';

export const metadata: Metadata = {
  title: 'SkyNet Nodes | XDC Network',
  description: 'Monitor and manage XDC SkyNet fleet nodes',
};

/**
 * SkyNet Nodes Page with Suspense boundary
 */
export default function NodesPage() {
  return (
    <Suspense fallback={<NodesPageSkeleton />}>
      <NodesPageContent />
    </Suspense>
  );
}

function NodesPageSkeleton() {
  return (
    <div className="p-6 space-y-6">
      {/* Header Skeleton */}
      <div className="flex items-center justify-between">
        <div className="animate-pulse">
          <div className="h-8 w-48 bg-[rgba(255,255,255,0.1)] rounded mb-2" />
          <div className="h-4 w-32 bg-[rgba(255,255,255,0.1)] rounded" />
        </div>
        <div className="flex items-center gap-3">
          <RefreshCw className="w-5 h-5 text-[#1E90FF] animate-spin" />
        </div>
      </div>

      {/* Stats Grid Skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="p-4 rounded-xl border bg-[#111827] border-[rgba(255,255,255,0.06)] animate-pulse"
          >
            <div className="h-4 bg-[rgba(255,255,255,0.1)] rounded mb-3 w-2/3" />
            <div className="h-8 bg-[rgba(255,255,255,0.1)] rounded mb-2" />
            <div className="h-3 bg-[rgba(255,255,255,0.1)] rounded w-1/2" />
          </div>
        ))}
      </div>

      {/* Charts Skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {[1, 2].map((i) => (
          <div
            key={i}
            className="p-4 rounded-xl border bg-[#111827] border-[rgba(255,255,255,0.06)] animate-pulse"
          >
            <div className="h-5 bg-[rgba(255,255,255,0.1)] rounded mb-4 w-1/3" />
            <div className="h-48 bg-[rgba(255,255,255,0.1)] rounded" />
          </div>
        ))}
      </div>

      {/* Node Cards Skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
        {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
          <div
            key={i}
            className="p-4 rounded-xl border bg-[#111827] border-[rgba(255,255,255,0.06)] animate-pulse"
          >
            <div className="h-4 bg-[rgba(255,255,255,0.1)] rounded mb-3 w-2/3" />
            <div className="h-3 bg-[rgba(255,255,255,0.1)] rounded mb-2" />
            <div className="h-3 bg-[rgba(255,255,255,0.1)] rounded mb-4 w-1/2" />
            <div className="space-y-2">
              <div className="h-2 bg-[rgba(255,255,255,0.1)] rounded" />
              <div className="h-2 bg-[rgba(255,255,255,0.1)] rounded" />
              <div className="h-2 bg-[rgba(255,255,255,0.1)] rounded" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
