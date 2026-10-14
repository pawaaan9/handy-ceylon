import { CircleCheck, ClipboardList, Receipt, UserCheck } from "lucide-react";

import { Container } from "@/components/layout/container";
import { SectionHeading } from "@/components/layout/section-heading";

const steps = [
  {
    icon: ClipboardList,
    title: "Describe the job",
    description: "Pick a service, tell us what needs fixing and where. Add photos for online quotes.",
  },
  {
    icon: UserCheck,
    title: "Choose your technician",
    description: "Compare verified technicians, inspection fees or quotations, then choose.",
  },
  {
    icon: Receipt,
    title: "Approve the quotation",
    description: "Get an itemised price in LKR. Nothing goes ahead until you approve it.",
  },
  {
    icon: CircleCheck,
    title: "Job done, then review",
    description: "Track progress, chat in the app and rate the technician afterwards.",
  },
] as const;

export function HowItWorks() {
  return (
    <section id="how-it-works" aria-labelledby="how-it-works-title" className="py-20 sm:py-28">
      <Container>
        <SectionHeading
          id="how-it-works-title"
          eyebrow="How it works"
          title="From request to repair in four clear steps"
          align="center"
        />
        <ol className="relative mt-16 grid gap-10 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6">
          <span aria-hidden="true" className="absolute top-7 right-[12.5%] left-[12.5%] hidden border-t-2 border-dashed lg:block" />
          {steps.map(({ icon: Icon, title, description }, index) => (
            <li key={title} className="relative flex flex-col items-center text-center">
              <span className="relative flex size-14 items-center justify-center rounded-2xl border bg-background text-primary">
                <Icon className="size-6" aria-hidden="true" />
                <span className="absolute -top-2 -right-2 flex size-6 items-center justify-center rounded-full bg-urgent text-xs font-bold text-urgent-foreground">
                  {index + 1}
                </span>
              </span>
              <h3 className="mt-6 text-lg font-semibold text-foreground">{title}</h3>
              <p className="mt-2 max-w-[16rem] text-sm leading-relaxed text-muted-foreground">{description}</p>
            </li>
          ))}
        </ol>
      </Container>
    </section>
  );
}
