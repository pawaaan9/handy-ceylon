import Image from "next/image";

import { cn } from "@/lib/utils";

import { renderCategoryIcon } from "../icons";
import type { CategoryView } from "../types";

/** Flat tile colours, rotated by position so neighbouring tiles differ. */
const tones = [
  "bg-brand-soft text-primary",
  "bg-urgent-soft text-urgent",
  "bg-navy text-navy-foreground",
  "bg-sand text-clay",
  "bg-leaf/15 text-leaf",
] as const;

/** Category image when one is set in Firestore, otherwise its icon on a coloured tile. */
export function CategoryMedia({
  category,
  size = "md",
  index = 0,
  className,
}: {
  category: Pick<CategoryView, "name" | "icon" | "imageURL">;
  size?: "md" | "lg";
  index?: number;
  className?: string;
}) {
  const box = size === "lg" ? "size-16 rounded-2xl" : "size-11 rounded-lg";
  if (category.imageURL) {
    return (
      <Image
        src={category.imageURL}
        alt=""
        width={size === "lg" ? 64 : 44}
        height={size === "lg" ? 64 : 44}
        className={cn(box, "shrink-0 object-cover", className)}
      />
    );
  }
  return (
    <span className={cn(box, "flex shrink-0 items-center justify-center", tones[index % tones.length], className)}>
      {renderCategoryIcon(category.icon, { className: size === "lg" ? "size-7" : "size-5", "aria-hidden": true })}
    </span>
  );
}
