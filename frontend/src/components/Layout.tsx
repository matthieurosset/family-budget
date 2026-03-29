import {
  BarChart3,
  FileUp,
  Layers,
  List,
  PiggyBank,
  Settings,
} from "lucide-react";
import { NavLink, Outlet } from "react-router-dom";

const navItems = [
  { to: "/dashboard", label: "Dashboard", icon: BarChart3 },
  { to: "/transactions", label: "Transactions", icon: List },
  { to: "/import", label: "Import", icon: FileUp },
  { to: "/categories", label: "Categories", icon: Layers },
  { to: "/envelopes", label: "Enveloppes", icon: PiggyBank },
  { to: "/settings", label: "Parametres", icon: Settings },
];

export function Layout() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-50 hidden w-56 border-r border-gray-200 bg-white md:block">
        <div className="flex h-14 items-center gap-2 border-b border-gray-200 px-4">
          <PiggyBank className="h-6 w-6 text-emerald-600" />
          <span className="font-semibold text-gray-900">Family Budget</span>
        </div>
        <nav className="mt-2 space-y-0.5 px-2">
          {navItems.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                  isActive
                    ? "bg-emerald-50 text-emerald-700 font-medium"
                    : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                }`
              }
            >
              <Icon className="h-4 w-4" />
              {label}
            </NavLink>
          ))}
        </nav>
      </aside>

      {/* Mobile bottom nav */}
      <nav className="fixed inset-x-0 bottom-0 z-50 flex border-t border-gray-200 bg-white md:hidden">
        {navItems.slice(0, 4).map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex flex-1 flex-col items-center gap-1 py-2 text-xs transition-colors ${
                isActive
                  ? "text-emerald-700 font-medium"
                  : "text-gray-500"
              }`
            }
          >
            <Icon className="h-5 w-5" />
            {label}
          </NavLink>
        ))}
      </nav>

      {/* Main content */}
      <main className="md:pl-56">
        <div className="mx-auto max-w-6xl p-4 pb-20 md:p-6 md:pb-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
