import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { PageSkeleton } from "@/components/app-shell/page-header";
import { requireRole } from "@/features/auth/server/dal";
import { BookingPanel } from "@/features/bookings/components/booking-panel";
import { bookingIdSchema } from "@/features/bookings/schemas";
import { getBookingView } from "@/features/bookings/server/repository";
import { bookingModeLabels } from "@/features/bookings/types";

export const metadata: Metadata = { title: "Job" };

export default function AdminJobPage(props: PageProps<"/admin/jobs/[bookingId]">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Content {...props} />
    </Suspense>
  );
}

async function Content({ params }: PageProps<"/admin/jobs/[bookingId]">) {
  const { bookingId } = await params;
  const user = await requireRole(["admin"], { from: `/admin/jobs/${bookingId}` });
  const id = bookingIdSchema.safeParse(bookingId);
  if (!id.success) notFound();
  const booking = await getBookingView({ uid: user.uid, role: "admin" }, id.data);
  if (!booking) notFound();

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Link href="/admin/jobs" className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" aria-hidden="true" />
        All jobs
      </Link>
      <div>
        <p className="text-sm font-semibold text-primary">
          {bookingModeLabels[booking.mode]} · {booking.serviceName}
        </p>
        <h1 className="mt-1 text-2xl font-bold break-words text-foreground sm:text-3xl">{booking.title}</h1>
        <p className="mt-1.5 text-muted-foreground">
          {booking.city}, {booking.district} · Job {booking.id}
        </p>
      </div>
      <BookingPanel booking={booking} audience="admin" viewerUid={user.uid} />
    </div>
  );
}
