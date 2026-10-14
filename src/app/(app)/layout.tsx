import { Suspense } from "react";

import { AppHeader, AppHeaderSkeleton } from "@/components/app-shell/app-header";
import { PageSkeleton } from "@/components/app-shell/page-header";
import { Container } from "@/components/layout/container";
import { FirebaseAuthProvider } from "@/features/auth/components/firebase-auth-provider";
import { getCurrentUser } from "@/features/auth/server/dal";

/**
 * Shell for signed-in areas. Authorization is NOT decided here (layouts don't
 * re-render on navigation): every page calls requireUser/requireRole itself.
 */
export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-full flex-1 flex-col bg-muted/40">
      <Suspense fallback={<AppHeaderSkeleton />}>
        <AppHeader />
      </Suspense>
      <main id="main" className="flex-1 py-8 sm:py-10">
        <Container>
          <Suspense fallback={<PageSkeleton />}>
            <ClientAuth>{children}</ClientAuth>
          </Suspense>
        </Container>
      </main>
    </div>
  );
}

/** Keeps the browser Firebase SDK aligned with the server session. */
async function ClientAuth({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) return children;
  return (
    <FirebaseAuthProvider uid={user.uid} role={user.role}>
      {children}
    </FirebaseAuthProvider>
  );
}
