import Sidebar from './Sidebar';

interface DashboardLayoutProps {
  children: React.ReactNode;
  headerProps?: Record<string, unknown>;
  showHeader?: boolean;
}

export default function DashboardLayout({ 
  children, 
}: DashboardLayoutProps) {
  return (
    <div className="min-h-screen bg-[var(--bg-body)]">
      <Sidebar />
      
      {/* Main content — offset by sidebar width on desktop, header height on mobile */}
      <main className="lg:ml-[220px] min-h-screen pb-6 pt-16 lg:pt-0">
        <div className="max-w-[1440px] mx-auto px-4 lg:px-6 py-4">
          {children}
        </div>
      </main>
    </div>
  );
}
