import { ClipboardList, CircleCheck, Receipt, UserCheck } from "lucide-react";

import { Container } from "@/components/layout/container";
import { SectionHeading } from "@/components/layout/section-heading";

const steps = [
  {
    icon: ClipboardList,
    title: "Describe the job",
    description:
      "Pick a service, tell us what needs fixing and where. Add photos or measurements if you want online quotes.",
  },
  {
    icon: UserCheck,
    title: "Choose your technician",
    description:
      "Nearby verified technicians respond. Compare ratings, inspection fees or quotations, then choose.",
  },
  {
    icon: Receipt,
    title: "Approve the quotation",
    description:
      "Get an itemised quotation in LKR. Nothing goes ahead until you approve the price and scope.",
  },
  {
    icon: CircleCheck,
    title: "Job done, then review",
    description:
      "Track progress, chat in the app, and rate the technician once the job is complete.",
  },
] as const;

export function HowItWorks() {
  return (
    <section id="how-it-works" aria-labelledby="how-it-works-title" className="py-20 sm:py-24">
      <Container>
        <SectionHeading
          id="how-it-works-title"
          eyebrow="How it works"
          title="From request to repair in four clear steps"
          align="center"
        />
        <ol className="mt-14 grid gap-10 sm:grid-cols-2 lg:grid-cols-4 lg:gap-8">
          {steps.map(({ icon: Icon, title, description }, index) => (
            <li key={title} className="relative">
              <div className="flex items-center gap-3">
                <span className="flex size-11 items-center justify-center rounded-full border-2 border-primary/20 bg-background text-primary">
                  <Icon className="size-5" aria-hidden="true" />
                </span>
                <span className="text-sm font-semibold text-muted-foreground">
                  Step {index + 1}
                </span>
              </div>
              <h3 className="mt-5 text-lg font-semibold text-foreground">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{description}</p>
            </li>
          ))}
        </ol>
      </Container>
    </section>
  );
}
