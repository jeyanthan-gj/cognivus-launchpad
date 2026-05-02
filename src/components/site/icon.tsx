import {
  Workflow,
  BookOpen,
  MessageSquare,
  Cog,
  Sparkles,
  Bot,
  Brain,
  Zap,
  Database,
  type LucideIcon,
} from "lucide-react";

const map: Record<string, LucideIcon> = {
  Workflow,
  BookOpen,
  MessageSquare,
  Cog,
  Sparkles,
  Bot,
  Brain,
  Zap,
  Database,
};

export function ServiceIcon({ name, className }: { name: string; className?: string }) {
  const Icon = map[name] ?? Sparkles;
  return <Icon className={className} />;
}

export const ICON_OPTIONS = Object.keys(map);
