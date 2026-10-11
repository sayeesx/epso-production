import React from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { Home, Package, Plus, UtensilsCrossed, Settings } from 'lucide-react';
import { useApp } from '../../context/AppContext';

export const BottomNav: React.FC = () => {
  const { setIsStartProductionOpen } = useApp();
  const navigate = useNavigate();
  const location = useLocation();
  const [isOpeningProduction, setIsOpeningProduction] = React.useState(false);

  const handleCenterAction = () => {
    setIsOpeningProduction(true);
    if (location.pathname !== '/') {
      navigate('/');
    }
    setTimeout(() => {
      setIsStartProductionOpen(true);
      setIsOpeningProduction(false);
    }, 120);
  };

  const navLeft = [
    { to: '/', label: 'Production', icon: Home, end: true },
    { to: '/products', label: 'Products', icon: Package, end: false },
  ];

  const navRight = [
    { to: '/ingredients', label: 'Ingredients', icon: UtensilsCrossed, end: false },
    { to: '/settings', label: 'Settings', icon: Settings, end: false },
  ];

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-[#141212]/95 backdrop-blur-lg border-t border-charcoal-border/80 dark:border-charcoal-border-dark pb-safe shadow-[0_-4px_20px_rgba(0,0,0,0.06)] dark:shadow-[0_-4px_20px_rgba(0,0,0,0.3)] transition-colors duration-200">
      <div className="flex items-center justify-around h-16 max-w-lg mx-auto px-2 relative">
        {/* Left Navigation Items */}
        {navLeft.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `flex-1 flex flex-col items-center justify-center py-1 select-none transition-all press-apple ${
                  isActive
                    ? 'text-epso-red dark:text-amber-400 font-bold'
                    : 'text-stone-500 dark:text-stone-400 hover:text-stone-800 dark:hover:text-stone-200 font-medium'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <div
                    className={`p-1 rounded-xl transition-all duration-200 ${
                      isActive
                        ? 'bg-red-50 dark:bg-[#1E1B1B] text-epso-red dark:text-amber-400 scale-105'
                        : ''
                    }`}
                  >
                    <Icon className="w-5 h-5 stroke-[2.2]" />
                  </div>
                  <span className="text-[10px] tracking-tight mt-0.5 line-clamp-1">{item.label}</span>
                </>
              )}
            </NavLink>
          );
        })}

        {/* Center Elevated Floating Add Production Button - Reference Inspired */}
        <div className="flex-1 flex items-center justify-center relative -mt-6 pointer-events-none">
          <button
            type="button"
            onClick={handleCenterAction}
            className="pointer-events-auto w-14 h-14 rounded-full bg-gradient-to-tr from-epso-red via-[#D83D30] to-epso-amber text-white shadow-xl flex items-center justify-center border-4 border-white dark:border-[#141212] transition-transform duration-200 active:scale-90 hover:scale-105 press-apple cursor-pointer group"
            title="Start New Production"
            aria-label="Start New Production"
          >
            {isOpeningProduction ? (
              <svg
                className="animate-spin h-6 w-6 text-white"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            ) : (
              <Plus className="w-7 h-7 stroke-[3] transition-transform duration-200 group-hover:rotate-90" />
            )}
          </button>
        </div>

        {/* Right Navigation Items */}
        {navRight.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `flex-1 flex flex-col items-center justify-center py-1 select-none transition-all press-apple ${
                  isActive
                    ? 'text-epso-red dark:text-amber-400 font-bold'
                    : 'text-stone-500 dark:text-stone-400 hover:text-stone-800 dark:hover:text-stone-200 font-medium'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <div
                    className={`p-1 rounded-xl transition-all duration-200 ${
                      isActive
                        ? 'bg-red-50 dark:bg-[#1E1B1B] text-epso-red dark:text-amber-400 scale-105'
                        : ''
                    }`}
                  >
                    <Icon className="w-5 h-5 stroke-[2.2]" />
                  </div>
                  <span className="text-[10px] tracking-tight mt-0.5 line-clamp-1">{item.label}</span>
                </>
              )}
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
};
