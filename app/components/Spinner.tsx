import React from 'react';

export default function Spinner({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`inline-block ${className} border-2 border-current border-t-transparent rounded-full animate-spin`}
    />
  );
}
