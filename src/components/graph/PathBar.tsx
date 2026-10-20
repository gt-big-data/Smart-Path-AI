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
    <div style={{
      display: 'flex',
      flexWrap: 'wrap',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: '8px',
      background: '#ffffff',
      border: '1.5px solid #d4581c',
      borderRadius: '8px',
      padding: '8px 12px',
      fontSize: '13.5px',
      color: '#16202e',
    }}>
      <span style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', minWidth: 0 }}>
        {steps.map((step, index) => {
          const isLast = index === steps.length - 1;
          return (
            <React.Fragment key={step.id}>
              {index > 0 && <span style={{ color: '#586476' }}>›</span>}
              <button
                onClick={() => onStepClick(step.id)}
                style={{
                  padding: 0,
                  border: 'none',
                  background: 'transparent',
                  font: 'inherit',
                  cursor: 'pointer',
                  color: isLast ? '#d4581c' : 'inherit',
                  fontWeight: isLast ? 600 : 'inherit',
                }}
              >
                {step.label}
              </button>
            </React.Fragment>
          );
        })}
      </span>
      <span style={{ display: 'flex', gap: '6px' }}>
        <button
          onClick={onFocus}
          style={{
            fontSize: '12px',
            fontWeight: 600,
            padding: '3px 10px',
            borderRadius: '6px',
            border: 'none',
            background: '#d4581c',
            color: '#f5f7fa',
            cursor: 'pointer',
          }}
        >
          Focus
        </button>
        <button
          onClick={onClear}
          style={{
            fontSize: '12px',
            fontWeight: 600,
            padding: '3px 10px',
            borderRadius: '6px',
            border: '1px solid #d9dfe7',
            background: 'transparent',
            color: '#586476',
            cursor: 'pointer',
          }}
        >
          Clear
        </button>
      </span>
    </div>
  );
};

export default PathBar;
