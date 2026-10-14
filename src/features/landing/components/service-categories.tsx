import { Container } from "@/components/layout/container";
import { SectionHeading } from "@/components/layout/section-heading";
import { serviceCategories } from "@/features/services/categories";

export function ServiceCategories() {
  return (
    <section id="services" aria-labelledby="services-title" className="py-20 sm:py-24">
      <Container>
        <SectionHeading
          id="services-title"
          eyebrow="Services"
          title="Skilled help for every corner of your home"
          description="From a dripping tap to a full repaint, request the service you need and we will connect you with qualified technicians in your area."
        />
        <ul className="mt-12 grid gap-px overflow-hidden rounded-xl border bg-border sm:grid-cols-2 lg:grid-cols-4">
          {serviceCategories.map(({ id, name, description, icon: Icon }) => (
            <li key={id} className="bg-card p-6">
              <span className="flex size-10 items-center justify-center rounded-lg bg-brand-soft text-primary">
                <Icon className="size-5" aria-hidden="true" />
              </span>
              <h3 className="mt-4 text-base font-semibold text-foreground">{name}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                {description}
              </p>
            </li>
          ))}
        </ul>
      </Container>
    </section>
  );
}
