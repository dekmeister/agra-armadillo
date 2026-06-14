// Bezel panel shell: stenciled header (split title coloring) + body + corner rivets.
import type { ReactNode } from "react";

export function Panel({
  title,
  titleAccent,
  meta,
  children,
  className,
}: {
  /** Rendered dim/olive. */
  title: string;
  /** Optional bright second word (e.g. BRAIN **EDITOR**). */
  titleAccent?: string;
  meta?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`panel${className ? ` ${className}` : ""}`}>
      <div className="ph">
        <span className="t">
          {title}
          {titleAccent ? <b> {titleAccent}</b> : null}
        </span>
        {meta ? <span className="meta">{meta}</span> : null}
      </div>
      <div className="body">
        <span className="rivet tl" />
        <span className="rivet tr" />
        <span className="rivet bl" />
        <span className="rivet br" />
        {children}
      </div>
    </div>
  );
}
