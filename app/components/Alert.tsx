import React from 'react';

interface AlertProps {
  variant: 'error' | 'success';
  size?: 'sm' | 'md';
  children: React.ReactNode;
  className?: string;
}

const VARIANT_STYLES: Record<AlertProps['variant'], string> = {
  error: 'bg-red-50 border-red-500 text-red-700',
  success: 'bg-green-50 border-green-500 text-green-700',
};

const SIZE_STYLES: Record<NonNullable<AlertProps['size']>, string> = {
  sm: 'p-3 text-xs',
  md: 'p-4 text-sm',
};

export default function Alert({ variant, size = 'sm', children, className = '' }: AlertProps) {
  return (
    <div className={`border-l-4 ${SIZE_STYLES[size]} ${VARIANT_STYLES[variant]} ${className}`}>
      {children}
    </div>
  );
}
