/**
 * Tailwind class strings for the knowledge graph. Where a state changes a property that the base
 * already sets (colours, borders, backgrounds), the state is a separate complete string.
 */

const SHADOW = "shadow-[0_2px_8px_rgba(0,0,0,0.1)]";
const SURFACE = "bg-[rgba(255,255,255,0.95)]";

// Canvas root and overlays
export const graphView = "absolute inset-0 font-brand text-ink";
export const graphEmpty = "m-auto flex h-full w-[min(390px,calc(100%_-_48px))] flex-col items-center justify-center text-center text-[#687572]";
export const graphEmptyIcon = "mb-[22px] grid h-[62px] w-[62px] place-items-center rounded-[3px] border border-[#bcd3cf] bg-[#e4f1ef] text-teal";
export const graphEmptyKicker = "mb-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-teal";
export const graphEmptyTitle = "mb-2.5 mt-[9px] max-w-[330px] text-[22px] font-semibold tracking-[-0.03em] text-[#202a29]";
export const graphEmptyBody = "m-0 mb-5 text-[13px] leading-[1.6] text-[#687572]";
export const graphEmptyNote = "mt-2.5 text-[10px] text-faint";
export const chooseButton =
  "inline-flex h-9 cursor-pointer items-center gap-2 rounded-[3px] border-0 bg-teal px-3.5 text-xs font-semibold text-white hover:bg-teal-dark";
export const uploadOverlay = "absolute inset-0 z-[25] flex items-center justify-center bg-[rgba(251,252,252,0.96)]";
export const cancelButton =
  "mt-4 h-8 cursor-pointer border border-[#d5dfdd] bg-white px-3.5 text-[11px] font-semibold text-[#c4474d] hover:border-[#e5b3b6] hover:bg-[#fff1f1]";

// Loader
export const orbitLoader =
  "box-border flex h-full w-full flex-col items-center justify-center bg-[#f8faf9] px-6 text-center";
export const orbitSystem = "relative mb-[22px] h-24 w-24 animate-orbit-spin";
export const orbitCore =
  "absolute left-1/2 top-1/2 h-7 w-7 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#63b7af] shadow-[0_0_15px_rgba(99,183,175,0.45)]";
const PLANET_BASE = "absolute rounded-full bg-current shadow-[0_0_12px_currentColor]";
export const planetClass = {
  amber: `${PLANET_BASE} left-[41px] top-0 h-[15px] w-[15px] text-[#dc9234]`,
  blue: `${PLANET_BASE} right-px top-10 h-[15px] w-[15px] text-[#4f7fd1]`,
  violet: `${PLANET_BASE} bottom-[5px] left-3.5 h-[15px] w-[15px] text-[#9a64d6]`,
  teal: `${PLANET_BASE} left-0.5 top-[23px] h-[9px] w-[9px] text-teal`,
} as const;
export const loaderTitle = "mb-2 mt-0 text-xl font-semibold text-[#263331]";
export const loaderDetail = "m-0 text-[11px] text-[#7a8986]";
export const loaderDots = "mt-5 flex gap-1.5";
export const loaderDot = "h-[7px] w-[7px] rounded-full bg-teal animate-loader-dot";
export const progressTrack = "mb-[9px] mt-[13px] h-1.5 w-[min(440px,100%)] overflow-hidden bg-[#dce5e3]";
export const progressFill = "block h-full bg-teal [transition:width_0.25s_ease]";
export const progressLabel = "text-xs font-semibold text-teal";

// Nodes
const FACE_BASE =
  "absolute inset-[3px] box-border flex cursor-pointer flex-col items-center justify-center overflow-hidden rounded-full px-2.5 pb-3.5 pt-5 text-center text-[11px] font-semibold leading-[1.25] text-ink [overflow-wrap:break-word]";
export const faceClass = (isCenter: boolean) =>
  isCenter ? `${FACE_BASE} bg-teal text-[14px] text-white` : `${FACE_BASE} bg-white`;

export const dotsClass = "pointer-events-none absolute left-1/2 top-[9px] flex -translate-x-1/2 gap-[3px]";

/** Confidence dot: teal outline, white on the centre disc, dashed grey when the concept has no score */
export const dotBorderClass = (isCenter: boolean, unscored: boolean) => {
  const base = "h-1.5 w-1.5 rounded-full border";
  if (unscored) return `${base} border-dashed border-[#9ebbb7]`;
  return `${base} ${isCenter ? "border-white" : "border-teal"}`;
};

const RIM_BASE =
  "absolute z-[12] box-border grid h-7 w-7 -translate-x-1/2 -translate-y-1/2 cursor-pointer place-items-center rounded-full border-2 p-0 shadow-[0_2px_6px_rgba(15,23,42,0.18)] pointer-events-auto [transition:all_120ms_ease] hover:scale-[1.08] hover:shadow-[0_3px_10px_rgba(15,23,42,0.28)] focus-visible:outline-none focus-visible:shadow-[0_0_0_2px_#ffffff,0_0_0_4px_#0c7f78]";
const RIM_COLLAPSE = "border-[#0c7f78] bg-white text-[#0c7f78]";
const RIM_COLLAPSED = "border-white bg-[#0c7f78] text-[13px] text-white";
export const rimPosition = {
  topLeft: "left-[14.64%] top-[14.64%]",
  topRight: "left-[85.36%] top-[14.64%]",
  bottomRight: "left-[85.36%] top-[85.36%]",
} as const;
export const rimEditClass = `${RIM_BASE} ${RIM_COLLAPSE}`;
export const collapseBadgeClass = (collapsed: boolean) =>
  `${RIM_BASE} ${collapsed ? RIM_COLLAPSED : RIM_COLLAPSE} font-mono text-[17px] font-bold leading-none`;

export const stepClass =
  "absolute z-[12] box-border grid h-7 w-7 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-2 border-white bg-[#d4581c] text-[13px] font-bold leading-none text-white pointer-events-none";

export const tooltipClass =
  "absolute bottom-[calc(100%+12px)] left-1/2 z-[1000] w-max max-w-[240px] -translate-x-1/2 rounded-[3px] bg-[rgba(28,27,45,0.92)] px-2.5 py-2 text-left text-[12px] leading-[1.4] text-white shadow-[0_4px_12px_rgba(0,0,0,0.2)] pointer-events-none";

// Search
export const searchClass = "absolute left-3.5 top-[13px] z-30 w-[min(340px,calc(100%_-_230px))]";
export const searchBarClass = `box-border flex h-9 items-center gap-[7px] rounded-[3px] border border-[#bdcac7] bg-[rgba(255,255,255,0.96)] py-0 pl-2.5 pr-2 text-muted ${SHADOW}`;
export const searchInput = "min-w-0 flex-1 border-0 bg-transparent text-[12px] text-ink outline-none placeholder:text-[#9aa8a5]";
export const clearButton = "grid cursor-pointer place-items-center border-0 bg-transparent p-0 text-faint";
export const searchStatus = "whitespace-nowrap text-[10px] text-muted";
export const searchModes = "flex gap-[3px] border-l border-[#e2e7e6] pl-[7px]";
const MODE_BASE = "h-[22px] cursor-pointer rounded-[2px] border-0 px-[7px] text-[10px] font-semibold";
export const modeClass = (active: boolean) =>
  active ? `${MODE_BASE} bg-teal text-white` : `${MODE_BASE} bg-[#f3f4f6] text-muted`;
export const searchResultsClass = `mt-1.5 overflow-hidden rounded-[3px] border border-[#bdcac7] bg-white ${SHADOW}`;
export const searchCount = "border-b border-[#eef1f0] px-2.5 py-[7px] text-[11px] text-muted";
export const resultList = "m-0 max-h-60 list-none overflow-y-auto p-0 py-1";
const RESULT_BASE = "flex w-full cursor-pointer items-center gap-2 border-0 px-2.5 py-1.5 text-left";
export const resultClass = (active: boolean) =>
  active
    ? `${RESULT_BASE} bg-teal-pale font-semibold text-teal-dark hover:bg-teal-hover`
    : `${RESULT_BASE} bg-transparent text-ink hover:bg-teal-hover`;
export const resultDot = "h-2.5 w-2.5 shrink-0 rounded-full";
export const resultCopy = "flex min-w-0 flex-1 flex-col";
export const resultLabel = "truncate text-[12px] font-medium";
export const resultTrail = "truncate text-[10px] text-faint";
export const resultType = "shrink-0 truncate text-[10px] text-faint";

// Zoom stack
export const zoomControlsClass = `absolute right-3.5 top-[13px] z-30 flex flex-col overflow-hidden rounded-[3px] border border-[#c3cfcd] ${SURFACE} ${SHADOW}`;
const ZOOM_BUTTON_BASE =
  "grid h-7 w-[30px] cursor-pointer place-items-center border-0 border-b border-[#e2e7e6] p-0 last:border-b-0";
export const zoomButtonClass = (pressed: boolean) =>
  pressed
    ? `${ZOOM_BUTTON_BASE} bg-teal text-white hover:bg-teal hover:text-white`
    : `${ZOOM_BUTTON_BASE} bg-white text-[#5d6e6a] hover:bg-teal-pale hover:text-teal-dark`;

// Category legend
export const legendClass = `absolute bottom-3.5 right-3.5 z-30 box-border grid max-h-[260px] w-[140px] gap-0.5 overflow-auto rounded-[3px] border border-[#c3cfcd] ${SURFACE} p-[9px] ${SHADOW}`;
export const legendTitle = "mb-1 text-[8px] font-semibold uppercase tracking-[0.08em] text-[#55635f]";
const LEGEND_BUTTON_BASE =
  "flex h-6 cursor-pointer items-center gap-[7px] rounded-[2px] border-0 px-1.5 text-left text-[11px]";
export const legendButtonClass = (active: boolean) =>
  active
    ? `${LEGEND_BUTTON_BASE} bg-[#e7f2f0] font-bold text-ink-strong hover:bg-teal-hover hover:text-ink`
    : `${LEGEND_BUTTON_BASE} bg-transparent text-[#697774] hover:bg-teal-hover hover:text-ink`;
export const legendSwatch = "h-2 w-2 shrink-0 rounded-full";

// Selected concept hint
export const focusHintClass = `absolute bottom-3.5 left-3.5 z-30 box-border flex max-w-[calc(100%_-_180px)] items-center gap-[9px] rounded-[3px] border border-[#d5dfdd] ${SURFACE} py-2 pl-2.5 pr-2 ${SHADOW}`;
export const focusIcon = "grid h-7 w-7 shrink-0 place-items-center rounded-[3px] bg-teal-pale text-teal";
export const focusCopy = "flex min-w-0 flex-col";
export const focusTitle = "truncate text-[12px] text-ink-strong";
export const focusSmall = "text-[10px] text-faint";
export const focusClear = "grid cursor-pointer place-items-center border-0 bg-transparent p-1 text-faint";

// Node editor popup
export const editPopupClass = `fixed z-[9999] box-border w-[286px] border border-[#b9c8c5] bg-[#fbfcfc] p-[15px] font-brand text-[#293432] shadow-[0_10px_28px_rgba(26,45,42,0.18)]`;
export const editHeader = "mb-[13px] flex cursor-move select-none items-center justify-between";
export const editTitle = "m-0 text-[15px] font-semibold tracking-[-0.02em] text-[#293432]";
export const editClose =
  "grid h-6 w-6 cursor-pointer place-items-center border-0 bg-transparent p-0 text-[#75827f] hover:bg-[#edf2f1] hover:text-[#34423f]";
export const editField = "m-0 mb-3 grid min-w-0 gap-[5px] border-0 p-0 text-[10px] font-semibold text-[#4e5c59]";
export const editLegend = "mb-[5px] p-0 text-[10px] font-semibold text-[#4e5c59]";
export const editInput =
  "box-border h-[34px] w-full border border-[#c5d0ce] bg-white px-[11px] text-[10px] text-[#2e3a38] outline-none focus:border-teal focus:shadow-[0_0_0_2px_#dfeeea]";
export const swatches = "grid grid-cols-[repeat(9,1fr)] gap-1.5";
const SWATCH_BASE =
  "box-border aspect-square w-full cursor-pointer rounded-full border-2 p-0 [transition:transform_0.12s_ease] hover:scale-[1.08]";
export const swatchClass = (selected: boolean) =>
  selected ? `${SWATCH_BASE} border-white shadow-[0_0_0_2px_#147d74]` : `${SWATCH_BASE} border-transparent`;
export const preview =
  "grid h-[120px] place-items-center border border-[#d5dfdd] bg-[#fbfcfc] bg-[radial-gradient(#c9d4d2_1px,transparent_1px)] [background-size:12px_12px]";
const PREVIEW_NODE_BASE =
  "box-border flex h-[90px] w-[90px] items-center justify-center rounded-full border-[3px] px-3 text-center text-[11px] font-semibold leading-[1.25] text-ink shadow-[0_4px_10px_rgba(26,45,42,0.14)]";
export const previewNodeClass = (isCenter: boolean) =>
  isCenter ? `${PREVIEW_NODE_BASE} border-teal bg-teal text-white` : `${PREVIEW_NODE_BASE} border-[#d5dedb] bg-white`;
export const previewLabel = "line-clamp-3 [overflow-wrap:anywhere] text-balance";
export const editFooter = "mt-[15px] grid grid-cols-2 gap-[9px] border-t border-[#dce4e2] pt-3";
const EDIT_BUTTON_BASE = "h-[33px] cursor-pointer border text-[10px] font-semibold";
export const editCancel = `${EDIT_BUTTON_BASE} border-[#c5d0ce] bg-white text-[#4e5c59]`;
export const editApply = `${EDIT_BUTTON_BASE} border-teal bg-teal text-white hover:bg-teal-dark`;
