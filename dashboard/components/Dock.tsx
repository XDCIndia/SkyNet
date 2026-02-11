'use client';

import { useState, useEffect } from 'react';
import { 
  Link2, 
  Crown, 
  RefreshCw, 
  FileText, 
  Monitor, 
  HardDrive, 
  Globe 
} from 'lucide-react';

interface DockItemType {
  id: string;
  label: string;
  icon: React.ReactNode;
}

const dockItems: DockItemType[] = [
  { id: 'blockchain', label: 'Blockchain', icon: <Link2 className="w-6 h-6" /> },
  { id: 'consensus', label: 'Consensus', icon: <Crown className="w-6 h-6" /> },
  { id: 'sync', label: 'Sync', icon: <RefreshCw className="w-6 h-6" /> },
  { id: 'transactions', label: 'TxPool', icon: <FileText className="w-6 h-6" /> },
  { id: 'server', label: 'Server', icon: <Monitor className="w-6 h-6" /> },
  { id: 'storage', label: 'Storage', icon: <HardDrive className="w-6 h-6" /> },
  { id: 'map', label: 'Map', icon: <Globe className="w-6 h-6" /> },
];

export default function Dock() {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [activeSection, setActiveSection] = useState<string>('blockchain');
  
  // Track active section based on scroll position
  useEffect(() => {
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
    handleScroll(); // Initial check
    
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleClick = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      const offset = 100; // Account for header
      const elementPosition = element.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.pageYOffset - offset;
      
      window.scrollTo({
        top: offsetPosition,
        behavior: 'smooth'
      });
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

  return (
    <div className="dock">
      {dockItems.map((item, index) => (
        <button
          key={item.id}
          className={`dock-item ${activeSection === item.id ? 'active' : ''}`}
          onClick={() => handleClick(item.id)}
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
