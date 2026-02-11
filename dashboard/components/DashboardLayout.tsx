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
    <div className="min-h-screen bg-[#0A0E1A]">
      <Sidebar />
      
      {/* Main content — offset by sidebar width on desktop */}
      <main className="lg:ml-[220px] min-h-screen pb-20 lg:pb-6">
        <div className="max-w-[1440px] mx-auto px-4 lg:px-6 py-4">
          {children}
        </div>
      </main>
    </div>
  );
}
