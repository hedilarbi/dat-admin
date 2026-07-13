import React from 'react';

export interface FilterOption<T extends string> {
  value: T;
  label: string;
  /** Classes appliquées uniquement quand cette option précise est active (remplace activeClassName). */
  activeClassName?: string;
}

interface FilterPillsProps<T extends string> {
  options: FilterOption<T>[];
  value: T;
  onChange: (value: T) => void;
  /** Classes communes à toutes les pills (taille, padding...). */
  baseClassName?: string;
  /** Classes par défaut appliquées à la pill active si l'option n'a pas sa propre activeClassName. */
  activeClassName?: string;
  inactiveClassName?: string;
}

export default function FilterPills<T extends string>({
  options,
  value,
  onChange,
  baseClassName = 'px-4 py-1.5 rounded-full text-xs font-bold transition',
  activeClassName = 'bg-[#13243c] text-white',
  inactiveClassName = 'bg-white border text-gray-600 hover:bg-gray-50',
}: FilterPillsProps<T>) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map(opt => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={`${baseClassName} ${value === opt.value ? (opt.activeClassName || activeClassName) : inactiveClassName}`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
