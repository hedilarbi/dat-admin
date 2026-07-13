import React from 'react';

interface EmptyStateProps {
  title: string;
  description: string;
}

export default function EmptyState({ title, description }: EmptyStateProps) {
  return (
    <div className="bg-white border border-[#eceadf] rounded-[12px] p-10 text-center text-gray-500 shadow-sm">
      <p className="text-sm font-semibold mb-2">{title}</p>
      <p className="text-xs text-gray-400">{description}</p>
    </div>
  );
}
