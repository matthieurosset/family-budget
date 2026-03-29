import { motion } from "motion/react";
import {
  BarChart3,
  FileUp,
  Layers,
  List,
  PiggyBank,
  Settings,
} from "lucide-react";
import { NavLink, Outlet, useLocation } from "react-router-dom";

const navItems = [
  { to: "/dashboard", label: "Dashboard", icon: BarChart3 },
  { to: "/transactions", label: "Transactions", icon: List },
  { to: "/import", label: "Import", icon: FileUp },
  { to: "/categories", label: "Catégories", icon: Layers },
  { to: "/envelopes", label: "Enveloppes", icon: PiggyBank },
  { to: "/settings", label: "Paramètres", icon: Settings },
];

function NavItem({ to, label, icon: Icon }: (typeof navItems)[number]) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `group relative flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-[13px] font-medium tracking-wide transition-all duration-200 ${
          isActive
            ? "bg-sand-900 text-sand-50 shadow-lg shadow-sand-900/20"
            : "text-sand-600 hover:bg-sand-100 hover:text-sand-800"
        }`
      }
    >
      {({ isActive }) => (
        <>
          <Icon className="h-[18px] w-[18px]" strokeWidth={isActive ? 2.2 : 1.8} />
          <span>{label}</span>
        </>
      )}
    </NavLink>
  );
}

export function Layout() {
  const location = useLocation();

  return (
    <div className="min-h-screen bg-sand-50">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-50 hidden w-[240px] flex-col border-r border-sand-200/60 bg-gradient-to-b from-sand-50 to-sand-100/50 md:flex">
        {/* Logo */}
        <div className="flex items-center gap-3 px-6 pt-7 pb-8">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-forest-600 shadow-md shadow-forest-600/30">
            <PiggyBank className="h-5 w-5 text-white" strokeWidth={2} />
          </div>
          <div>
            <h1 className="font-display text-lg leading-tight text-sand-900">Family</h1>
            <p className="text-[11px] font-medium uppercase tracking-[0.15em] text-sand-400">Budget</p>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 space-y-1 px-4">
          {navItems.map((item) => (
            <NavItem key={item.to} {...item} />
          ))}
        </nav>

        {/* Footer */}
        <div className="border-t border-sand-200/60 px-6 py-4">
          <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-sand-300">Self-hosted</p>
        </div>
      </aside>

      {/* Mobile bottom nav */}
      <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-sand-200 bg-sand-50/95 backdrop-blur-lg md:hidden">
        <div className="flex">
          {navItems.slice(0, 5).map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[10px] font-medium tracking-wide transition-colors ${
                  isActive ? "text-forest-600" : "text-sand-400"
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <Icon className="h-5 w-5" strokeWidth={isActive ? 2.2 : 1.6} />
                  <span>{label}</span>
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>

      {/* Main content */}
      <main className="md:pl-[240px]">
        <motion.div
          key={location.pathname}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
          className="mx-auto max-w-5xl px-4 py-6 pb-24 md:px-8 md:py-8 md:pb-8"
        >
          <Outlet />
        </motion.div>
      </main>
    </div>
  );
}
