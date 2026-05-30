import { resolveTeamColor } from "../design/teamColors";

interface ConstructorLogoProps {
  team: string;
}

function shortTeam(team: string): string {
  const parts = team.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 3).toUpperCase();
  return parts
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

export function ConstructorLogo({ team }: ConstructorLogoProps) {
  const teamColor = resolveTeamColor(team);
  return (
    <div
      className="flex h-6 min-w-8 items-center justify-center rounded-inner border px-2 text-[10px] font-medium text-white/90"
      style={{ borderColor: teamColor, backgroundColor: "rgba(255,255,255,0.03)" }}
    >
      {shortTeam(team)}
    </div>
  );
}
