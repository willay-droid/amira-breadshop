import Link from "next/link";
import { useRouter } from "next/router";
import { useContext, useState, useEffect } from "react";
import { AuthContext } from "../context/AuthContext";

export default function Sidebar() {
  const router = useRouter();
  const { user } = useContext(AuthContext);
  const [isOpen, setIsOpen] = useState(false);

  // Tutup sidebar otomatis setiap kali pindah halaman di mode mobile
  useEffect(() => {
    setIsOpen(false);
  }, [router.pathname]);

  if (router.pathname === "/login" || user?.role !== "admin") return null;

  const menus = [
    { name: "POS Kasir", path: "/", icon: "🛒" },
    { name: "Dashboard", path: "/dashboard", icon: "📊" },
    { name: "Master Bahan", path: "/bahan", icon: "📦" },
    { name: "Kelola Produk", path: "/produk", icon: "🍞" },
    { name: "Buku Besar", path: "/laporan", icon: "📓" },
  ];

  return (
    <>
      {/* Tombol Hamburger HANYA muncul di Mobile (< 1024px) */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="lg:hidden fixed top-3 left-4 z-50 p-2 bg-white dark:bg-zinc-800 rounded-lg border border-gray-200 dark:border-zinc-700 text-gray-800 dark:text-white hover:bg-gray-50 dark:hover:bg-zinc-700 transition-colors shadow-sm"
          title="Buka Menu"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2.5}
            stroke="currentColor"
            className="w-6 h-6"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5"
            />
          </svg>
        </button>
      )}

      {/* Overlay Hitam HANYA di Mobile saat Sidebar terbuka */}
      {isOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/40 backdrop-blur-sm z-40 transition-opacity"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Panel Sidebar: Permanen di Desktop, Melayang di Mobile */}
      <aside
        className={`fixed lg:static top-0 left-0 h-screen bg-white dark:bg-zinc-800 border-r border-gray-200 dark:border-zinc-700 flex flex-col transition-transform duration-300 z-50 w-64 shadow-2xl lg:shadow-none shrink-0 ${
          isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
      >
        <div>
          {/* Header Sidebar & Tombol X (Tombol X hanya di mobile) */}
          <div className="h-16 flex items-center justify-between px-6 border-b border-gray-200 dark:border-zinc-700">
            <div className="flex items-center">
              <span className="text-2xl">🥐</span>
              <h1 className="ml-3 font-bold text-amber-900 dark:text-amber-400">
                Panel Admin
              </h1>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="lg:hidden p-1 text-gray-400 hover:text-gray-800 dark:hover:text-white transition-colors"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2.5}
                stroke="currentColor"
                className="w-6 h-6"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          {/* Menu Navigasi */}
          <nav className="mt-6 flex flex-col gap-2 px-4">
            {menus.map((menu, index) => {
              const isActive = router.pathname === menu.path;
              return (
                <Link
                  key={index}
                  href={menu.path}
                  className={`flex items-center p-3 rounded-xl transition-all ${
                    isActive
                      ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400 shadow-sm"
                      : "text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-zinc-700/50"
                  }`}
                >
                  <span className="text-xl">{menu.icon}</span>
                  <span className="ml-3 font-medium">{menu.name}</span>
                </Link>
              );
            })}
          </nav>
        </div>
      </aside>
    </>
  );
}
