import { useState } from "react";
import { resolveTeamColor } from "../design/teamColors";

interface DriverHeadshotProps {
  abbr: string;
  headshotUrl: string | null;
  teamColor?: string | null;
  size?: "sm" | "md" | "lg";
}

const sizeMap = {
  sm: 28,
  md: 36,
  lg: 72,
} as const;

export function DriverHeadshot({
  abbr,
  headshotUrl,
  teamColor,
  size = "md",
}: DriverHeadshotProps) {
  const [broken, setBroken] = useState(false);
  const px = sizeMap[size];
  const ring = teamColor || resolveTeamColor(abbr);
  if (!headshotUrl || broken) {
    return (
      <div
        className="flex items-center justify-center rounded-full text-[11px] font-medium text-white"
        style={{ width: px, height: px, backgroundColor: ring }}
      >
        {abbr}
      </div>
    );
  }
  return (
    <img
      src={headshotUrl}
      alt={abbr}
      loading="lazy"
      onError={() => setBroken(true)}
      className="rounded-full object-cover"
      style={{ width: px, height: px, border: `2px solid ${ring}` }}
    />
  );
}
