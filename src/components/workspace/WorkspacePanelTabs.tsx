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
    <div className="flex h-[49px] items-stretch border-b border-[#dce4e2] bg-[#fbfcfc]">
      <span className="inline-flex items-center border-r border-[#e2e7e6] bg-[#eef5f4] px-4 text-xs font-bold uppercase tracking-[0.05em] text-[#0f655e] shadow-[inset_0_-2px_#147d74]">
        {primary}
      </span>
      {onMaximize && (
        <button
          type="button"
          className="ml-auto grid w-[43px] place-items-center border-0 bg-transparent text-[#788682] hover:bg-[#eef5f4] hover:text-[#176860]"
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
