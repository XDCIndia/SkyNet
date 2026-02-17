'use client';

import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Globe } from 'lucide-react';

interface NetworkFilterProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

const NETWORK_OPTIONS = [
  { value: 'all', label: 'All Networks', icon: '🌐' },
  { value: 'mainnet', label: 'XDC Mainnet', icon: '🔷' },
  { value: 'apothem', label: 'Apothem Testnet', icon: '🧪' },
  { value: 'devnet', label: 'Devnet', icon: '⚙️' },
];

/**
 * Network Filter Dropdown Component
 * Filter nodes by network (mainnet, apothem, devnet)
 */
export default function NetworkFilter({ value, onChange, className = '' }: NetworkFilterProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  const selectedOption = NETWORK_OPTIONS.find(opt => opt.value === value) || NETWORK_OPTIONS[0];

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (optionValue: string) => {
    onChange(optionValue);
    setIsOpen(false);
  };

  return (
    <div ref={dropdownRef} className={`relative ${className}`}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`
          flex items-center gap-2 px-3 py-2 rounded-lg 
          bg-[var(--bg-body)] border border-[rgba(255,255,255,0.1)]
          text-sm text-[#F9FAFB] hover:border-[var(--accent-blue)]
          transition-colors min-w-[160px] justify-between
          ${isOpen ? 'border-[var(--accent-blue)]' : ''}
        `}
      >
        <div className="flex items-center gap-2">
          <Globe className="w-4 h-4 text-[var(--accent-blue)]" />
          <span>{selectedOption.label}</span>
        </div>
        <ChevronDown 
          className={`w-4 h-4 text-[#6B7280] transition-transform ${isOpen ? 'rotate-180' : ''}`} 
        />
      </button>

      {isOpen && (
        <div className="
          absolute top-full left-0 mt-1 
          w-full min-w-[200px] rounded-lg 
          bg-[#1a2234] border border-[rgba(255,255,255,0.1)]
          shadow-lg z-50 overflow-hidden
        ">
          {NETWORK_OPTIONS.map((option) => (
            <button
              key={option.value}
              onClick={() => handleSelect(option.value)}
              className={`
                w-full flex items-center gap-3 px-3 py-2.5 text-left
                text-sm transition-colors
                ${value === option.value 
                  ? 'bg-[rgba(30,144,255,0.15)] text-[var(--accent-blue)]' 
                  : 'text-[#F9FAFB] hover:bg-[rgba(255,255,255,0.05)]'
                }
              `}
            >
              <span className="text-lg">{option.icon}</span>
              <span>{option.label}</span>
              {value === option.value && (
                <div className="ml-auto w-2 h-2 rounded-full bg-[var(--accent-blue)]" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
