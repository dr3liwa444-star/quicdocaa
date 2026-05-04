
import React from 'react';

interface LoadingOverlayProps {
  active: boolean;
  message?: string;
}

const LoadingOverlay: React.FC<LoadingOverlayProps> = ({ active, message }) => {
  if (!active) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-slate-900/80 backdrop-blur-md flex flex-col items-center justify-center text-white p-6">
      <div className="relative mb-8 text-blue-400">
        <div className="w-24 h-24 rounded-full border-4 border-white/10 border-t-blue-500 animate-spin"></div>
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="relative">
             <i className="fa-solid fa-bolt text-3xl animate-pulse"></i>
             <span className="absolute -top-4 -right-4 bg-blue-600 text-[8px] font-bold px-1.5 py-0.5 rounded-full border border-blue-400">3 FLASH</span>
          </div>
        </div>
      </div>
      
      <div className="text-center max-w-sm">
        <h2 className="text-xl font-bold mb-2 tracking-tight">Fast Shorthand Extraction...</h2>
        <p className="text-slate-400 text-sm mb-8 leading-relaxed">
          {message || "Gemini 3 Flash is mapping every detail into high-density shorthand. No information will be omitted."}
        </p>
        
        <div className="space-y-4 w-full px-4">
          <div className="space-y-1.5">
            <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest text-blue-400">
              <span>Logical Mapping</span>
              <span>Ultra-Fast</span>
            </div>
            <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
              <div className="h-full bg-blue-500 animate-progress origin-left w-full"></div>
            </div>
          </div>
          
          <div className="space-y-1.5">
            <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest text-blue-400">
              <span>Lossless Encoding</span>
              <span className="animate-pulse">Active</span>
            </div>
            <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
              <div className="h-full bg-blue-500 animate-[progress_4s_ease-in-out_infinite] origin-left"></div>
            </div>
          </div>
        </div>
      </div>
      
      <style>{`
        @keyframes progress {
          0% { transform: scaleX(0); }
          100% { transform: scaleX(1); }
        }
      `}</style>
    </div>
  );
};

export default LoadingOverlay;
