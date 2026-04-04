import { useState } from "react";
import type { CmsPage } from "@/lib/cmsTypes";
import PageList from "./PageList";
import PageEditor from "./PageEditor";

export default function SegmentsBuilder() {
  const [editing, setEditing] = useState<CmsPage | null | "new">(null);

  if (editing === "new") {
    return <PageEditor pageType="segment" onBack={() => setEditing(null)} onSaved={() => setEditing(null)} />;
  }
  if (editing) {
    return <PageEditor page={editing} pageType="segment" onBack={() => setEditing(null)} onSaved={() => setEditing(null)} />;
  }

  return (
    <PageList
      pageType="segment"
      onEdit={(page) => setEditing(page)}
      onNew={() => setEditing("new")}
    />
  );
}
