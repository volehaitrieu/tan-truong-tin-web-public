import { Cable, Drill, Fan, Hammer, House, Lightbulb, Plug, Wrench } from "lucide-react";
import type { Category } from "@/lib/mock/store";

const ICONS = { wrench: Wrench, plug: Plug, cable: Cable, bulb: Lightbulb, fan: Fan, drill: Drill, bolt: Hammer, home: House };

export function CategoryIcon({ icon, className = "size-5" }: { icon: Category["icon"]; className?: string }) {
  const Icon = ICONS[icon];
  return <Icon className={className} aria-hidden />;
}
