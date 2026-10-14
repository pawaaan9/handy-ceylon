import cleanerUpholstery from "./cleaner-upholstery.jpg";
import electricalPanel from "./electrical-panel.jpg";
import electricianAtWork from "./electrician-at-work.jpg";
import plumberBathroom from "./plumber-bathroom.jpg";
import plumberUnderSink from "./plumber-under-sink.jpg";
import technicianPortrait from "./technician-portrait.jpg";
import technicianToolBelt from "./technician-tool-belt.jpg";

/**
 * Photography from Unsplash (Unsplash License — free for commercial use).
 * Credits: Emmanuel Ikwuegbu (technician portrait, electrician at work),
 * Timur Shakerzianov (plumber under sink), Giorgio Trovato (cleaner),
 * Kevin Grieve (tool belt), bhagya laxmi (plumber in bathroom),
 * Toolmash Expo (electrical panel).
 */
export const photos = {
  technicianPortrait: { src: technicianPortrait, alt: "Technician in a hard hat standing confidently beside a wall panel" },
  electricianAtWork: { src: electricianAtWork, alt: "Electrician installing wiring on a wall" },
  plumberUnderSink: { src: plumberUnderSink, alt: "Plumber tightening a pipe under a sink" },
  cleanerUpholstery: { src: cleanerUpholstery, alt: "Cleaner vacuuming an upholstered ottoman" },
  technicianToolBelt: { src: technicianToolBelt, alt: "Technician wearing a tool belt and carrying a ladder" },
  plumberBathroom: { src: plumberBathroom, alt: "Plumber working in a bathroom" },
  electricalPanel: { src: electricalPanel, alt: "Electrician testing an electrical panel with a multimeter" },
} as const;

export type PhotoKey = keyof typeof photos;
