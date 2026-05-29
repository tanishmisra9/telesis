import { colors } from "./tokens";

/**
 * FastF1 TeamName strings (exact match to pace payload `team` field).
 * Covers 2018+ naming variants where applicable.
 */
export const TEAM_COLORS: Record<string, string> = {
  "Red Bull Racing": "#3671C6",
  Ferrari: "#E8002D",
  Mercedes: "#27F4D2",
  McLaren: "#FF8000",
  "Aston Martin": "#229971",
  Alpine: "#0093CC",
  Williams: "#64C4FF",
  RB: "#6692FF",
  "AlphaTauri": "#6692FF",
  "Scuderia AlphaTauri": "#6692FF",
  "Kick Sauber": "#52E252",
  "Alfa Romeo": "#52E252",
  "Haas F1 Team": "#B6BABD",
  "Racing Bulls": "#6692FF",
  "Toro Rosso": "#469BFF",
  "Renault": "#FFF500",
  "Racing Point": "#F596C8",
  "Force India": "#F596C8",
  "Sauber": "#52E252",
  "Williams Racing": "#64C4FF",
};

const FALLBACK_COLOR = colors.mutedText;
const warnedTeams = new Set<string>();

export function resolveTeamColor(teamName: string): string {
  const color = TEAM_COLORS[teamName];
  if (color) {
    return color;
  }
  if (!warnedTeams.has(teamName)) {
    warnedTeams.add(teamName);
    console.warn(
      `[teamColors] No color mapped for TeamName "${teamName}". Using neutral fallback.`,
    );
  }
  return FALLBACK_COLOR;
}

/** Fill/stroke with reduced opacity for box surfaces */
export function teamColorWithAlpha(teamName: string, alpha: number): string {
  const hex = resolveTeamColor(teamName);
  if (!hex.startsWith("#") || hex.length < 7) {
    return hex;
  }
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
