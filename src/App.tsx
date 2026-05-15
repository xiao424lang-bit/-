/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useRef, useEffect, useMemo } from 'react';
import { motion, useAnimation, AnimatePresence } from 'motion/react';
import { Trophy, Gift, Smartphone, PenTool, Sparkles, Volume2, VolumeX } from 'lucide-react';

// --- Types ---
interface Prize {
  id: number;
  label: string;
  description: string;
  probability: number;
  color: string;
  icon: React.ReactNode;
}

// --- Audio Utility ---
class SlotMachineAudio {
  private ctx: AudioContext | null = null;
  private isMuted: boolean = false;

  constructor() {
    if (typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
  }

  setMuted(muted: boolean) {
    this.isMuted = muted;
    if (muted && this.ctx?.state === 'running') {
      this.ctx.suspend();
    } else if (!muted && this.ctx?.state === 'suspended') {
      this.ctx.resume();
    }
  }

  private async ensureContext() {
    if (this.ctx?.state === 'suspended') {
      await this.ctx.resume();
    }
  }

  playTick() {
    if (this.isMuted || !this.ctx) return;
    this.ensureContext();
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    // Mechanical "click" sound
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(800, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(100, this.ctx.currentTime + 0.02);

    gain.gain.setValueAtTime(0.05, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.02);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start();
    osc.stop(this.ctx.currentTime + 0.02);
  }

  playWin() {
    if (this.isMuted || !this.ctx) return;
    this.ensureContext();
    const now = this.ctx.currentTime;
    
    // Play a happy major arpeggio (C Major)
    [523.25, 659.25, 783.99, 1046.50, 1318.51].forEach((freq, i) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + i * 0.08);
      
      gain.gain.setValueAtTime(0, now + i * 0.08);
      gain.gain.linearRampToValueAtTime(0.3, now + i * 0.08 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.01, now + i * 0.08 + 0.5);
      
      osc.connect(gain);
      gain.connect(this.ctx!.destination);
      
      osc.start(now + i * 0.08);
      osc.stop(now + i * 0.08 + 0.5);
    });
  }
}

const audioManager = new SlotMachineAudio();

// --- Components ---

function Sparkle({ delay }: { delay: number }) {
  return (
    <motion.div
      initial={{ scale: 0, opacity: 0, rotate: 0 }}
      animate={{ 
        scale: [0, 1.2, 0], 
        opacity: [0, 1, 0], 
        rotate: 360,
        x: (Math.random() - 0.5) * 400,
        y: (Math.random() - 0.5) * 400,
      }}
      transition={{ duration: 1.5, delay, repeat: Infinity, repeatDelay: 1 }}
      className="absolute"
    >
      <Sparkles className="text-yellow-400 w-6 h-6 fill-yellow-400" />
    </motion.div>
  );
}

export default function App() {
  const [isSpinning, setIsSpinning] = useState(false);
  const [result, setResult] = useState<Prize | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [hasSpun, setHasSpun] = useState(false);
  const wheelControls = useAnimation();
  const rotationRef = useRef(0);

  // Initialize from localStorage
  useEffect(() => {
    const status = localStorage.getItem('lucky_spin_has_played');
    if (status === 'true') {
      setHasSpun(true);
    }
  }, []);

  const prizes: Prize[] = useMemo(() => [
    { 
      id: 0, 
      label: '特等奖', 
      description: '华为手机 (价值¥5999)', 
      probability: 0, 
      color: '#FF3D3D', 
      icon: <Smartphone className="w-8 h-8" /> 
    },
    { 
      id: 1, 
      label: '一等奖', 
      description: '全场免单 (超级大奖)', 
      probability: 0, 
      color: '#FFB800', 
      icon: <Trophy className="w-8 h-8" /> 
    },
    { 
      id: 2, 
      label: '二等奖', 
      description: '精致触控笔', 
      probability: 0, 
      color: '#00D68F', 
      icon: <PenTool className="w-8 h-8" /> 
    },
    { 
      id: 3, 
      label: '三等奖', 
      description: '爆款文案素材包', 
      probability: 100, 
      color: '#0085FF', 
      icon: <Gift className="w-8 h-8" /> 
    },
  ], []);

  const handleMuteToggle = () => {
    setIsMuted(!isMuted);
    audioManager.setMuted(!isMuted);
  };

  const handleClaim = () => {
    setResult(null);
    setHasSpun(true);
    localStorage.setItem('lucky_spin_has_played', 'true');
  };

  const spin = async () => {
    if (isSpinning || hasSpun) return;

    setIsSpinning(true);
    setResult(null);

    const winningIndex = 3; 
    const randomTargetOffset = 3 + Math.floor(Math.random() * 57); 
    
    const extraSpins = 7 + Math.floor(Math.random() * 2); 
    const finalRotation = rotationRef.current + (extraSpins * 360) + randomTargetOffset - (rotationRef.current % 360);
    
    rotationRef.current = finalRotation;
    const duration = 9000; 

    await wheelControls.start({
      rotate: finalRotation,
      transition: {
        duration: duration / 1000,
        ease: [0.1, 0, 0, 1], 
      },
    });

    audioManager.playWin();
    setIsSpinning(false);
    setResult(prizes[winningIndex]);
  };

  // --- Dynamic Audio Effect ---
  useEffect(() => {
    if (!isSpinning) return;

    let startTime = Date.now();
    const duration = 9000; 
    let timer: NodeJS.Timeout;

    const tick = () => {
      const elapsed = Date.now() - startTime;
      const progress = elapsed / duration;

      if (progress < 1) {
        audioManager.playTick();
        const nextInterval = 40 + (Math.pow(progress, 3) * 1000); 
        timer = setTimeout(tick, nextInterval);
      }
    };

    tick();
    return () => clearTimeout(timer);
  }, [isSpinning]);

  return (
    <div className="min-h-screen bg-[#070B14] text-white flex flex-col items-center justify-center p-4 overflow-hidden relative">
      {/* Background */}
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[80vw] h-[80vw] bg-blue-600/10 blur-[100px] rounded-full animate-pulse" />
      </div>

      <div className="z-10 flex flex-col items-center gap-6 md:gap-10 w-full max-w-sm sm:max-w-lg">
        {/* Header */}
        <div className="text-center space-y-2">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="inline-block px-4 py-1 rounded-full bg-yellow-500/10 border border-yellow-500/20 text-yellow-500 text-[10px] font-bold uppercase tracking-[0.2em] mb-1"
          >
            {hasSpun ? "活动已结束" : "专属于您的幸运时刻"}
          </motion.div>
          <motion.h1 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-5xl md:text-7xl font-black italic uppercase tracking-tighter text-transparent bg-clip-text bg-gradient-to-b from-white to-slate-500 drop-shadow-xl"
            id="game-title"
          >
            幸运转盘
          </motion.h1>
        </div>

        {/* Wheel Container */}
        <div className="relative scale-90 sm:scale-100">
          <div className="absolute inset-0 -m-5 bg-gradient-to-b from-slate-700 to-slate-900 rounded-full shadow-[0_20px_50px_-10px_rgba(0,0,0,0.8)] z-0 border-[6px] border-slate-800" />
          
          {/* Lights */}
          <div className="absolute inset-0 -m-5 z-10 pointer-events-none">
            {[...Array(16)].map((_, i) => (
              <div 
                key={i}
                className={`absolute w-2 h-2 rounded-full ${isSpinning && i % 2 === 0 ? 'bg-white shadow-[0_0_10px_white]' : 'bg-yellow-400 shadow-[0_0_8px_#fbbf24]'} transition-all duration-100`}
                style={{
                  top: '50%',
                  left: '50%',
                  transform: `rotate(${i * (360/16)}deg) translate(0, -158px) sm:translate(0, -202px)`,
                }}
              />
            ))}
          </div>

          {/* Pointer */}
          <div className="absolute -top-8 left-1/2 -translate-x-1/2 z-40">
            <div className="w-8 h-10 bg-white rounded-t-lg shadow-2xl flex flex-col items-center justify-center p-1">
              <div className="w-full h-full bg-red-600 rounded-sm shadow-inner" />
            </div>
            <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-[10px] border-l-transparent border-r-[10px] border-r-transparent border-t-[14px] border-t-white" />
          </div>

          {/* Wheel */}
          <motion.div
            animate={wheelControls}
            className="relative w-72 h-72 sm:w-96 sm:h-96 rounded-full overflow-hidden z-20 border-[4px] border-[#1e293b]"
            style={{ transformOrigin: 'center' }}
            id="main-wheel"
          >
            <svg viewBox="0 0 100 100" className="w-full h-full transform -rotate-90 scale-105">
              {prizes.map((prize, i) => {
                const angle = 360 / prizes.length;
                const startAngle = i * angle;
                const endAngle = (i + 1) * angle;
                const x1 = 50 + 50 * Math.cos((Math.PI * startAngle) / 180);
                const y1 = 50 + 50 * Math.sin((Math.PI * startAngle) / 180);
                const x2 = 50 + 50 * Math.cos((Math.PI * endAngle) / 180);
                const y2 = 50 + 50 * Math.sin((Math.PI * endAngle) / 180);
                return (
                  <g key={prize.id}>
                    <path d={`M 50 50 L ${x1} ${y1} A 50 50 0 0 1 ${x2} ${y2} Z`} fill={prize.color} stroke="#0f172a" strokeWidth="0.5" />
                    <g transform={`rotate(${startAngle + angle / 2}, 50, 50)`}>
                      <text x="72" y="50" fill="white" fontSize="5" fontWeight="900" textAnchor="middle" alignmentBaseline="middle" transform="rotate(90, 72, 50)" className="select-none tracking-tighter" style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.5))' }}>
                        {prize.label}
                      </text>
                    </g>
                  </g>
                );
              })}
            </svg>
            
            {/* Center Cap */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-16 sm:w-20 sm:h-20 bg-slate-900 rounded-full flex items-center justify-center shadow-2xl z-10 border-[6px] border-slate-800">
               <button 
                onClick={spin}
                disabled={isSpinning || hasSpun}
                className={`w-full h-full rounded-full flex flex-col items-center justify-center transition-all font-black text-[10px] tracking-tighter px-2
                  ${hasSpun ? 'bg-slate-800 text-slate-500' : 'bg-gradient-to-b from-yellow-400 to-yellow-600 hover:scale-105 active:scale-90 text-slate-900'}
                `}
               >
                 {hasSpun ? <Lock className="w-4 h-4" /> : <Sparkles className="w-4 h-4 mb-0.5" />}
                 {hasSpun ? 'LOCKED' : 'START'}
               </button>
            </div>
          </motion.div>
        </div>

        {/* Action Button */}
        <div className="flex flex-col items-center gap-4 w-full px-4">
          <button
            onClick={spin}
            disabled={isSpinning || hasSpun}
            className={`
              w-full py-4 rounded-2xl font-black text-xl flex items-center justify-center gap-4 transition-all
              ${hasSpun 
                ? 'bg-slate-800 text-slate-600 cursor-not-allowed border border-white/5 shadow-none' 
                : isSpinning
                ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                : 'bg-gradient-to-r from-[#FF3D3D] to-[#FF8A00] shadow-[0_10px_30px_-5px_rgba(239,68,68,0.4)] text-white cursor-pointer active:translate-y-1'
              }
            `}
            id="spin-button"
          >
            {hasSpun ? <Lock /> : isSpinning ? <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}><Sparkles /></motion.div> : <Gift />}
            {hasSpun ? '每人限抽一次，机会已用完' : isSpinning ? '正在开启好运...' : '点击开启幸运大奖'}
          </button>

          <div className="flex items-center gap-4">
            <button 
              onClick={handleMuteToggle}
              className="flex items-center gap-2 px-4 py-2 rounded-full bg-slate-800/40 text-slate-500 text-[10px] font-bold uppercase tracking-widest"
              id="mute-button"
            >
              {isMuted ? <VolumeX className="w-3 h-3" /> : <Volume2 className="w-3 h-3" />}
              {isMuted ? 'Muted' : 'Sound On'}
            </button>
          </div>
        </div>
      </div>

      {/* Results Modal */}
      <AnimatePresence>
        {result && !isSpinning && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#070B14]/95 backdrop-blur-md"
          >
            <motion.div 
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              className="bg-[#111827] border border-white/10 p-8 rounded-[32px] max-w-xs w-full text-center space-y-6 shadow-2xl relative"
              onClick={e => e.stopPropagation()}
            >
              <div 
                className="w-24 h-24 mx-auto rounded-[24px] flex items-center justify-center text-white shadow-2xl relative"
                style={{ backgroundColor: result.color }}
              >
                 <Gift className="w-10 h-10" />
                 <div className="absolute -top-2 -right-2 bg-yellow-400 text-slate-900 w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black">
                   ★
                 </div>
              </div>
              
              <div className="space-y-2">
                <h2 className="text-yellow-500 text-[10px] font-black uppercase tracking-[0.3em]">中奖啦！</h2>
                <h3 className="text-3xl font-black text-white italic uppercase tracking-tighter">
                  {result.label}
                </h3>
                <p className="text-slate-400 text-sm leading-relaxed px-2">
                  {result.description}
                </p>
              </div>

              <div className="bg-white/5 p-4 rounded-xl border border-white/5">
                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest italic">Rewards locked to your session</p>
              </div>

              <button 
                onClick={handleClaim}
                className="w-full py-4 bg-white text-slate-950 font-black rounded-xl transition-all active:scale-95 shadow-xl"
              >
                收下奖品 领奖成功
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <footer className="mt-8 text-slate-700 text-[9px] font-bold tracking-widest uppercase opacity-50">
        Authentic Luck System • v1.2
      </footer>
    </div>
  );
}

