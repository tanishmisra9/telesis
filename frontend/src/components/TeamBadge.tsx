import { useEffect, useMemo, useState } from "react";
import { resolveTeamColor } from "../design/teamColors";

interface TeamBadgeProps {
  team: string;
  size?: "sm" | "md";
}

const SLUG_OVERRIDES: Record<string, string> = {
  "red bull racing": "red-bull-racing",
  ferrari: "ferrari",
  mercedes: "mercedes",
  mclaren: "mclaren",
  "aston martin": "aston-martin",
  alpine: "alpine",
  williams: "williams",
  rb: "rb",
  "kick sauber": "kick-sauber",
  "haas f1 team": "haas-f1-team",
};

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

function slugForTeam(team: string): string {
  const key = team.trim().toLowerCase();
  if (SLUG_OVERRIDES[key]) {
    return SLUG_OVERRIDES[key];
  }
  return key
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}

export function TeamBadge({ team, size = "md" }: TeamBadgeProps) {
  const color = resolveTeamColor(team);
  const isSmall = size === "sm";
  const [logoFailed, setLogoFailed] = useState(false);
  const logoSrc = useMemo(() => `/assets/logos/${slugForTeam(team)}.svg`, [team]);
  useEffect(() => {
    setLogoFailed(false);
  }, [logoSrc]);
  const side = isSmall ? "h-8 w-8 rounded-[10px]" : "h-11 w-11 rounded-[12px]";
  const monogramSize = isSmall ? "text-[9px]" : "text-[11px]";
  return (
    <div
      className={`relative flex items-center justify-center overflow-hidden border ${side}`}
      style={{ borderColor: `${color}aa`, backgroundColor: color }}
      aria-label={`${team} badge`}
    >
      {!logoFailed && (
        <img
          src={logoSrc}
          alt=""
          className="h-[68%] w-[68%] object-contain"
          onError={() => setLogoFailed(true)}
        />
      )}
      {logoFailed && <span className={`font-semibold tracking-wide text-white ${monogramSize}`}>{markForTeam(team)}</span>}
    </div>
  );
}
