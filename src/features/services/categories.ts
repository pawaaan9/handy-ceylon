import {
  AirVent,
  BrickWall,
  Droplets,
  Hammer,
  PaintRoller,
  PlugZap,
  Sparkles,
  WashingMachine,
  type LucideIcon,
} from "lucide-react";

/**
 * Launch service catalogue. This is platform configuration (what we offer),
 * not user data. It seeds the `serviceCategories` collection, which becomes
 * the source of truth once admin tooling exists.
 */
export type ServiceCategory = {
  id: string;
  name: string;
  description: string;
  icon: LucideIcon;
};

export const serviceCategories: readonly ServiceCategory[] = [
  {
    id: "plumbing",
    name: "Plumbing",
    description: "Leaks, blocked drains, taps, water pumps and tank fittings.",
    icon: Droplets,
  },
  {
    id: "electrical",
    name: "Electrical",
    description: "Wiring faults, breakers, sockets, lighting and DB boards.",
    icon: PlugZap,
  },
  {
    id: "ac-services",
    name: "AC Services",
    description: "Servicing, gas refills, installation and repairs.",
    icon: AirVent,
  },
  {
    id: "cleaning",
    name: "Cleaning",
    description: "Deep cleaning, move-in/move-out and sofa or carpet care.",
    icon: Sparkles,
  },
  {
    id: "painting",
    name: "Painting",
    description: "Interior and exterior painting, damp treatment and touch-ups.",
    icon: PaintRoller,
  },
  {
    id: "carpentry",
    name: "Carpentry",
    description: "Doors, cupboards, furniture repairs and fittings.",
    icon: Hammer,
  },
  {
    id: "appliance-repair",
    name: "Appliance Repair",
    description: "Washing machines, refrigerators, ovens and water heaters.",
    icon: WashingMachine,
  },
  {
    id: "masonry-tiling",
    name: "Masonry & Tiling",
    description: "Tiling, plastering, small renovations and roof leaks.",
    icon: BrickWall,
  },
];
