import { cn } from "@/lib/utils";

/**
 * The only way LinkedIn appears in Oslr: a badge that links out. Never a
 * text link or a "LinkedIn" label (product rule, 2026-10-18).
 */
export function LinkedInBadge({ href, size = 18, label, className }: { href: string | null | undefined; size?: number; label: string; className?: string }) {
  if (!href) return null;
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      aria-label={label}
      title={label}
      className={cn("inline-flex shrink-0 items-center justify-center rounded-[4px] bg-[#0A66C2] transition-opacity duration-150 hover:opacity-85", className)}
      style={{ width: size, height: size }}
    >
      <svg viewBox="0 0 24 24" width={size * 0.62} height={size * 0.62} aria-hidden="true" fill="#FFFFFF">
        <path d="M4.98 3.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5ZM3 9.75h4v11H3v-11Zm6.5 0h3.8v1.5h.05c.53-.95 1.83-1.95 3.77-1.95 4.03 0 4.78 2.55 4.78 5.87v5.58h-4v-4.95c0-1.18-.02-2.7-1.7-2.7-1.7 0-1.96 1.28-1.96 2.61v5.04h-4v-11Z" />
      </svg>
    </a>
  );
}
