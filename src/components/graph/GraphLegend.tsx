import { legendButtonClass, legendClass, legendSwatch, legendTitle } from './graphClasses';

export interface LegendEntry {
  type: string;
  color: string;
}

interface GraphLegendProps {
  entries: LegendEntry[];
  activeType: string | null;
  onSelect: (type: string) => void;
}

/** Turns a node type such as CriticalTheory into "Critical Theory" */
const readableType = (type: string) => type.replace(/([A-Z])/g, ' $1').trim();

/** Node type legend, bottom right. Clicking a type dims every other type. */
export default function GraphLegend({ entries, activeType, onSelect }: GraphLegendProps) {
  if (entries.length === 0) return null;

  return (
    <div className={legendClass}>
      <div className={legendTitle}>Categories</div>
      {entries.map((entry) => {
        const active = activeType === entry.type;
        return (
          <button
            key={entry.type}
            type="button"
            aria-pressed={active}
            className={legendButtonClass(active)}
            onClick={() => onSelect(entry.type)}
          >
            <span className={legendSwatch} style={{ background: entry.color }} />
            {readableType(entry.type)}
          </button>
        );
      })}
    </div>
  );
}
