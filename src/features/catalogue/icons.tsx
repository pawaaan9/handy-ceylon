import {
  AirVent,
  BrickWall,
  Droplets,
  Hammer,
  PaintRoller,
  PlugZap,
  Sparkles,
  Trees,
  WashingMachine,
  Wrench,
  type LucideProps,
} from "lucide-react";

/**
 * Icons a category may reference by name in Firestore. Unknown names fall
 * back to a generic wrench, so a typo in data never breaks a page.
 */
const registry: Record<string, (props: LucideProps) => React.ReactElement> = {
  "air-vent": (p) => <AirVent {...p} />,
  "brick-wall": (p) => <BrickWall {...p} />,
  droplets: (p) => <Droplets {...p} />,
  hammer: (p) => <Hammer {...p} />,
  "paint-roller": (p) => <PaintRoller {...p} />,
  "plug-zap": (p) => <PlugZap {...p} />,
  sparkles: (p) => <Sparkles {...p} />,
  trees: (p) => <Trees {...p} />,
  "washing-machine": (p) => <WashingMachine {...p} />,
  wrench: (p) => <Wrench {...p} />,
};

export const categoryIconNames = Object.keys(registry);

export function renderCategoryIcon(name: string, props: LucideProps): React.ReactElement {
  return (registry[name] ?? registry.wrench)(props);
}
