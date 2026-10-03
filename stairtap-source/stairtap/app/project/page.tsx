import { Suspense } from "react";
import { Workspace } from "./Workspace";

export default function ProjectPage() {
  return (
    <Suspense fallback={null}>
      <Workspace />
    </Suspense>
  );
}
