import { useState } from "react";
import type { User } from "@/lib/api";
import { cn } from "@/lib/utils";

export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();
}

/** The user's photo, or their initials on a soft accent background. */
export function Avatar({ user, className }: { user: Pick<User, "name" | "avatarVersion"> | null; className?: string }) {
  const [failed, setFailed] = useState<number | null>(null);
  const showPhoto = user?.avatarVersion && failed !== user.avatarVersion;
  return (
    <span className={cn("relative grid size-8 shrink-0 place-items-center overflow-hidden rounded-full bg-primary-soft font-semibold text-primary-soft-fg select-none", className)} aria-hidden>
      {showPhoto ? (
        <img src={`/api/profile/avatar?v=${user!.avatarVersion}`} alt="" className="size-full object-cover" onError={() => setFailed(user!.avatarVersion)} />
      ) : (
        <span className="text-[0.8em] leading-none">{user ? initials(user.name) : ""}</span>
      )}
    </span>
  );
}
