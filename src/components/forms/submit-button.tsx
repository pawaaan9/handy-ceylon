import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

export function SubmitButton({
  pending,
  pendingLabel,
  children,
  ...props
}: React.ComponentProps<typeof Button> & { pending: boolean; pendingLabel: string }) {
  return (
    <Button type="submit" size="xl" disabled={pending || props.disabled} aria-busy={pending} {...props}>
      {pending ? (
        <>
          <Spinner data-icon="inline-start" aria-hidden="true" />
          {pendingLabel}
        </>
      ) : (
        children
      )}
    </Button>
  );
}
