/** Tailwind class strings shared by the workspace panels (conversation, knowledge map, source strip). */

export const panelSection = "flex h-full min-h-0 min-w-0 flex-col bg-[#fbfcfc]";

export const panelLabel =
  "flex h-[34px] flex-none items-center justify-between border-b border-[#e2e7e6] px-4 text-[9px] font-bold uppercase tracking-[0.08em] text-[#716b79]";

export const fileStripBar =
  "flex h-[46px] flex-none items-center gap-[7px] border-t border-[#e9e6e3] bg-[#fbfcfc] px-[15px] text-[11px] text-[#635d69]";

export const fileStripChipBase = "min-w-0 flex-[0_1_auto] truncate rounded-[3px] border px-[7px] py-1";
export const fileStripChip = `${fileStripChipBase} border-[#e4e1e6] text-[#8b8591]`;
export const fileStripChipLink = `${fileStripChipBase} border-[#b9dcd7] text-[#0f655e] underline underline-offset-2 hover:border-teal hover:text-teal`;
