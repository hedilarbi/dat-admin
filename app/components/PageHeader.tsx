import React from 'react';

interface PageHeaderProps {
  eyebrow: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export default function PageHeader({ eyebrow, title, description, action }: PageHeaderProps) {
  return (
    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 mb-6">
      <div>
        <div className="font-semibold text-[11px] tracking-[0.2em] uppercase text-[#a3987f] mb-2.5">
          {eyebrow}
        </div>
        <h1 className="m-0 font-bold text-[28px] sm:text-[36px] font-heading uppercase text-[#13243c] leading-none">
          {title}
        </h1>
        {description && (
          <p className="text-xs text-gray-500 mt-2 max-w-xl">{description}</p>
        )}
      </div>
      {action}
    </div>
  );
}
