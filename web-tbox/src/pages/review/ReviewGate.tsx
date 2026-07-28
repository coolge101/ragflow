import type { ReactNode } from "react";
import { reviewPagesEnabled } from "../../review/reviewGate";
import { ReviewDisabledPage } from "./ReviewDisabledPage";

export function ReviewGate({ children }: { children: ReactNode }) {
  if (!reviewPagesEnabled()) {
    return <ReviewDisabledPage />;
  }
  return <>{children}</>;
}
