import React from 'react';

interface LoadingSpinnerProps {
  fullHeight?: boolean;
}

export default function LoadingSpinner({ fullHeight = true }: LoadingSpinnerProps) {
  return (
    <div className={`flex items-center justify-center bg-[#fbfaf7] ${fullHeight ? 'flex-1' : 'py-16'}`}>
      <div className="w-10 h-10 border-4 border-[#d9704f] border-t-transparent rounded-full animate-spin" />
    </div>
  );
}
