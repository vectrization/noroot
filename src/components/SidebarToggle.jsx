import { useState, useEffect } from "react";

export default function SidebarToggle() {
  const [isCollapsed, setIsCollapsed] = useState(false);

  useEffect(() => {
    const sidebar = document.getElementById("sidebar");
    if (!sidebar) return;

    if (isCollapsed) {
      sidebar.classList.add("w-xs");
      sidebar.classList.add("-translate-x-64")
    } else {
      sidebar.classList.remove("w-xs");
      sidebar.classList.remove("-translate-x-64")
    }
  }, [isCollapsed]);

  return (
    <button
        className={`absolute top-6 transition-all duration-500
            ${isCollapsed ? "left-4 rotate-180" : "left-[18rem] -translate-x-1/2"}
            p-2 text-zinc-400 hover:text-white material-icons`}
        aria-label=""
        onClick={() => setIsCollapsed(!isCollapsed)}
    >
      arrow_back
    </button>
  );
}