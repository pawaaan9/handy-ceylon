import { LifeBuoy, Zap } from "lucide-react";
import Link from "next/link";

import { LinePattern } from "@/components/illustrations/line-pattern";
import { Logo } from "@/components/layout/logo";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { routes } from "@/config/site";
import { authRoutes, roleHomes } from "@/features/auth/redirects";
import { getCurrentUser, type CurrentUser } from "@/features/auth/server/dal";
import { countApplicationsByStatus } from "@/features/technicians/server/applications";
import { formatLocalMobile } from "@/lib/format";

import { AppNav } from "./app-nav";
import { MobileNav } from "./mobile-nav";
import { navByRole, roleLabels, type NavBadge } from "./nav-config";
import { SidebarAccount, type SidebarAccountInfo } from "./sidebar-account";
import { UserMenu } from "./user-menu";

/**
 * Every page is in the sidebar, so there is no account popup: the signed-in
 * account and Log out live at the bottom of the menu. (An account that hasn't
 * finished setup has no role, no sidebar, and keeps the popup.)
 */
function sidebarAccount(user: CurrentUser | null): SidebarAccountInfo | undefined {
  if (!user?.role) return undefined;
  return {
    name: user.displayName,
    contact: user.email ?? formatLocalMobile(user.phoneNumber),
    photoURL: user.photoURL,
    roleLabel: roleLabels[user.role],
  };
}

/** Live counts shown beside menu items (admins only). Never blocks the menu if it fails. */
async function navBadges(user: CurrentUser | null): Promise<Partial<Record<NavBadge, number>>> {
  if (user?.role !== "admin") return {};
  try {
    const counts = await countApplicationsByStatus();
    return { pendingApplications: counts.pending + counts.under_review };
  } catch {
    return {};
  }
}

/** Navy sidebar (desktop). Reads the session, so it renders inside Suspense. */
export async function AppSidebar() {
  const user = await getCurrentUser();
  const items = user?.role ? navByRole[user.role] : [];
  const badges = await navBadges(user);
  const account = sidebarAccount(user);
  return (
    <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col overflow-hidden bg-navy text-navy-foreground lg:flex">
      <LinePattern className="text-white/[0.04]" />
      <div className="relative flex h-16 items-center px-5">
        <Logo inverted href={user?.role ? roleHomes[user.role] : "/"} />
      </div>
      {user?.role === "admin" ? (
        <p className="relative px-5 text-xs font-semibold tracking-wider text-urgent uppercase">Admin panel</p>
      ) : null}
      <div className="relative flex-1 overflow-y-auto px-3 py-4">
        <AppNav items={items} tone="dark" badges={badges} />
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
      {account ? (
        <div className="relative">
          <SidebarAccount account={account} tone="dark" />
        </div>
      ) : null}
    </aside>
  );
}

export function AppSidebarSkeleton() {
  return <div className="hidden h-dvh w-64 shrink-0 bg-navy lg:block" aria-hidden="true" />;
}

/** Top bar: mobile menu + logo on small screens (hidden on desktop for signed-in accounts with a sidebar). */
export async function AppHeader() {
  const user = await getCurrentUser();
  const items = user?.role ? navByRole[user.role] : [];
  const badges = await navBadges(user);
  const account = sidebarAccount(user);
  return (
    <header
      className={`sticky top-0 z-30 flex h-16 items-center justify-between gap-3 border-b bg-background/95 px-4 backdrop-blur sm:px-6 lg:px-8${account ? " lg:hidden" : ""}`}
    >
      <div className="flex items-center gap-3">
        <MobileNav items={items} badges={badges} account={account} />
        <div className="lg:hidden">
          <Logo href={user?.role ? roleHomes[user.role] : "/"} />
        </div>
      </div>
      {account ? null : user ? (
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
