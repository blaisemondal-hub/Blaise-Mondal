import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Search, Check, X, Filter } from 'lucide-react';

interface MultiSelectDropdownProps {
  label: string;
  options: string[];
  selected: string[];
  onChange: (selected: string[]) => void;
  placeholder?: string;
  id?: string;
}

export const MultiSelectDropdown: React.FC<MultiSelectDropdownProps> = ({
  label,
  options,
  selected,
  onChange,
  placeholder = 'Search...',
  id = 'multi-select',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleOption = (option: string) => {
    if (selected.includes(option)) {
      onChange(selected.filter((item) => item !== option));
    } else {
      onChange([...selected, option]);
    }
  };

  const handleSelectAll = () => {
    // If all filtered options are already selected, clear them. Otherwise, select all filtered.
    const filtered = options.filter(opt => 
      opt.toLowerCase().includes(searchTerm.toLowerCase())
    );
    const allFilteredSelected = filtered.every(opt => selected.includes(opt));
    
    if (allFilteredSelected) {
      onChange(selected.filter(opt => !filtered.includes(opt)));
    } else {
      const newSelected = Array.from(new Set([...selected, ...filtered]));
      onChange(newSelected);
    }
  };

  const handleClearAll = () => {
    onChange([]);
    setSearchTerm('');
  };

  const filteredOptions = options.filter((opt) =>
    opt.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const isAllSelected = filteredOptions.length > 0 && filteredOptions.every(opt => selected.includes(opt));
  const hasSelections = selected.length > 0;

  return (
    <div className="relative font-sans text-sm" ref={containerRef} id={`${id}-container`}>
      <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 px-0.5">
        {label}
      </label>
      
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center justify-between w-full px-3 py-2 text-left rounded-lg shadow-sm transition-all duration-200 cursor-pointer focus:outline-hidden focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 ${
          hasSelections 
            ? 'border-blue-500 bg-blue-500/10 font-semibold text-white' 
            : 'border-white/10 bg-white/5 hover:border-white/20 text-slate-300'
        }`}
        id={`${id}-btn`}
      >
        <span className="truncate max-w-[150px]">
          {selected.length === 0
            ? 'All Options'
            : selected.length === 1
            ? selected[0]
            : `${selected.length} Selected`}
        </span>
        <div className="flex items-center gap-1.5 ml-2">
          {hasSelections && (
            <span 
              onClick={(e) => {
                e.stopPropagation();
                handleClearAll();
              }}
              className="p-0.5 rounded-full hover:bg-white/10 text-slate-400 hover:text-slate-200 cursor-pointer transition-colors"
              title="Clear selections"
            >
              <X size={13} />
            </span>
          )}
          <ChevronDown size={14} className={`text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
        </div>
      </button>

      {isOpen && (
        <div 
          className="absolute z-50 w-64 mt-1.5 rounded-xl border border-white/15 shadow-2xl animate-in fade-in slide-in-from-top-1 duration-200 overflow-hidden frosted-glass-dropdown"
          id={`${id}-panel`}
        >
          {/* Search bar & quick toggles */}
          <div className="p-2.5 border-b border-white/10 bg-slate-900/40">
            <div className="relative mb-2">
              <Search className="absolute left-2.5 top-2.5 text-slate-400" size={14} />
              <input
                type="text"
                placeholder={placeholder}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-white/5 border border-white/10 rounded-md text-white placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
              />
            </div>
            
            <div className="flex items-center justify-between text-[11px] font-semibold text-slate-400 px-1">
              <button
                type="button"
                onClick={handleSelectAll}
                className="hover:text-blue-400 font-bold cursor-pointer transition-colors"
              >
                {isAllSelected ? 'Deselect All' : 'Select All'}
              </button>
              {hasSelections && (
                <button
                  type="button"
                  onClick={handleClearAll}
                  className="hover:text-rose-400 font-bold cursor-pointer transition-colors"
                >
                  Clear All
                </button>
              )}
            </div>
          </div>

          {/* Options List */}
          <div className="max-h-56 overflow-y-auto py-1 divide-y divide-white/5">
            {filteredOptions.length === 0 ? (
              <div className="px-4 py-3 text-xs text-center text-slate-400 font-medium italic">
                No matches found
              </div>
            ) : (
              filteredOptions.map((option) => {
                const isSelected = selected.includes(option);
                return (
                  <label
                    key={option}
                    className={`flex items-center justify-between px-3 py-1.5 text-xs font-medium cursor-pointer transition-all duration-150 ${
                      isSelected 
                        ? 'bg-blue-500/15 text-blue-300 hover:bg-blue-500/20' 
                        : 'text-slate-300 hover:bg-white/5'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleOption(option)}
                        className="rounded-sm border-white/10 text-blue-500 focus:ring-blue-500/35 w-3.5 h-3.5 accent-blue-500 bg-white/5"
                      />
                      <span className="truncate">{option}</span>
                    </div>
                    {isSelected && <Check size={12} className="text-blue-400 shrink-0 ml-1" />}
                  </label>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};
