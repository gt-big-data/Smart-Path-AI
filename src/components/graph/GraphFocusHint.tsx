import Icon from '../common/Icon';
import { focusClear, focusCopy, focusHintClass, focusIcon, focusSmall, focusTitle } from './graphClasses';

interface GraphFocusHintProps {
  label: string;
  onClear: () => void;
}

/** Bottom left card naming the concept whose path is shown, with a clear button */
export default function GraphFocusHint({ label, onClear }: GraphFocusHintProps) {
  return (
    <div className={focusHintClass} role="status">
      <span className={focusIcon}>
        <Icon name="graph" size={15} />
      </span>
      <div className={focusCopy}>
        <span className={focusTitle}>{label}</span>
        <span className={focusSmall}>Selected concept</span>
      </div>
      <button type="button" className={focusClear} aria-label="Clear selection" onClick={onClear}>
        <Icon name="x" size={13} />
      </button>
    </div>
  );
}
