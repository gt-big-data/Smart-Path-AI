/** Node colors per subject. Node types not listed for a subject fall back to SLATE. */

export const COLOR_PALETTE: Record<string, string> = {
  BLUE: 'rgba(59, 130, 246, 1)',
  INDIGO: 'rgba(99, 102, 241, 1)',
  PURPLE: 'rgba(139, 92, 246, 1)',
  PINK: 'rgba(236, 72, 153, 1)',
  RED: 'rgba(239, 68, 68, 1)',
  ORANGE: 'rgba(249, 115, 22, 1)',
  AMBER: 'rgba(245, 158, 11, 1)',
  YELLOW: 'rgba(234, 179, 8, 1)',
  LIME: 'rgba(132, 204, 22, 1)',
  GREEN: 'rgba(34, 197, 94, 1)',
  EMERALD: 'rgba(16, 185, 129, 1)',
  TEAL: 'rgba(20, 184, 166, 1)',
  CYAN: 'rgba(6, 182, 212, 1)',
  SKY: 'rgba(14, 165, 233, 1)',
  VIOLET: 'rgba(124, 58, 237, 1)',
  FUCHSIA: 'rgba(217, 70, 239, 1)',
  ROSE: 'rgba(244, 63, 94, 1)',
  SLATE: 'rgba(100, 116, 139, 1)',
};

/** Colors offered in the node editor's swatch row */
export const PALETTE_OPTIONS: string[] = Object.values(COLOR_PALETTE);

const subjectColorSchemes: Record<string, Record<string, string>> = {
  base: {
    Topic: COLOR_PALETTE.BLUE,
    Subtopic: COLOR_PALETTE.TEAL,
    Definition: COLOR_PALETTE.PURPLE,
    Example: COLOR_PALETTE.PINK,
    Source: COLOR_PALETTE.SLATE,
    Application: COLOR_PALETTE.ORANGE,
  },

  english: {
    Topic: COLOR_PALETTE.BLUE,
    Subtopic: COLOR_PALETTE.TEAL,
    Definition: COLOR_PALETTE.PURPLE,
    Example: COLOR_PALETTE.PINK,
    Work: COLOR_PALETTE.INDIGO,
    Author: COLOR_PALETTE.VIOLET,
    LiteraryDevice: COLOR_PALETTE.FUCHSIA,
    Theme: COLOR_PALETTE.ROSE,
    CriticalTheory: COLOR_PALETTE.AMBER,
    Application: COLOR_PALETTE.ORANGE,
    Genre: COLOR_PALETTE.CYAN,
  },

  history: {
    Topic: COLOR_PALETTE.BLUE,
    Event: COLOR_PALETTE.RED,
    Figure: COLOR_PALETTE.VIOLET,
    Location: COLOR_PALETTE.GREEN,
    Concept: COLOR_PALETTE.PURPLE,
    Document: COLOR_PALETTE.AMBER,
    Cause: COLOR_PALETTE.ORANGE,
    Consequence: COLOR_PALETTE.PINK,
    Definition: COLOR_PALETTE.TEAL,
    Source: COLOR_PALETTE.SLATE,
  },

  math: {
    Topic: COLOR_PALETTE.BLUE,
    Subtopic: COLOR_PALETTE.TEAL,
    Definition: COLOR_PALETTE.PURPLE,
    Example: COLOR_PALETTE.PINK,
    Formula: COLOR_PALETTE.GREEN,
    Property: COLOR_PALETTE.CYAN,
    Theorem: COLOR_PALETTE.AMBER,
    Proof: COLOR_PALETTE.ORANGE,
    Application: COLOR_PALETTE.VIOLET,
  },

  mathematics: {
    Topic: COLOR_PALETTE.BLUE,
    Subtopic: COLOR_PALETTE.TEAL,
    Definition: COLOR_PALETTE.PURPLE,
    Example: COLOR_PALETTE.PINK,
    Formula: COLOR_PALETTE.GREEN,
    Property: COLOR_PALETTE.CYAN,
    Theorem: COLOR_PALETTE.AMBER,
    Proof: COLOR_PALETTE.ORANGE,
    Application: COLOR_PALETTE.VIOLET,
  },

  science: {
    Topic: COLOR_PALETTE.BLUE,
    Subtopic: COLOR_PALETTE.TEAL,
    Definition: COLOR_PALETTE.PURPLE,
    Example: COLOR_PALETTE.PINK,
    Equation: COLOR_PALETTE.GREEN,
    Principle: COLOR_PALETTE.EMERALD,
    Theory: COLOR_PALETTE.AMBER,
    Evidence: COLOR_PALETTE.CYAN,
    Scientist: COLOR_PALETTE.VIOLET,
    Concept: COLOR_PALETTE.INDIGO,
    Application: COLOR_PALETTE.ORANGE,
    GraphMetadata: COLOR_PALETTE.SLATE,
    MendelianGenetics: COLOR_PALETTE.LIME,
    CellTheory: COLOR_PALETTE.SKY,
    Evolution: COLOR_PALETTE.ROSE,
    Discovery: COLOR_PALETTE.FUCHSIA,
  },

  default: {
    Topic: COLOR_PALETTE.BLUE,
    Subtopic: COLOR_PALETTE.TEAL,
    Definition: COLOR_PALETTE.PURPLE,
    Example: COLOR_PALETTE.PINK,
    Source: COLOR_PALETTE.SLATE,
    Application: COLOR_PALETTE.ORANGE,
  },
};

/** Color for a node type under a subject, falling back to the default scheme and then SLATE */
export function getNodeColor(nodeType: string, subject = 'default'): string {
  const scheme = subjectColorSchemes[subject.toLowerCase().trim()] ?? subjectColorSchemes.default;
  return scheme[nodeType] ?? COLOR_PALETTE.SLATE;
}
