import { LifeBuoy, Zap } from "lucide-react";
import Link from "next/link";

import { LinePattern } from "@/components/illustrations/line-pattern";
import { Logo } from "@/components/layout/logo";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { routes } from "@/config/site";
import { authRoutes } from "@/features/auth/redirects";
import { getCurrentUser } from "@/features/auth/server/dal";
import { formatLocalMobile } from "@/lib/format";

import { AppNav } from "./app-nav";
import { MobileNav } from "./mobile-nav";
import { navByRole, roleLabels } from "./nav-config";
import { UserMenu } from "./user-menu";

/** Navy sidebar (desktop). Reads the session, so it renders inside Suspense. */
export async function AppSidebar() {
  const user = await getCurrentUser();
  const items = user?.role ? navByRole[user.role] : [];
  return (
    <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col overflow-hidden bg-navy text-navy-foreground lg:flex">
      <LinePattern className="text-white/[0.04]" />
      <div className="relative flex h-16 items-center px-5">
        <Logo inverted />
      </div>
      <div className="relative flex-1 overflow-y-auto px-3 py-4">
        <AppNav items={items} tone="dark" />
      </div>
      {user?.role === "customer" ? (
        <div className="relative m-3 rounded-2xl bg-white/[0.07] p-4">
          <LifeBuoy className="size-5 text-urgent" aria-hidden="true" />
          <p className="mt-2 text-sm font-semibold">Something broken?</p>
          <p className="mt-1 text-xs text-white/65">Get a verified technician to your door.</p>
          <Button asChild variant="urgent" size="lg" className="mt-3 w-full">
            <Link href={routes.getHelpNow}>
              <Zap data-icon="inline-start" aria-hidden="true" />
              Get Help Now
            </Link>
          </Button>
        </div>
      ) : null}
    </aside>
  );
}

export function AppSidebarSkeleton() {
  return <div className="hidden h-dvh w-64 shrink-0 bg-navy lg:block" aria-hidden="true" />;
}

/** Top bar: mobile menu + logo on small screens, account menu everywhere. */
export async function AppHeader() {
  const user = await getCurrentUser();
  const items = user?.role ? navByRole[user.role] : [];
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-3 border-b bg-background/95 px-4 backdrop-blur sm:px-6 lg:px-8">
      <div className="flex items-center gap-3">
        <MobileNav items={items} />
        <div className="lg:hidden">
          <Logo />
        </div>
      </div>
      {user ? (
        <UserMenu
          name={user.displayName}
          contact={user.email ?? formatLocalMobile(user.phoneNumber)}
          photoURL={user.photoURL}
          roleLabel={user.role ? roleLabels[user.role] : "Account setup incomplete"}
          items={items}
        />
      ) : (
        <div className="flex items-center gap-2">
          <Button asChild variant="ghost" size="lg">
            <Link href={authRoutes.login}>Log in</Link>
          </Button>
          <Button asChild size="lg">
            <Link href={authRoutes.signUp}>Sign up</Link>
          </Button>
        </div>
      )}
    </header>
  );
}

export function AppHeaderSkeleton() {
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b bg-background px-4 sm:px-6 lg:px-8">
      <div className="lg:invisible">
        <Logo />
      </div>
      <Skeleton className="h-9 w-32 rounded-lg" />
    </header>
  );
}
