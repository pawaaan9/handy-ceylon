import Image from "next/image";

import { photos, type PhotoKey } from "@/assets/photos";
import { LinePattern } from "@/components/illustrations/line-pattern";
import { cn } from "@/lib/utils";

import { Container } from "./container";

/** Navy header band for public inner pages, with an optional framed photo. */
export function PageHero({
  eyebrow,
  title,
  description,
  photo,
  children,
  className,
}: {
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  photo?: PhotoKey;
  children?: React.ReactNode;
  className?: string;
}) {
  const image = photo ? photos[photo] : null;
  return (
    <section className={cn("relative -mt-[5rem] overflow-hidden bg-navy pt-[5rem] text-navy-foreground", className)}>
      <LinePattern className="text-white/[0.04]" />
      <Container
        className={cn(
          "relative grid items-center gap-10 py-14 sm:py-16 lg:py-20",
          image && "lg:grid-cols-[1.3fr_1fr]",
        )}
      >
        <div className="min-w-0">
          {eyebrow ? (
            <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold tracking-wide uppercase">
              <span className="size-1.5 rounded-full bg-urgent" aria-hidden="true" />
              {eyebrow}
            </div>
          ) : null}
          <h1 className="mt-5 text-4xl leading-tight font-bold sm:text-5xl">{title}</h1>
          {description ? <p className="mt-4 max-w-2xl text-lg leading-relaxed text-white/75">{description}</p> : null}
          {children ? <div className="mt-8">{children}</div> : null}
        </div>
        {image ? (
          <div className="relative hidden aspect-[4/3] overflow-hidden rounded-3xl ring-4 ring-white/10 lg:block">
            <Image src={image.src} alt={image.alt} fill placeholder="blur" sizes="40vw" className="object-cover" />
          </div>
        ) : null}
      </Container>
    </section>
  );
}
