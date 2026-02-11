import Header from './Header';
import NavigationDock from './NavigationDock';

interface DashboardLayoutProps {
  children: React.ReactNode;
  headerProps?: {
    lastUpdated?: string | null;
    connected?: boolean;
    nextRefresh?: number;
    refreshInterval?: number;
    blockHeight?: number;
    peers?: number;
    isSyncing?: boolean;
    coinbase?: string;
    ethstatsName?: string;
  };
  showHeader?: boolean;
}

export default function DashboardLayout({ 
  children, 
  headerProps,
  showHeader = true 
}: DashboardLayoutProps) {
  const defaultHeaderProps = {
    lastUpdated: new Date().toISOString(),
    connected: true,
    nextRefresh: 10,
    refreshInterval: 10,
    blockHeight: 85000000,
    peers: 25,
    isSyncing: false,
    coinbase: 'xdc0x1234567890abcdef',
    ethstatsName: 'XDCNetOwn',
  };

  const mergedProps = { ...defaultHeaderProps, ...headerProps };

  return (
    <div className="min-h-screen bg-[#0A0E1A]">
      {showHeader && (
        <Header
          lastUpdated={mergedProps.lastUpdated}
          connected={mergedProps.connected}
          nextRefresh={mergedProps.nextRefresh}
          refreshInterval={mergedProps.refreshInterval}
          blockHeight={mergedProps.blockHeight}
          peers={mergedProps.peers}
          isSyncing={mergedProps.isSyncing}
          coinbase={mergedProps.coinbase}
          ethstatsName={mergedProps.ethstatsName}
        />
      )}
      
      <NavigationDock />
      
      <main className="max-w-[1440px] mx-auto px-4 lg:px-6 py-6">
        {children}
      </main>
      
      <footer className="border-t border-[rgba(255,255,255,0.06)] mt-8 py-6">
        <div className="max-w-[1440px] mx-auto px-4 text-center text-sm text-[#6B7280]">
          <p>XDC NetOwn Dashboard &copy; {new Date().getFullYear()}</p>
          <p className="mt-1">
            Multi-Node Fleet Management &middot; Built with Next.js 14
          </p>
        </div>
      </footer>
    </div>
  );
}
