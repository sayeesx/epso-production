import React, { useEffect } from 'react';
import { TbX } from 'react-icons/tb';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: React.ReactNode;
  description?: string;
  children: React.ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl';
  size?: 'sm' | 'md' | 'lg' | 'xl';
  expanded?: boolean;
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  description,
  children,
  maxWidth,
  size,
  expanded = false,
}) => {
  const effectiveMaxWidth = maxWidth || size || 'md';
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const maxWidths = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 dark:bg-black/80 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Sheet / Dialog */}
      <div
        className={`relative w-full ${maxWidths[effectiveMaxWidth]} bg-white dark:bg-[#1E1B1B] text-charcoal dark:text-stone-100 border border-charcoal-border dark:border-[#2E2828] rounded-t-3xl sm:rounded-2xl ${
          expanded ? 'h-[96vh] sm:h-[92vh] max-h-[96vh]' : 'max-h-[92vh]'
        } flex flex-col z-10 overflow-hidden transform transition-all duration-300 animate-in slide-in-from-bottom sm:zoom-in-95 shadow-2xl`}
      >
        {/* Mobile handle indicator */}
        <div className="w-12 h-1 bg-stone-300 dark:bg-stone-700 rounded-full mx-auto mt-2.5 sm:hidden" />

        {/* Header */}
        <div className="flex items-start justify-between p-4 sm:p-5 border-b border-charcoal-border/70 dark:border-[#2E2828] shrink-0">
          <div>
            <h3 className="text-lg font-bold text-charcoal dark:text-white leading-snug">{title}</h3>
            {description && (
              <p className="text-xs text-charcoal-muted dark:text-stone-400 mt-0.5">{description}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-charcoal-muted dark:text-stone-400 hover:text-charcoal dark:hover:text-white hover:bg-stone-100 dark:hover:bg-[#282323] transition-colors"
          >
            <TbX className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className={`p-4 sm:p-6 overflow-y-auto space-y-4 ${expanded ? 'flex-1 max-h-[calc(96vh-85px)]' : 'max-h-[calc(92vh-130px)]'}`}>
          {children}
        </div>
      </div>
    </div>
  );
};
