import React from 'react';

export interface PathStep {
  id: string;
  label: string;
}

interface PathBarProps {
  steps: PathStep[];
  onStepClick: (id: string) => void;
  onFocus: () => void;
  onClear: () => void;
}

const PathBar: React.FC<PathBarProps> = ({ steps, onStepClick, onFocus, onClear }) => {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-xs border border-line bg-paper px-3 py-2 font-brand text-[12px] text-ink">
      <span className="flex min-w-0 flex-wrap items-center gap-1.5">
        {steps.map((step, index) => {
          const isLast = index === steps.length - 1;
          return (
            <React.Fragment key={step.id}>
              {index > 0 && <span className="text-faint" aria-hidden="true">›</span>}
              <button
                type="button"
                onClick={() => onStepClick(step.id)}
                className={`cursor-pointer border-0 bg-transparent p-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal ${
                  isLast ? 'font-semibold text-teal' : 'hover:text-teal'
                }`}
              >
                {step.label}
              </button>
            </React.Fragment>
          );
        })}
      </span>
      <span className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={onFocus}
          className="cursor-pointer rounded-xs border-0 bg-teal px-2.5 py-0.75 text-[12px] font-semibold text-white hover:bg-teal-dark focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal"
        >
          Focus
        </button>
        <button
          type="button"
          onClick={onClear}
          className="cursor-pointer rounded-xs border border-line bg-transparent px-2.5 py-0.75 text-[12px] font-semibold text-muted hover:bg-teal-hover hover:text-teal-dark focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal"
        >
          Clear
        </button>
      </span>
    </div>
  );
};

export default PathBar;
