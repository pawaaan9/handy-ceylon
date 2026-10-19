import { ArrowLeft, MapPin, Phone, UserRound } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { PageSkeleton, Panel } from "@/components/app-shell/page-header";
import { FormAlert } from "@/components/forms/form-alert";
import { addressLines, formatPhone } from "@/features/addresses/format";
import { requireRole } from "@/features/auth/server/dal";
import { BookingPanel } from "@/features/bookings/components/booking-panel";
import { bookingIdSchema } from "@/features/bookings/schemas";
import { bookingModeLabels } from "@/features/bookings/types";
import { getBookingView } from "@/features/bookings/server/repository";
import { getRequestForViewer } from "@/features/requests/server/repository";
import { urgencyOptions } from "@/features/requests/types";

export const metadata: Metadata = { title: "Job" };

export default function TechnicianJobPage(props: PageProps<"/technician/jobs/[bookingId]">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <TechnicianJobContent {...props} />
    </Suspense>
  );
}

async function TechnicianJobContent({ params, searchParams }: PageProps<"/technician/jobs/[bookingId]">) {
  const { bookingId } = await params;
  const user = await requireRole(["technician"], { from: `/technician/jobs/${bookingId}` });
  const id = bookingIdSchema.safeParse(bookingId);
  if (!id.success) notFound();
  const [booking, { status }] = await Promise.all([
    getBookingView({ uid: user.uid, role: "technician" }, id.data),
    searchParams,
  ]);
  if (!booking) notFound();
  // Address and contact are only readable while this technician is the one assigned.
  const request = await getRequestForViewer({ uid: user.uid, role: "technician" }, booking.requestId);
  const showContact = request?.address && booking.status !== "cancelled";

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <Link
        href="/technician/jobs"
        className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        All jobs
      </Link>
      {status === "accepted" ? (
        <FormAlert tone="success" title="You got the job">
          The customer has been shown your inspection fee and arrival time. Wait for them to confirm the visit before
          travelling.
        </FormAlert>
      ) : null}
      {booking.mode === "quote_online" && booking.status === "confirmed" ? (
        <FormAlert tone="info" title="Price agreed for the quoted scope">
          If the site differs from the description, send a revised quotation with the reason before doing any extra
          paid work. The customer must approve it.
        </FormAlert>
      ) : null}

      <div>
        <p className="text-sm font-semibold text-urgent">
          {bookingModeLabels[booking.mode]} · {booking.serviceName}
        </p>
        <h1 className="mt-1 text-2xl font-bold break-words text-foreground sm:text-3xl">{booking.title}</h1>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.5fr_1fr]">
        <BookingPanel booking={booking} audience="technician" viewerUid={user.uid} />
        <div className="space-y-5">
          {request ? (
            <Panel title="The problem">
              <p className="text-sm break-words whitespace-pre-line text-foreground">{request.description}</p>
              <p className="mt-3 text-sm text-muted-foreground">Urgency: {urgencyOptions[request.urgency].label}</p>
              {request.attachments.length > 0 ? (
                <ul className="mt-4 grid grid-cols-3 gap-2">
                  {request.attachments.map((a) => (
                    <li key={a.storagePath} className="overflow-hidden rounded-md border bg-muted/40">
                      {a.url && a.kind === "image" ? (
                        <a href={a.url} target="_blank" rel="noreferrer" className="block aspect-square">
                          {/* Short-lived signed URL to a private object; not optimisable by next/image. */}
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={a.url} alt={a.name} className="size-full object-cover" loading="lazy" />
                        </a>
                      ) : a.url ? (
                        <a href={a.url} target="_blank" rel="noreferrer" className="block p-2 text-xs text-primary underline">
                          {a.name}
                        </a>
                      ) : (
                        <span className="block p-2 text-xs text-muted-foreground">{a.name}</span>
                      )}
                    </li>
                  ))}
                </ul>
              ) : null}
            </Panel>
          ) : null}

          <Panel title="Customer and address">
            {showContact && request?.address ? (
              <div className="space-y-2 text-sm text-muted-foreground">
                <p className="flex gap-2">
                  <UserRound className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
                  {request.address.recipientName}
                </p>
                <a
                  href={`tel:${request.address.contactNumber}`}
                  className="flex gap-2 font-medium text-primary hover:underline"
                >
                  <Phone className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                  {formatPhone(request.address.contactNumber)}
                </a>
                <p className="flex gap-2">
                  <MapPin className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
                  <span>
                    {addressLines(request.address).map((line) => (
                      <span key={line} className="block">
                        {line}
                      </span>
                    ))}
                  </span>
                </p>
                {request.address.location ? (
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${request.address.location.lat},${request.address.location.lng}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-block font-medium text-primary hover:underline"
                  >
                    Open in Google Maps
                  </a>
                ) : null}
                {request.address.directions ? <p className="border-l-2 pl-3 italic">{request.address.directions}</p> : null}
                {request.accessInstructions ? (
                  <div className="border-t pt-3">
                    <p className="font-medium text-foreground">Access instructions</p>
                    <p className="mt-1 break-words whitespace-pre-line">{request.accessInstructions}</p>
                  </div>
                ) : null}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                {booking.city}, {booking.district}. Contact details are only shown while you&apos;re assigned to an active job.
              </p>
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}
