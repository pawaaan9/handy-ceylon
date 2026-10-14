import Image from "next/image";

import { cn } from "@/lib/utils";

import { renderCategoryIcon } from "../icons";
import type { CategoryView } from "../types";

/** Category image when one is set in Firestore, otherwise its icon. */
export function CategoryMedia({
  category,
  size = "md",
  className,
}: {
  category: Pick<CategoryView, "name" | "icon" | "imageURL">;
  size?: "md" | "lg";
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
    <span className={cn(box, "flex shrink-0 items-center justify-center bg-brand-soft text-primary", className)}>
      {renderCategoryIcon(category.icon, { className: size === "lg" ? "size-7" : "size-5", "aria-hidden": true })}
    </span>
  );
}
