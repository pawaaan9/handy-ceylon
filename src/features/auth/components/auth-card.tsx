export function AuthCard({
  title,
  description,
  children,
  footer,
}: {
  title: string;
  description?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div className="w-full max-w-md">
      <div className="rounded-2xl border bg-card p-6 shadow-[0_1px_2px_rgb(0_0_0/0.04),0_12px_32px_-16px_rgb(15_23_42/0.18)] sm:p-8">
        <h1 className="text-2xl font-bold text-foreground">{title}</h1>
        {description ? (
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{description}</p>
        ) : null}
        <div className="mt-6">{children}</div>
      </div>
      {footer ? <div className="mt-6 text-center text-sm text-muted-foreground">{footer}</div> : null}
    </div>
  );
}

export function AuthCardSkeleton() {
  return (
    <div className="w-full max-w-md" role="status" aria-label="Loading">
      <div className="rounded-2xl border bg-card p-6 sm:p-8">
        <div className="h-7 w-40 animate-pulse rounded bg-muted" />
        <div className="mt-3 h-4 w-64 animate-pulse rounded bg-muted" />
        <div className="mt-8 space-y-5">
          {[0, 1, 2].map((i) => (
            <div key={i} className="space-y-2">
              <div className="h-4 w-24 animate-pulse rounded bg-muted" />
              <div className="h-10 animate-pulse rounded-lg bg-muted" />
            </div>
          ))}
          <div className="h-11 animate-pulse rounded-lg bg-muted" />
        </div>
      </div>
    </div>
  );
}
