import { useDispatch, useSelector } from "react-redux";
import { setSidebarOpen } from "../../store/uiSlice";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { RootState } from "@/store/store";

export default function SidebarChevron() {
  const { sidebarOpen } = useSelector((state: RootState) => state.ui);
  const dispatch = useDispatch();
  return (
    <div className="absolute top-1/2 -right-3 z-50">
    <button
        onClick={() => dispatch(setSidebarOpen(!sidebarOpen))}
        className="rounded-full border border-slate-200 bg-white p-1 text-slate-400 shadow-lg hover:text-slate-900 dark:border-[#12121a] dark:bg-[#2a2a3e] dark:hover:text-white"
        type="button"
        aria-label={sidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
    >
        {sidebarOpen ? <ChevronLeft size={12} /> : <ChevronRight size={16} />}
    </button>
    </div>
  );
}