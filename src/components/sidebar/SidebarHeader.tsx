import Icon from '../common/Icon';
import { Brain } from 'lucide-react';


interface SidebarHeaderProps {
  isCollapsed: boolean;
  onHomeClick: () => void;
  onToggleCollapse: () => void;
}

export default function SidebarHeader({
  isCollapsed,
  onHomeClick,
  onToggleCollapse,
}: SidebarHeaderProps) {
  return (
    <div className="sidebar-head">
      {!isCollapsed && (
        <button
          type="button"
          className="brand brand-inverse"
          onClick={onHomeClick}
        >
          <span className="brand-mark">
            <Brain size={19} />
          </span>
          <span className="brand-text">SmartPath</span>
        </button>
      )}
      <button
        type="button"
        className="icon-button sidebar-toggle"
        aria-label={isCollapsed ? 'Open sidebar' : 'Collapse sidebar'}
        onClick={onToggleCollapse}
      >
        <Icon name="collapse" />
      </button>
    </div>
  );
}
