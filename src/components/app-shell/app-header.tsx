import Link from "next/link";

import { Container } from "@/components/layout/container";
import { Logo } from "@/components/layout/logo";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { authRoutes } from "@/features/auth/redirects";
import { getCurrentUser } from "@/features/auth/server/dal";

import { AppNav } from "./app-nav";
import { navByRole } from "./nav-config";
import { UserMenu } from "./user-menu";

const roleLabels = { customer: "Customer", technician: "Technician", admin: "Administrator" } as const;

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <Container className="flex h-16 items-center justify-between gap-4">{children}</Container>
    </header>
  );
}

/** Reads the session, so it renders inside a Suspense boundary. */
export async function AppHeader() {
  const user = await getCurrentUser();
  const items = user?.role ? navByRole[user.role] : [];
  return (
    <Frame>
      <div className="flex items-center gap-6">
        <Logo />
        <div className="hidden md:block">
          <AppNav items={items} />
        </div>
      </div>
      {user ? (
        <UserMenu
          name={user.displayName}
          email={user.email}
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
    </Frame>
  );
}

export function AppHeaderSkeleton() {
  return (
    <Frame>
      <Logo />
      <Skeleton className="h-9 w-32 rounded-lg" />
    </Frame>
  );
}
