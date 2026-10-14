import { Container } from "./container";
import { PageHero } from "./page-hero";

/**
 * Pre-launch placeholder. Replace with legally reviewed text before going
 * live — users accept these documents at sign-up.
 */
export function LegalPlaceholder({
  title,
  points,
}: {
  title: string;
  points: string[];
}) {
  return (
    <>
      <PageHero eyebrow="Legal" title={title} />
      <Container className="max-w-3xl py-14 sm:py-16">
        <p className="rounded-xl border border-urgent/25 bg-urgent-soft px-4 py-3 text-sm text-foreground">
          Draft — the full {title} is being finalised and will be published here
          before Handy Ceylon launches.
        </p>
        <h2 className="mt-10 text-lg font-semibold text-foreground">
          Summary of our commitments
        </h2>
        <ul className="mt-4 list-disc space-y-2 pl-5 text-muted-foreground">
          {points.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      </Container>
    </>
  );
}
