import React, { useState, useRef, useEffect } from 'react';
import { useTheme } from '../../context/ThemeContext';
import { supabase } from '../../services/supabaseClient';
import { FiSun, FiMoon, FiAlertCircle, FiLock } from 'react-icons/fi';

interface ProductionPinGateProps {
  onUnlock: () => void;
}

export const ProductionPinGate: React.FC<ProductionPinGateProps> = ({ onUnlock }) => {
  const { theme, toggleTheme } = useTheme();

  const [digits, setDigits] = useState<string[]>(['', '', '', '']);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [shake, setShake] = useState<boolean>(false);
  const [isVerifying, setIsVerifying] = useState<boolean>(false);
  const [targetPin, setTargetPin] = useState<string>(() => {
    return localStorage.getItem('epso_production_pin') || '1234';
  });

  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    inputRefs.current[0]?.focus();

    // Fetch latest production pin from Supabase audit_logs
    if (supabase) {
      (async () => {
        try {
          const { data } = await supabase
            .from('audit_logs')
            .select('details')
            .eq('action', 'PRODUCTION_PIN_CHANGED')
            .order('created_at', { ascending: false })
            .limit(1);

          if (data && data.length > 0 && data[0].details?.pin) {
            const fetched = String(data[0].details.pin);
            setTargetPin(fetched);
            localStorage.setItem('epso_production_pin', fetched);
          }
        } catch {
          // fallback to cached pin
        }
      })();
    }
  }, []);

  const handleDigitChange = async (index: number, val: string) => {
    const char = val.replace(/\D/g, '').slice(-1);
    const newDigits = [...digits];
    newDigits[index] = char;
    setDigits(newDigits);
    setErrorMsg('');

    if (char && index < 3) {
      inputRefs.current[index + 1]?.focus();
    }

    if (char && index === 3 && newDigits.every((d) => d !== '')) {
      const fullPin = newDigits.join('');
      await submitPin(fullPin);
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      if (!digits[index] && index > 0) {
        const newDigits = [...digits];
        newDigits[index - 1] = '';
        setDigits(newDigits);
        inputRefs.current[index - 1]?.focus();
      }
    }
  };

  const handlePaste = async (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 4);
    if (!pasted) return;

    const newDigits = ['', '', '', ''];
    for (let i = 0; i < pasted.length; i++) {
      newDigits[i] = pasted[i];
    }
    setDigits(newDigits);

    if (pasted.length === 4) {
      await submitPin(pasted);
    } else {
      inputRefs.current[pasted.length]?.focus();
    }
  };

  const submitPin = async (enteredPin: string) => {
    setIsVerifying(true);
    setErrorMsg('');

    // Quick verification feel (250ms)
    await new Promise((resolve) => setTimeout(resolve, 200));

    // Also re-check latest cached pin
    const currentValidPin = localStorage.getItem('epso_production_pin') || targetPin;

    if (enteredPin === currentValidPin) {
      sessionStorage.setItem('epso_production_unlocked', 'true');
      setIsVerifying(false);
      onUnlock();
    } else {
      setIsVerifying(false);
      setErrorMsg('തെറ്റായ പാസ്‌കോഡ് (Incorrect PIN)');
      setShake(true);
      setTimeout(() => setShake(false), 500);
      setDigits(['', '', '', '']);
      inputRefs.current[0]?.focus();
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-between items-center bg-[#F8F9FA] dark:bg-[#141212] p-4 text-[#141212] dark:text-white transition-colors duration-200 select-none">
      {/* Top Bar with Brand and Theme Toggle */}
      <div className="w-full max-w-sm flex justify-between items-center py-2">
        <div className="flex items-center gap-2">
          <img
            src="/favicon.png"
            alt="Epso Logo"
            className="w-7 h-7 object-contain drop-shadow"
            onError={(e) => {
              (e.target as HTMLElement).style.display = 'none';
            }}
          />
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-black tracking-wider uppercase text-epso-red dark:text-amber-400">
              Epso Production
            </span>
          </div>
        </div>
        <button
          onClick={toggleTheme}
          type="button"
          aria-label="Toggle theme"
          className="p-2 rounded-xl bg-white dark:bg-[#1E1B1B] border border-stone-200 dark:border-[#2E2828] text-stone-600 dark:text-stone-300 press-apple cursor-pointer shadow-xs"
        >
          {theme === 'dark' ? <FiSun className="w-4 h-4 text-amber-400" /> : <FiMoon className="w-4 h-4 text-stone-700" />}
        </button>
      </div>

      {/* Main PIN Prompt Box */}
      <div className={`w-full max-w-sm flex flex-col items-center my-auto transition-transform ${shake ? 'animate-bounce' : ''}`}>
        <div className="w-14 h-14 rounded-2xl bg-red-50 dark:bg-amber-950/30 text-epso-red dark:text-amber-400 flex items-center justify-center mb-4 shadow-xs ring-1 ring-epso-red/20 dark:ring-amber-500/20">
          <FiLock className="w-6 h-6" />
        </div>

        <h1 className="text-base font-extrabold text-stone-900 dark:text-white font-malayalam text-center leading-snug">
          പ്രൊഡക്ഷൻ 4 അക്ക പിൻ നൽകുക
        </h1>
        <p className="text-xs font-medium text-stone-400 dark:text-stone-500 font-sans mt-0.5 mb-6 text-center">
          Enter 4-digit Production PIN
        </p>

        {/* 4 Individual OTP Boxes */}
        <div className="flex justify-center gap-3 w-full my-2">
          {digits.map((digit, idx) => (
            <input
              key={idx}
              ref={(el) => { inputRefs.current[idx] = el; }}
              type="password"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={1}
              value={digit}
              autoComplete="one-time-code"
              onChange={(e) => handleDigitChange(idx, e.target.value)}
              onKeyDown={(e) => handleKeyDown(idx, e)}
              onFocus={(e) => e.target.select()}
              onPaste={handlePaste}
              className={`w-14 h-16 sm:w-16 sm:h-18 text-center text-3xl font-black rounded-2xl border transition-all duration-150 outline-none
                ${digit
                  ? 'border-epso-red dark:border-amber-500 bg-red-50/40 dark:bg-amber-950/20 text-stone-900 dark:text-white ring-2 ring-epso-red/30 dark:ring-amber-500/30'
                  : 'border-stone-300 dark:border-[#2E2828] bg-white dark:bg-[#1E1B1B] text-stone-900 dark:text-white hover:border-stone-400 focus:border-epso-red dark:focus:border-amber-500 focus:ring-2 focus:ring-epso-red/30'
                }`}
            />
          ))}
        </div>

        {/* Loading Spinner */}
        {isVerifying && (
          <div className="flex items-center gap-2 mt-4 text-xs font-medium text-stone-500 dark:text-stone-400">
            <div className="w-4 h-4 border-2 border-epso-red border-t-transparent rounded-full animate-spin" />
            <span className="font-malayalam">പരിശോധിക്കുന്നു... (Verifying)</span>
          </div>
        )}

        {/* Error message */}
        {errorMsg && (
          <div className="flex items-center gap-1.5 mt-4 text-xs font-semibold text-red-600 dark:text-red-400 animate-in fade-in duration-200">
            <FiAlertCircle className="w-4 h-4 shrink-0" />
            <span className="font-malayalam">{errorMsg}</span>
          </div>
        )}

        {/* Hint footer */}
        <p className="text-[11px] text-stone-400 dark:text-stone-500 mt-8 text-center font-malayalam">
          അഡ്മിൻ കൺസോളിൽ നിന്നും പിൻ മാറ്റാവുന്നതാണ്.
          <span className="block text-[10px] text-stone-400/80 font-sans mt-0.5">
            Default PIN: 1234
          </span>
        </p>
      </div>

      {/* Subtle Bottom Brand */}
      <div className="w-full text-center py-2 text-[10px] text-stone-400 dark:text-stone-600 font-semibold tracking-wider uppercase">
        Epso Pantry & Production Management
      </div>
    </div>
  );
};
