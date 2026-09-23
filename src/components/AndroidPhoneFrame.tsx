import React from 'react';
import { Wifi, Battery, Signal } from 'lucide-react';

interface Props {
  children: React.ReactNode;
  time?: string;
  isRecording?: boolean;
  isDarkMode?: boolean;
}

export const AndroidPhoneFrame: React.FC<Props> = ({
  children,
  time = '12:00',
  isRecording = false,
  isDarkMode = true,
}) => {
  return (
    <div className={`phone-frame relative mx-auto w-full max-w-[390px] aspect-[9/19.5] min-h-[740px] max-h-[820px] rounded-[48px] p-3 shadow-2xl shadow-black/80 ring-1 flex flex-col select-none overflow-hidden ${isDarkMode ? 'bg-slate-950 ring-slate-800' : 'bg-white ring-slate-300'}`}>
      {/* Device Outer Edge Highlights */}
      <div className={`absolute inset-0 rounded-[48px] border-[3px] pointer-events-none ${isDarkMode ? 'border-slate-700/50' : 'border-slate-300/70'}`} />

      {/* Screen Area */}
      <div className={`relative flex-1 rounded-[38px] overflow-hidden flex flex-col border ${isDarkMode ? 'bg-slate-950 border-slate-900' : 'bg-slate-50 border-slate-200'}`}>
        {/* Status Bar */}
        <div className={`h-9 px-6 pt-2 backdrop-blur flex items-center justify-between z-30 shrink-0 ${isDarkMode ? 'bg-slate-900/90 text-slate-300' : 'bg-white/90 text-slate-600'}`}>
          <div className="flex items-center gap-1.5 text-xs font-semibold tracking-tight">
            <span>{time}</span>
            {isRecording && (
              <span className="flex items-center gap-1 ml-1 px-1.5 py-0.5 rounded-full bg-red-500/20 text-red-400 text-[10px] font-bold">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                REC
              </span>
            )}
          </div>

          {/* Camera Notch / Punch-hole */}
          <div className={`w-3.5 h-3.5 rounded-full border shadow-inner ${isDarkMode ? 'bg-black border-slate-800/80' : 'bg-slate-900 border-slate-300'}`} />

          {/* Status Icons */}
          <div className={`flex items-center gap-1.5 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
            <Signal className="w-3 h-3" />
            <Wifi className="w-3 h-3" />
            <Battery className={`w-3.5 h-3.5 ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`} />
          </div>
        </div>

        {/* App Content */}
        <div className="flex-1 relative overflow-y-auto flex flex-col bg-[#0B0F19]">
          {children}
        </div>

        {/* Android Gesture Bar */}
        <div className={`h-4 flex items-center justify-center shrink-0 ${isDarkMode ? 'bg-slate-950/80' : 'bg-white/80'}`}>
          <div className={`w-28 h-1 rounded-full ${isDarkMode ? 'bg-slate-600/60' : 'bg-slate-400/70'}`} />
        </div>
      </div>
    </div>
  );
};
