import { useState } from "react";
import { cn } from "@/lib/utils";
import { getAvatarToneClass, getInitials } from "./candidate-ui";

/**
 * Headshots and employer logos come with every search row from Crustdata
 * (basic_profile.profile_picture_permalink, employer company_logo_url).
 * Until 2026-10-13 the page never rendered the headshot and built logos
 * from a favicon lookup on a domain the rows rarely carry, so every
 * surgeon was a pair of initials. These two components show the real
 * image when there is one and fall back to initials when there is not.
 */

export function PersonAvatar({
  name,
  src,
  className,
  textClassName = "text-xs",
}: {
  name: string;
  src?: string | null;
  className?: string;
  textClassName?: string;
}) {
  const [failed, setFailed] = useState(false);
  const showImage = !!src && !failed;
  return (
    <div
      className={cn(
        "relative shrink-0 overflow-hidden rounded-full",
        !showImage && getAvatarToneClass(name || "x"),
        className,
      )}
      aria-hidden="true"
    >
      {showImage ? (
        <img
          src={src ?? ""}
          alt=""
          loading="lazy"
          referrerPolicy="no-referrer"
          className="absolute inset-0 h-full w-full object-cover"
          onError={() => setFailed(true)}
        />
      ) : (
        <div className={cn("flex h-full w-full items-center justify-center font-bold", textClassName)}>
          {getInitials(name || "?")}
        </div>
      )}
    </div>
  );
}

export function OrgLogo({
  name,
  src,
  fallbackSrc,
  className,
  textClassName = "text-[11px]",
}: {
  name: string;
  /** The provider's logo URL (Crustdata). Preferred. */
  src?: string | null;
  /** A favicon lookup by domain. Used only when the provider has no logo. */
  fallbackSrc?: string | null;
  className?: string;
  textClassName?: string;
}) {
  const [primaryFailed, setPrimaryFailed] = useState(false);
  const [fallbackFailed, setFallbackFailed] = useState(false);
  const url = src && !primaryFailed ? src : fallbackSrc && !fallbackFailed ? fallbackSrc : null;
  return (
    <div
      className={cn(
        "relative shrink-0 overflow-hidden rounded-md border border-ui-border-light bg-white",
        className,
      )}
      aria-hidden="true"
    >
      {url ? (
        <img
          src={url}
          alt=""
          loading="lazy"
          referrerPolicy="no-referrer"
          className="absolute inset-0 h-full w-full object-contain p-0.5"
          onError={() => (url === src ? setPrimaryFailed(true) : setFallbackFailed(true))}
        />
      ) : (
        <div
          className={cn(
            "flex h-full w-full items-center justify-center font-bold",
            getAvatarToneClass(name || "x"),
            textClassName,
          )}
        >
          {getInitials(name || "?")}
        </div>
      )}
    </div>
  );
}
