import { useLocation } from "react-router-dom";
import { Construction } from "lucide-react";

export default function QAPlaceholderPage() {
  const { pathname } = useLocation();
  const name = pathname.split("/").pop()?.replace(/-/g, " ") ?? "";

  return (
    <div className="flex flex-col items-center justify-center py-20 text-slate-500">
      <Construction className="h-12 w-12 mb-4 opacity-30" />
      <h2 className="text-lg font-medium text-slate-300 capitalize">{name}</h2>
      <p className="text-sm mt-1">Em desenvolvimento — próxima fase</p>
    </div>
  );
}
