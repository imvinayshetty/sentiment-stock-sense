import { useState, type ReactNode } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";

interface CollapsibleSectionProps {
  title: string;
  icon?: ReactNode;
  /** Right-aligned summary shown next to the title (visible even when collapsed). */
  hint?: ReactNode;
  defaultOpen?: boolean;
  children: ReactNode;
}

/**
 * Collapsible section shell: a full-width header button plus the child content.
 * Children stay mounted while collapsed (hidden via CSS) so expanding never
 * re-triggers expensive data fetches. Starts collapsed unless defaultOpen is set.
 */
const CollapsibleSection = ({ title, icon, hint, defaultOpen = false, children }: CollapsibleSectionProps) => {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className={`flex w-full items-center gap-2 rounded-xl border border-border bg-card px-5 py-4 text-left card-glow transition-colors hover:border-primary/40 ${
          open ? "rounded-b-none border-b-0" : ""
        }`}
      >
        {icon}
        <span className="text-lg font-semibold text-foreground">{title}</span>
        {hint != null && <span className="ml-auto hidden text-xs text-muted-foreground sm:block">{hint}</span>}
        <span className={`ml-auto ${hint != null ? "sm:ml-2" : ""} text-muted-foreground`}>
          {open ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
        </span>
      </button>
      <div className={open ? "animate-fade-in-up" : "hidden"}>{children}</div>
    </div>
  );
};

export default CollapsibleSection;
