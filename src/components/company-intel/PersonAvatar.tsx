import { useState } from "react";
import { cn } from "@/lib/utils";

interface PersonAvatarProps {
  name: string;
  src?: string | null;
  size?: number;
  className?: string;
}

function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("") || "?";
}

function hashIdx(s: string, mod: number) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h) % mod;
}

export function PersonAvatar({ name, src, size = 28, className }: PersonAvatarProps) {
  const [failed, setFailed] = useState(false);
  const idx = hashIdx(name, 8);
  if (src && !failed) {
    return (
      <img
        src={src}
        alt={name}
        width={size}
        height={size}
        onError={() => setFailed(true)}
        className={cn(
          "shrink-0 rounded-full object-cover ring-1 ring-ui-border-light",
          className,
        )}
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full font-semibold",
        className,
      )}
      style={{
        width: size,
        height: size,
        fontSize: size * 0.4,
        background: `hsl(var(--avatar-${idx}-bg))`,
        color: `hsl(var(--avatar-${idx}-text))`,
      }}
    >
      {initials(name)}
    </div>
  );
}
