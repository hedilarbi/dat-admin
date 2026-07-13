import React from 'react';

interface SkeletonRowsProps {
  count?: number;
}

/** Lignes de contenu qui clignotent (animate-pulse), à la place d'une liste/tableau en cours de chargement. */
export default function SkeletonRows({ count = 6 }: SkeletonRowsProps) {
  return (
    <div className="divide-y divide-[#efece3]">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="p-[16px_20px] animate-pulse flex items-center gap-4">
          <div className="h-3 bg-gray-200 rounded w-1/4" />
          <div className="h-3 bg-gray-200 rounded w-1/6" />
          <div className="h-3 bg-gray-200 rounded w-1/5" />
          <div className="h-3 bg-gray-200 rounded w-1/6 ml-auto" />
        </div>
      ))}
    </div>
  );
}
