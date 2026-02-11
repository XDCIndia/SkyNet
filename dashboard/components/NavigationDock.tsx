'use client';

import { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { 
  LayoutDashboard, 
  Building2, 
  Wrench, 
  Globe,
  Link2, 
  Crown, 
  RefreshCw, 
  FileText, 
  Monitor, 
  HardDrive,
  Pickaxe
} from 'lucide-react';

interface NavItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  path: string;
}

const navItems: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard className="w-5 h-5" />, path: '/' },
  { id: 'executive', label: 'Executive', icon: <Building2 className="w-5 h-5" />, path: '/executive' },
  { id: 'fleet', label: 'Fleet', icon: <Wrench className="w-5 h-5" />, path: '/fleet' },
  { id: 'peers', label: 'Peers', icon: <Globe className="w-5 h-5" />, path: '/peers' },
  { id: 'masternodes', label: 'Masternodes', icon: <Pickaxe className="w-5 h-5" />, path: '/masternodes' },
];

// Original dock items for home page scrolling
const dockItems = [
  { id: 'blockchain', label: 'Blockchain', icon: <Link2 className="w-6 h-6" /> },
  { id: 'consensus', label: 'Consensus', icon: <Crown className="w-6 h-6" /> },
  { id: 'sync', label: 'Sync', icon: <RefreshCw className="w-6 h-6" /> },
  { id: 'transactions', label: 'TxPool', icon: <FileText className="w-6 h-6" /> },
  { id: 'server', label: 'Server', icon: <Monitor className="w-6 h-6" /> },
  { id: 'storage', label: 'Storage', icon: <HardDrive className="w-6 h-6" /> },
  { id: 'map', label: 'Map', icon: <Globe className="w-6 h-6" /> },
];

export default function NavigationDock() {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const pathname = usePathname();
  const router = useRouter();
  
  const isHomePage = pathname === '/';
  const items = isHomePage ? dockItems.map(d => ({ ...d, path: '#' })) : navItems;
  
  // Track active section based on scroll position for home page
  const [activeSection, setActiveSection] = useState<string>('blockchain');
  
  useEffect(() => {
    if (!isHomePage) return;
    
    const handleScroll = () => {
      const scrollPosition = window.scrollY + window.innerHeight / 2;
      
      for (const item of dockItems) {
        const element = document.getElementById(item.id);
        if (element) {
          const { offsetTop, offsetHeight } = element;
          if (scrollPosition >= offsetTop && scrollPosition < offsetTop + offsetHeight) {
            setActiveSection(item.id);
            break;
          }
        }
      }
    };
    
    window.addEventListener('scroll', handleScroll);
    handleScroll();
    
    return () => window.removeEventListener('scroll', handleScroll);
  }, [isHomePage]);

  const handleClick = (item: typeof items[0], index: number) => {
    if (isHomePage) {
      // Scroll to section on home page
      const element = document.getElementById(item.id);
      if (element) {
        const offset = 100;
        const elementPosition = element.getBoundingClientRect().top;
        const offsetPosition = elementPosition + window.pageYOffset - offset;
        
        window.scrollTo({
          top: offsetPosition,
          behavior: 'smooth'
        });
      }
    } else {
      // Navigate to page
      router.push(item.path);
    }
  };

  const getScale = (index: number): number => {
    if (hoveredIndex === null) return 1;
    const distance = Math.abs(index - hoveredIndex);
    if (distance === 0) return 1.5;
    if (distance === 1) return 1.2;
    if (distance === 2) return 1.05;
    return 1;
  };

  const getTranslateY = (index: number): number => {
    if (hoveredIndex === null) return 0;
    const distance = Math.abs(index - hoveredIndex);
    if (distance === 0) return -12;
    if (distance === 1) return -6;
    return 0;
  };

  const isActive = (item: typeof items[0]) => {
    if (isHomePage) {
      return activeSection === item.id;
    }
    return pathname === item.path;
  };

  return (
    <div className="dock">
      {items.map((item, index) => (
        <button
          key={item.id}
          className={`dock-item ${isActive(item) ? 'active' : ''}`}
          onClick={() => handleClick(item, index)}
          onMouseEnter={() => setHoveredIndex(index)}
          onMouseLeave={() => setHoveredIndex(null)}
          style={{
            transform: `scale(${getScale(index)}) translateY(${getTranslateY(index)}px)`,
          }}
          aria-label={item.label}
        >
          <span className="dock-icon">{item.icon}</span>
          <span className="dock-label">{item.label}</span>
        </button>
      ))}
    </div>
  );
}
