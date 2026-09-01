import React, { useState } from 'react';
import { 
  Home, 
  Calendar, 
  ArrowLeft, 
  Sparkles, 
  MapPin, 
  Phone, 
  RotateCcw, 
  Trophy, 
  AlertCircle,
  ChevronRight,
  Compass
} from 'lucide-react';

export default function NotFound({ onNavigate }) {
  const [score, setScore] = useState(0);
  const [ballPosition, setBallPosition] = useState({ x: 50, y: 70 });
  const [isKicking, setIsKicking] = useState(false);
  const [goalText, setGoalText] = useState('');

  const handleKick = () => {
    if (isKicking) return;
    setIsKicking(true);
    
    // Animate ball into the top goal area
    const randomGoalX = Math.floor(Math.random() * 60) + 20; // 20% to 80%
    setBallPosition({ x: randomGoalX, y: 20 });
    
    setTimeout(() => {
      setScore(prev => prev + 1);
      setGoalText('GOAL! ⚽🔥');
      
      setTimeout(() => {
        setGoalText('');
        // Reset ball position
        setBallPosition({ x: 50, y: 70 });
        setIsKicking(false);
      }, 1000);
    }, 400);
  };

  const handleGoHome = () => {
    if (onNavigate) {
      onNavigate('home');
    } else {
      window.location.href = '/';
    }
  };

  const handleGoBook = () => {
    if (onNavigate) {
      onNavigate('book');
    } else {
      window.location.href = '/?tab=book';
    }
  };

  const handleGoPasses = () => {
    if (onNavigate) {
      onNavigate('passes');
    } else {
      window.location.href = '/?tab=passes';
    }
  };

  return (
    <div className="min-h-screen w-full bg-[#070707] text-white flex flex-col items-center justify-between relative overflow-hidden font-['Space_Mono',_monospace] selection:bg-[#22c55e] selection:text-black">
      
      {/* Background Neon Ambient Glows */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-[#22c55e]/15 rounded-full blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-10 right-10 w-72 h-72 bg-[#16a34a]/10 rounded-full blur-[100px] pointer-events-none"></div>
      <div className="absolute top-10 left-10 w-64 h-64 bg-emerald-900/10 rounded-full blur-[90px] pointer-events-none"></div>

      {/* Grid Pattern Overlay */}
      <div 
        className="absolute inset-0 opacity-15 pointer-events-none"
        style={{
          backgroundImage: `linear-gradient(#1f1f1f 1px, transparent 1px), linear-gradient(90deg, #1f1f1f 1px, transparent 1px)`,
          backgroundSize: '40px 40px'
        }}
      ></div>

      {/* Top Header Bar */}
      <header className="w-full max-w-4xl px-6 pt-6 flex items-center justify-between z-10">
        <button 
          onClick={handleGoHome}
          className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-neutral-400 hover:text-[#22c55e] transition-colors group"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
          <span>Golden Arm Turf</span>
        </button>

        <div className="flex items-center gap-2 bg-neutral-950/80 backdrop-blur-md px-3 py-1.5 rounded-full border border-neutral-800 text-[11px] font-bold tracking-wider text-[#22c55e]">
          <span className="w-2 h-2 rounded-full bg-[#22c55e] animate-ping"></span>
          <span>STATUS: 404 OUT OF BOUNDS</span>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="w-full max-w-4xl px-6 py-10 z-10 flex flex-col items-center text-center my-auto">
        
        {/* Large 404 Hero Visual */}
        <div className="relative mb-6">
          <h1 className="text-8xl sm:text-9xl md:text-[13rem] font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-b from-white via-neutral-200 to-neutral-700 leading-none select-none">
            404
          </h1>
          <div className="absolute -inset-4 bg-gradient-to-r from-[#22c55e]/20 via-emerald-500/10 to-transparent blur-xl -z-10 rounded-3xl"></div>
          
          <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-[#22c55e] text-black px-4 py-1 font-extrabold text-xs tracking-widest uppercase rounded-sm shadow-[4px_4px_0px_#000]">
            BALL WENT OVER THE FENCE!
          </div>
        </div>

        {/* Message */}
        <h2 className="text-2xl sm:text-3xl font-extrabold text-white mb-3 max-w-xl leading-tight">
          Looks like you've strayed off the pitch
        </h2>
        <p className="text-neutral-400 text-sm sm:text-base max-w-md mb-8 leading-relaxed">
          The page or slot route you're looking for doesn't exist or has been moved to another position on the field.
        </p>

        {/* Interactive Turf Mini Game */}
        <div className="w-full max-w-md bg-neutral-950/90 border border-neutral-800/80 rounded-2xl p-5 mb-8 backdrop-blur-md shadow-2xl relative overflow-hidden">
          <div className="flex items-center justify-between mb-3 border-b border-neutral-800 pb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-neutral-400 flex items-center gap-1.5">
              <Trophy className="w-3.5 h-3.5 text-[#22c55e]" />
              Mini Turf Shootout
            </span>
            <span className="text-xs font-bold text-[#22c55e] bg-[#22c55e]/10 px-2 py-0.5 rounded border border-[#22c55e]/30">
              Score: {score}
            </span>
          </div>

          {/* Turf Field Graphic */}
          <div className="w-full h-40 bg-gradient-to-b from-emerald-950/40 via-neutral-900 to-neutral-950 rounded-xl border border-emerald-900/40 relative overflow-hidden flex flex-col justify-between p-3">
            {/* Field Lines */}
            <div className="absolute inset-x-4 top-2 h-12 border-2 border-emerald-500/30 border-t-0 rounded-b-xl pointer-events-none"></div>
            <div className="absolute inset-x-0 top-1/2 border-t border-dashed border-emerald-500/20 pointer-events-none"></div>
            
            {/* Goal Text Banner */}
            {goalText && (
              <div className="absolute inset-0 bg-[#22c55e]/20 backdrop-blur-xs flex items-center justify-center text-xl font-black text-[#22c55e] animate-bounce z-20">
                {goalText}
              </div>
            )}

            {/* Target Goal Net */}
            <div className="w-36 h-8 mx-auto border-2 border-dashed border-[#22c55e]/60 rounded-t-md bg-[#22c55e]/5 flex items-center justify-center text-[10px] text-emerald-400 font-bold uppercase tracking-wider">
              GOAL TARGET
            </div>

            {/* Soccer Ball */}
            <div 
              className="w-8 h-8 rounded-full bg-white border-2 border-black flex items-center justify-center text-sm shadow-[0_0_12px_rgba(34,197,94,0.6)] absolute transition-all duration-300 ease-out z-10 cursor-pointer hover:scale-110"
              style={{
                left: `${ballPosition.x}%`,
                top: `${ballPosition.y}%`,
                transform: 'translate(-50%, -50%)'
              }}
              onClick={handleKick}
              title="Click to shoot!"
            >
              ⚽
            </div>
          </div>

          <button
            onClick={handleKick}
            disabled={isKicking}
            className="w-full mt-3 py-2.5 bg-[#22c55e] hover:bg-[#16a34a] text-black font-extrabold text-xs uppercase tracking-widest rounded-xl transition-all shadow-[4px_4px_0px_#111] hover:shadow-none hover:translate-x-1 hover:translate-y-1 active:translate-x-1 active:translate-y-1 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <Sparkles className="w-3.5 h-3.5" />
            {isKicking ? 'KICKING...' : 'TAKE A SHOT ON GOAL!'}
          </button>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full max-w-md">
          <button
            onClick={handleGoHome}
            className="w-full sm:flex-1 py-3.5 px-6 bg-[#22c55e] hover:bg-[#16a34a] text-black font-extrabold text-xs uppercase tracking-widest rounded-xl transition-all shadow-[4px_4px_0px_#111] hover:shadow-none hover:translate-x-1 hover:translate-y-1 flex items-center justify-center gap-2 cursor-pointer"
          >
            <Home className="w-4 h-4" />
            Return to Home Field
          </button>

          <button
            onClick={handleGoBook}
            className="w-full sm:flex-1 py-3.5 px-6 bg-neutral-900 hover:bg-neutral-800 text-white font-extrabold text-xs uppercase tracking-widest rounded-xl border border-neutral-700 transition-all shadow-[4px_4px_0px_#111] hover:shadow-none hover:translate-x-1 hover:translate-y-1 flex items-center justify-center gap-2 cursor-pointer"
          >
            <Calendar className="w-4 h-4 text-[#22c55e]" />
            Book Turf Slot
          </button>
        </div>

        {/* Quick Links */}
        <div className="mt-8 pt-6 border-t border-neutral-900 w-full max-w-md flex items-center justify-around text-xs text-neutral-400">
          <button 
            onClick={handleGoPasses} 
            className="hover:text-[#22c55e] transition-colors flex items-center gap-1 cursor-pointer"
          >
            <Compass className="w-3.5 h-3.5" />
            My Passes
          </button>
          <span className="text-neutral-700">•</span>
          <a 
            href="tel:+919876543210" 
            className="hover:text-[#22c55e] transition-colors flex items-center gap-1"
          >
            <Phone className="w-3.5 h-3.5" />
            Call Support
          </a>
          <span className="text-neutral-700">•</span>
          <button 
            onClick={() => window.location.href = '/admin'} 
            className="hover:text-[#22c55e] transition-colors flex items-center gap-1 cursor-pointer"
          >
            Admin Panel
          </button>
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full max-w-4xl px-6 py-4 text-center text-[10px] text-neutral-600 border-t border-neutral-900/60 z-10">
        © {new Date().getFullYear()} Golden Arm Sports Turf Alakode. All Rights Reserved.
      </footer>
    </div>
  );
}
