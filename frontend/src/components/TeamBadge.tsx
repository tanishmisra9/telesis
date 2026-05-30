import { resolveTeamColor } from "../design/teamColors";

interface TeamBadgeProps {
  team: string;
  size?: "sm" | "md";
}

const SLUG_TO_MARK: Record<string, string> = {
  "red bull racing": "RBR",
  ferrari: "FER",
  mercedes: "MER",
  mclaren: "MCL",
  "aston martin": "AST",
  alpine: "ALP",
  williams: "WIL",
  rb: "RB",
  "kick sauber": "SAU",
  "haas f1 team": "HAA",
};

function markForTeam(team: string): string {
  const key = team.trim().toLowerCase();
  if (SLUG_TO_MARK[key]) {
    return SLUG_TO_MARK[key];
  }
  const words = team.split(/\s+/).filter(Boolean);
  if (!words.length) {
    return "TEAM";
  }
  if (words.length === 1) {
    return words[0].slice(0, 3).toUpperCase();
  }
  return words
    .slice(0, 3)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function TeamBadge({ team, size = "md" }: TeamBadgeProps) {
  const color = resolveTeamColor(team);
  const isSmall = size === "sm";
  return (
    <div
      className={`relative overflow-hidden rounded-[12px] border ${
        isSmall ? "h-8 w-8" : "h-11 w-11"
      }`}
      style={{ borderColor: `${color}aa`, backgroundColor: `${color}26` }}
      aria-label={`${team} badge`}
    >
      <div
        className="absolute inset-y-0 left-0 w-1/3"
        style={{ backgroundColor: `${color}cc` }}
        aria-hidden
      />
      <div
        className="absolute inset-x-0 top-0 h-[2px]"
        style={{ backgroundColor: `${color}dd` }}
        aria-hidden
      />
      <div
        className={`relative z-10 flex h-full items-center justify-center font-semibold tracking-wide text-white ${
          isSmall ? "text-[9px]" : "text-[11px]"
        }`}
      >
        {markForTeam(team)}
      </div>
    </div>
  );
}
