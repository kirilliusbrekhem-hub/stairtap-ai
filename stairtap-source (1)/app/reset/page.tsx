import { Suspense } from "react";
import { ResetView } from "./ResetView";

export default function ResetPage() {
  return (
    <Suspense fallback={null}>
      <ResetView />
    </Suspense>
  );
}
