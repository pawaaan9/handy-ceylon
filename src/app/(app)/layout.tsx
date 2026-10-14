import { Suspense } from "react";

import {
  AppHeader,
  AppHeaderSkeleton,
  AppSidebar,
  AppSidebarSkeleton,
} from "@/components/app-shell/app-header";
import { PageSkeleton } from "@/components/app-shell/page-header";
import { FirebaseAuthProvider } from "@/features/auth/components/firebase-auth-provider";
import { getCurrentUser } from "@/features/auth/server/dal";

/**
 * Shell for signed-in areas. Authorization is NOT decided here (layouts don't
 * re-render on navigation): every page calls requireUser/requireRole itself.
 */
export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-dvh flex-1 bg-sand/40">
      <Suspense fallback={<AppSidebarSkeleton />}>
        <AppSidebar />
      </Suspense>
      <div className="flex min-w-0 flex-1 flex-col">
        <Suspense fallback={<AppHeaderSkeleton />}>
          <AppHeader />
        </Suspense>
        <main id="main" className="flex-1 px-4 py-8 sm:px-6 lg:px-10 lg:py-10">
          <div className="mx-auto w-full max-w-6xl">
            <Suspense fallback={<PageSkeleton />}>
              <ClientAuth>{children}</ClientAuth>
            </Suspense>
          </div>
        </main>
      </div>
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
