import React from 'react';

interface VerticalStepProps {
  stepNumber: number;
  title: string;
  isActive: boolean;
  isCompleted: boolean;
  isLast: boolean;
  onClick?: () => void;
  children?: React.ReactNode;
}

export default function VerticalStep({
  stepNumber,
  title,
  isActive,
  isCompleted,
  isLast,
  onClick,
  children,
}: VerticalStepProps) {
  // Styling for the circle indicator
  const circleBg = isActive ? '#d9704f' : isCompleted ? '#2f6f4f' : '#fff';
  const circleColor = isActive || isCompleted ? '#fff' : '#9a917d';
  const circleBorder = isActive ? '#d9704f' : isCompleted ? '#2f6f4f' : '#dcd7cb';
  const connectorColor = isCompleted ? '#2f6f4f' : '#dcd7cb';
  const textColor = isActive ? '#13243c' : '#5a5e66';
  
  // Decide if this step can be clicked to open (completed or current active)
  const isClickable = onClick && (isCompleted || isActive);

  return (
    <div className="flex w-full">
      {/* Left indicator column */}
      <div className="flex shrink-0 flex-col items-center mr-4 sm:mr-6">
        <button
          type="button"
          onClick={isClickable ? onClick : undefined}
          disabled={!isClickable}
          className={`z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[14px] font-bold transition-all duration-300 ${
            isClickable ? 'cursor-pointer hover:ring-2 hover:ring-offset-2' : 'cursor-default'
          }`}
          style={{
            background: circleBg,
            color: circleColor,
            border: `2px solid ${circleBorder}`,
            outlineColor: isActive ? '#d9704f' : '#2f6f4f'
          }}
        >
          {isCompleted && !isActive ? '✓' : stepNumber}
        </button>
        {!isLast && (
          <div
            className="my-1.5 w-[2px] flex-1 min-h-[40px] transition-colors duration-300"
            style={{ background: connectorColor }}
          />
        )}
      </div>

      {/* Right content column */}
      <div className={`flex-1 pb-8 ${isLast ? '' : ''}`}>
        <button
          type="button"
          onClick={isClickable ? onClick : undefined}
          disabled={!isClickable}
          className={`flex w-full items-center justify-between text-left transition-colors duration-300 ${
            isClickable ? 'cursor-pointer group' : 'cursor-default'
          }`}
        >
          <h3
            className={`font-heading text-[16px] sm:text-[18px] font-bold uppercase ${
              isClickable ? 'group-hover:text-[#d9704f]' : ''
            }`}
            style={{ color: textColor }}
          >
            {title}
          </h3>
          <div className="flex items-center gap-3">
            {isCompleted && !isActive && (
              <span className="hidden sm:inline-flex rounded-full bg-[#e9f4ee] px-2 py-0.5 text-[10px] font-bold uppercase text-[#2f6f4f]">
                Étape complétée
              </span>
            )}
            {isClickable && (
              <svg 
                width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                className={`transition-transform duration-300 ${isActive ? 'rotate-180 text-[#d9704f]' : 'text-[#9a917d]'}`}
              >
                <polyline points="6 9 12 15 18 9" />
              </svg>
            )}
          </div>
        </button>

        {isActive && children && (
          <div className="mt-4 animate-in slide-in-from-top-2 fade-in duration-300">
            {children}
          </div>
        )}
      </div>
    </div>
  );
}
