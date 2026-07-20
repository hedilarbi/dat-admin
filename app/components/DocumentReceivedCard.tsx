import React from 'react';

interface DocumentReceivedCardProps {
  fileType: 'PDF' | 'IMG';
  title: string;
  description: string;
  url: string;
}

export default function DocumentReceivedCard({ fileType, title, description, url }: DocumentReceivedCardProps) {
  return (
    <div className="border border-[#eceadf] bg-white rounded-[12px] p-[14px_18px] flex flex-wrap sm:flex-nowrap items-center gap-4">
      <div className="w-10 h-10 rounded-[9px] bg-[#f1efe8] flex items-center justify-center font-semibold text-[10px] text-[#a3987f]">
        {fileType}
      </div>
      <div className="flex-1">
        <div className="font-semibold text-sm text-[#13243c]">{title}</div>
        <div className="text-xs text-[#9a917d] mt-0.5">{description}</div>
      </div>
      <span className="font-semibold text-xs px-3 py-1 rounded-full bg-[#e9f4ee] text-[#2f6f4f]">Reçu</span>
      <a href={url} target="_blank" rel="noreferrer" className="font-semibold text-xs text-[#13243c] underline hover:opacity-80">
        Consulter
      </a>
    </div>
  );
}
