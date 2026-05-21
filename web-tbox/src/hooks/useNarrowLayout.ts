import { useEffect, useState } from "react";

/** 与 `TBOX_UI_DESIGN_DETAIL.md` §1.3 一致：&lt;768px 为窄屏 */
const NARROW_MQ = "(max-width: 767px)";

export function useNarrowLayout(): boolean {
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(NARROW_MQ);
    const apply = () => setNarrow(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);
  return narrow;
}
