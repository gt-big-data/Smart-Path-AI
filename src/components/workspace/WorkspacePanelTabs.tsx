import { Maximize2, Minimize2 } from "lucide-react";

interface WorkspacePanelTabsProps {
  primary: string;
  isMaximized?: boolean;
  onMaximize?: () => void;
}

export default function WorkspacePanelTabs({
  primary,
  isMaximized = false,
  onMaximize,
}: WorkspacePanelTabsProps) {
  return (
    <div className="flex h-12.25 items-stretch border-b border-[#dce4e2] bg-paper">
      <span className="inline-flex items-center border-r border-[#e2e7e6] bg-teal-hover px-4 text-xs font-bold uppercase tracking-wider text-teal-dark shadow-[inset_0_-2px_#147d74]">
        {primary}
      </span>
      {onMaximize && (
        <button
          type="button"
          className="ml-auto grid w-10.75 place-items-center border-0 bg-transparent text-[#788682] hover:bg-teal-hover hover:text-[#176860]"
          aria-label={isMaximized ? `Restore ${primary}` : `Maximize ${primary}`}
          title={isMaximized ? `Restore ${primary}` : `Maximize ${primary}`}
          onClick={onMaximize}
        >
          {isMaximized ? <Minimize2 size={17} /> : <Maximize2 size={17} />}
        </button>
      )}
    </div>
  );
}
