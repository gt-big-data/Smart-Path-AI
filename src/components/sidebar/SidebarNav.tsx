import Icon from '../common/Icon';

interface SidebarNavProps {
  isCollapsed: boolean;
  isProgressActive: boolean;
  onHome: () => void;
  onProgress: () => void;
}

export default function SidebarNav({
  isCollapsed,
  isProgressActive,
  onHome,
  onProgress,
}: SidebarNavProps) {
  return (
    <div data-sidebar-navigation className="sidebar-navigation">
      <button
        type="button"
        onClick={onHome}
        title="Home"
        aria-label="Home"
      >
        <Icon name="home" size={17} />
        {!isCollapsed && <span>Home</span>}
      </button>
      <button
        type="button"
        className={isProgressActive ? 'active' : undefined}
        aria-current={isProgressActive ? 'page' : undefined}
        onClick={onProgress}
        title="Progress"
        aria-label="Progress"
      >
        <Icon name="progress" size={17} />
        {!isCollapsed && <span>Progress</span>}
      </button>
    </div>
  );
}
