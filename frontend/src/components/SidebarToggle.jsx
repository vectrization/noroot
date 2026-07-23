import { useState, useEffect } from "react";

export default function SidebarToggle() {
  const [isCollapsed, setIsCollapsed] = useState(false);

   useEffect(() => {
    const mediaQuery = window.matchMedia("(min-width: 768px)");
    const handleChange = (e) => {
      setIsCollapsed(!e.matches);
    };
    handleChange(mediaQuery);
    mediaQuery.addEventListener("change", handleChange);

    return () => {
      mediaQuery.removeEventListener("change", handleChange);
    };
  }, []);

  useEffect(() => {
    const sidebar = document.getElementById("sidebar");
    if (!sidebar) return;

    if (isCollapsed) {
      sidebar.classList.add("-translate-y-full");

      sidebar.classList.add("md:w-xs");
      sidebar.classList.add("md:-translate-x-64");
    } else {
      sidebar.classList.remove("-translate-y-full");

      sidebar.classList.remove("md:w-xs");
      sidebar.classList.remove("md:-translate-x-64");
    }
  }, [isCollapsed]);

  return (
    <button
        className={`fixed md:absolute top-4 right-8 md:right-auto md:left-[18rem] transition-all duration-500
            ${isCollapsed ? "md:left-1 rotate-180" : "md:left-[18rem]]"}
            p-2 text-zinc-400 hover:text-white material-icons z-50`}
        aria-label=""
        onClick={() => setIsCollapsed(!isCollapsed)}
    >
      {isCollapsed ? "menu" : "close"}
    </button>
  );
}
