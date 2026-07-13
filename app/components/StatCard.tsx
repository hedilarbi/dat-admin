import React from 'react';

interface StatCardProps {
  label: string;
  value: number | string;
  bg: string;
  labelColor: string;
  valueColor?: string;
}

export default function StatCard({ label, value, bg, labelColor, valueColor = '#13243c' }: StatCardProps) {
  return (
    <div className="rounded-[12px] p-[16px_20px]" style={{ background: bg }}>
      <div className="font-semibold text-[11px] uppercase tracking-[0.05em]" style={{ color: labelColor }}>
        {label}
      </div>
      <div className="font-bold text-[30px] font-heading mt-2" style={{ color: valueColor }}>
        {value}
      </div>
    </div>
  );
}
