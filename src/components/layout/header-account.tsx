import Link from "next/link";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { routes } from "@/config/site";
import { getCurrentUser, homePathForUser } from "@/features/auth/server/dal";
import { initials } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * Account buttons for the public header. Reads the session, so it always
 * renders inside a Suspense boundary and the rest of the page stays static.
 */
export async function HeaderAccount({
  variant = "desktop",
}: {
  variant?: "desktop" | "mobile";
}) {
  // Both variants render on navy: the header capsule and the mobile menu.
  const user = await getCurrentUser();
  const mobile = variant === "mobile";

  if (user) {
    const href = await homePathForUser(user);
    return (
      <Button
        asChild
        variant="outline"
        size="lg"
        className={cn(
          "gap-2 rounded-full pl-1",
          mobile
            ? "h-12 w-full"
            : "h-10 border-white/15 bg-white/5 text-white hover:bg-white/10 hover:text-white",
        )}
      >
        <Link href={href}>
          <Avatar className="size-7">
            {user.photoURL ? (
              <AvatarImage
                src={user.photoURL}
                alt=""
                className="object-cover"
              />
            ) : null}
            <AvatarFallback className="bg-brand-soft text-[0.65rem] font-semibold text-primary">
              {initials(user.displayName || user.email || "?")}
            </AvatarFallback>
          </Avatar>
          Dashboard
        </Link>
      </Button>
    );
  }

  return (
    <div
      className={cn(
        "items-center",
        mobile ? "grid grid-cols-2 gap-2" : "flex gap-1",
      )}
    >
      <Button
        asChild
        variant={mobile ? "outline" : "ghost"}
        size="lg"
        className={cn(
          "rounded-full",
          mobile
            ? "h-12"
            : "h-10 px-4 text-white/80 hover:bg-white/10 hover:text-white",
        )}
      >
        <Link href={routes.login}>Log in</Link>
      </Button>
      <Button
        asChild
        variant="outline"
        size="lg"
        className={cn(
          "rounded-full",
          mobile
            ? "h-12"
            : "hidden h-10 border-white bg-white px-4 text-navy hover:bg-white/90 md:inline-flex",
        )}
      >
        <Link href={routes.signUp}>Sign up</Link>
      </Button>
    </div>
  );
}

export function HeaderAccountSkeleton({
  variant = "desktop",
}: {
  variant?: "desktop" | "mobile";
}) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "animate-pulse rounded-full",
        variant === "mobile" ? "h-12 w-full bg-muted" : "h-10 w-40 bg-white/10",
      )}
    />
  );
}
