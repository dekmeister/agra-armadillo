// Bezel panel shell: stenciled header (split title coloring) + body + corner rivets.
import type { ReactNode } from "react";

export function Panel({
  title,
  titleAccent,
  meta,
  children,
  className,
  collapsed,
  onToggleCollapse,
}: {
  /** Rendered dim/olive. */
  title: string;
  /** Optional bright second word (e.g. BRAIN **EDITOR**). */
  titleAccent?: string;
  meta?: string;
  children: ReactNode;
  className?: string;
  /** When set, the panel body is hidden and only the header bar shows. */
  collapsed?: boolean;
  /** When provided, a caret button in the header toggles collapse. */
  onToggleCollapse?: () => void;
}) {
  return (
    <div className={`panel${className ? ` ${className}` : ""}`}>
      <div className="ph">
        <span className="t">
          {title}
          {titleAccent ? <b> {titleAccent}</b> : null}
        </span>
        {meta ? <span className="meta">{meta}</span> : null}
        {onToggleCollapse ? (
          <button
            type="button"
            className={`ph-collapse${meta ? "" : " push"}`}
            onClick={onToggleCollapse}
            title={collapsed ? "Expand" : "Collapse"}
            aria-label={collapsed ? "Expand" : "Collapse"}
          >
            {collapsed ? "▸" : "▾"}
          </button>
        ) : null}
      </div>
      {collapsed ? null : (
        <div className="body">
          <span className="rivet tl" />
          <span className="rivet tr" />
          <span className="rivet bl" />
          <span className="rivet br" />
          {children}
        </div>
      )}
    </div>
  );
}
