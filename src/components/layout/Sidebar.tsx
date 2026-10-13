import React from 'react';
import { NavLink } from 'react-router-dom';
import { Home, Package, UtensilsCrossed, Settings, UserCheck } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useTheme } from '../../context/ThemeContext';

export const Sidebar: React.FC = () => {
  const { staffName } = useApp();
  const { isDark } = useTheme();

  const navItems = [
    { to: '/', label: 'Production', icon: Home, end: true },
    { to: '/products', label: 'Products', icon: Package, end: false },
    { to: '/ingredients', label: 'Ingredients', icon: UtensilsCrossed, end: false },
    { to: '/settings', label: 'Settings', icon: Settings, end: false },
  ];

  return (
    <aside className="hidden md:flex flex-col w-60 border-r border-charcoal-border/70 dark:border-charcoal-border-dark bg-white dark:bg-[#141212] min-h-screen p-4 shrink-0 shadow-sm transition-colors duration-200">
      <div className="space-y-6 flex-1">
        <div className="px-3 py-1">
          <img
            src={isDark ? '/epso-logo-dark.png' : '/epso-logo-light.png'}
            alt="Epso Logo"
            className="h-8 w-auto object-contain select-none"
          />
        </div>
        <div>
          <div className="px-3 mb-2.5 text-[11px] font-bold tracking-wider text-stone-400 dark:text-stone-500 uppercase">
            Menu
          </div>
          <div className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-bold transition-all press-apple ${
                      isActive
                        ? 'bg-epso-red text-white shadow-sm'
                        : 'text-stone-700 dark:text-stone-300 hover:bg-red-50 hover:text-epso-red dark:hover:bg-[#1E1B1B] dark:hover:text-amber-400'
                    }`
                  }
                >
                  <Icon className="w-4 h-4 stroke-[2.2]" />
                  <span>{item.label}</span>
                </NavLink>
              );
            })}
          </div>
        </div>
      </div>

      {/* Operator identity footer */}
      <div className="mt-auto pt-4 border-t border-charcoal-border/70 dark:border-charcoal-border-dark">
        <div className="bg-stone-50 dark:bg-[#1E1B1B] p-3 rounded-xl border border-stone-200 dark:border-[#2E2828] transition-colors">
          <div className="flex items-center gap-2 text-stone-600 dark:text-stone-400">
            <UserCheck className="w-4 h-4 text-epso-red dark:text-amber-400" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-stone-500 dark:text-stone-400">
              Operator
            </span>
          </div>
          <p className="text-xs font-bold text-stone-900 dark:text-white mt-1 line-clamp-1">{staffName}</p>
        </div>
      </div>
    </aside>
  );
};
