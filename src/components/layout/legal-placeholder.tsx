import { Container } from "./container";

/**
 * Pre-launch placeholder. Replace with legally reviewed text before going
 * live — users accept these documents at sign-up.
 */
export function LegalPlaceholder({ title, points }: { title: string; points: string[] }) {
  return (
    <Container className="max-w-3xl py-16 sm:py-20">
      <h1 className="text-3xl font-bold text-foreground sm:text-4xl">{title}</h1>
      <p className="mt-4 rounded-lg border border-urgent/25 bg-urgent-soft px-4 py-3 text-sm text-foreground">
        Draft — the full {title} is being finalised and will be published here before Handy Ceylon launches.
      </p>
      <h2 className="mt-10 text-lg font-semibold text-foreground">Summary of our commitments</h2>
      <ul className="mt-4 list-disc space-y-2 pl-5 text-muted-foreground">
        {points.map((p) => (
          <li key={p}>{p}</li>
        ))}
      </ul>
    </Container>
  );
}
