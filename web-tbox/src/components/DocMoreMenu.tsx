import { useEffect, useId, useRef, useState, type ReactNode } from "react";

type DocMoreMenuProps = {
  disabled?: boolean;
  children: ReactNode;
};

/** Compact ⋯ menu for secondary document row actions. */
export function DocMoreMenu({ disabled, children }: DocMoreMenuProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) {
      return;
    }
    function onPointerDown(ev: MouseEvent) {
      const el = rootRef.current;
      if (el && !el.contains(ev.target as Node)) {
        setOpen(false);
      }
    }
    function onKey(ev: KeyboardEvent) {
      if (ev.key === "Escape") {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  useEffect(() => {
    if (disabled) {
      setOpen(false);
    }
  }, [disabled]);

  return (
    <div className="docs-more" ref={rootRef}>
      <button
        type="button"
        className="docs-btn-pill docs-btn-pill--ghost"
        aria-expanded={open}
        aria-haspopup="menu"
        aria-controls={menuId}
        disabled={disabled}
        title="更多操作"
        onClick={() => setOpen((v) => !v)}
      >
        ⋯
      </button>
      {open ? (
        <div className="docs-more-menu" id={menuId} role="menu" onClick={() => setOpen(false)}>
          {children}
        </div>
      ) : null}
    </div>
  );
}
