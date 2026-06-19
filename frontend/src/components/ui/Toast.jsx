import { useEffect, useState } from 'react';

const Toast = ({ message, type = 'success', duration = 10000, onClose, isStacked = false }) => {
  const [progress, setProgress] = useState(100);

  const isError = type === 'error';
  const iconName = isError ? 'error' : 'check_circle';
  const iconBgClass = isError ? 'bg-[#FF6B6B]/20' : 'bg-[#6C63FF]/20';
  const iconColorClass = isError ? 'text-[#FF6B6B]' : 'text-[#6C63FF]';
  const progressGradient = isError ? 'from-[#FF6B6B] to-[#FF8787]' : 'from-[#6C63FF] to-[#00D4AA]';

  useEffect(() => {
    let startTime = Date.now();
    
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, 100 - (elapsed / duration) * 100);
      setProgress(remaining);
      
      if (elapsed >= duration) {
        clearInterval(interval);
        onClose();
      }
    }, 50);
    
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [duration]);

  return (
    <div className={`${isStacked ? 'animate-slide-in' : 'fixed top-6 right-6 z-50 animate-slide-in'}`}>
      <div className="bg-[#1A2540] border border-[#6C63FF]/30 shadow-[0_10px_40px_rgba(108,99,255,0.2)] rounded-xl overflow-hidden min-w-[300px]">
        <div className="p-4 flex items-center gap-3">
          <div className={`w-8 h-8 rounded-full ${iconBgClass} flex items-center justify-center ${iconColorClass}`}>
            <span className="material-symbols-outlined text-[18px]">{iconName}</span>
          </div>
          <p className="text-white text-sm font-medium">{message}</p>
          <button onClick={onClose} className="ml-auto text-slate-400 hover:text-white transition-colors">
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>
        <div className="h-1 bg-[#0F1729] w-full">
          <div 
            className={`h-full bg-gradient-to-r ${progressGradient} transition-all duration-75 ease-linear`}
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </div>
  );
};

export default Toast;
