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
  const wheelControls = useAnimation();
  const rotationRef = useRef(0);

  const prizes: Prize[] = useMemo(() => [
    { 
      id: 0, 
      label: '特等奖', 
      description: '华为手机 (价值¥5999)', 
      probability: 0, 
      color: '#FF3D3D', // More vibrant red
      icon: <Smartphone className="w-8 h-8" /> 
    },
    { 
      id: 1, 
      label: '一等奖', 
      description: '全场免单 (超级大奖)', 
      probability: 0, 
      color: '#FFB800', // More vibrant gold
      icon: <Trophy className="w-8 h-8" /> 
    },
    { 
      id: 2, 
      label: '二等奖', 
      description: '精致触控笔', 
      probability: 0, 
      color: '#00D68F', // More vibrant green
      icon: <PenTool className="w-8 h-8" /> 
    },
    { 
      id: 3, 
      label: '三等奖', 
      description: '爆款文案素材包', 
      probability: 100, 
      color: '#0085FF', // More vibrant blue
      icon: <Gift className="w-8 h-8" /> 
    },
  ], []);

  const handleMuteToggle = () => {
    setIsMuted(!isMuted);
    audioManager.setMuted(!isMuted);
  };

  const spin = async () => {
    if (isSpinning) return;

    setIsSpinning(true);
    setResult(null);

    // 逻辑索引说明：
    // 0: 特等奖 (Red), 1: 一等奖 (Gold), 2: 二等奖 (Green), 3: 三等奖 (Blue)
    // 旋转序列 (顺时针，指针对应): ... -> 一等奖 -> 特等奖 -> 三等奖 -> ...
    const winningIndex = 3; 
    const segments = prizes.length;
    
    // 设置随机落点，范围在 3 到 60 度之间
    // 旋转模式下，落在 [0, 90] 度范围内即为三等奖
    const randomTargetOffset = 3 + Math.floor(Math.random() * 57); 
    
    const extraSpins = 7 + Math.floor(Math.random() * 2); 
    const finalRotation = rotationRef.current + (extraSpins * 360) + randomTargetOffset - (rotationRef.current % 360);
    
    rotationRef.current = finalRotation;

    const duration = 9000; // 增长时间到 9 秒

    await wheelControls.start({
      rotate: finalRotation,
      transition: {
        duration: duration / 1000,
        ease: [0.1, 0, 0, 1], 
      },
    });

    setTimeout(() => audioManager.playWin(), 200);
    
    setIsSpinning(false);
    setResult(prizes[winningIndex]);
  };

  // --- 动态音效控制 (老虎机风格) ---
  useEffect(() => {
    if (!isSpinning) return;

    let startTime = Date.now();
    const duration = 9000; // 与动画时长同步
    let timer: NodeJS.Timeout;

    const tick = () => {
      const elapsed = Date.now() - startTime;
      const progress = elapsed / duration;

      if (progress < 1) {
        audioManager.playTick();
        
        // 音效频率呈指数级衰减：
        // 开始时 50ms 一响，最后变为 800ms+ 一响，产生“滑行”感
        const nextInterval = 40 + (Math.pow(progress, 3) * 1000); 
        timer = setTimeout(tick, nextInterval);
      }
    };

    tick();
    return () => clearTimeout(timer);
  }, [isSpinning]);

  return (
    <div className="min-h-screen bg-[#070B14] text-white flex flex-col items-center justify-center p-4 overflow-hidden relative">
      {/* Dynamic Background */}
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-blue-600/10 blur-[150px] rounded-full animate-pulse" />
        <div className="absolute top-1/4 right-1/4 w-[400px] h-[400px] bg-red-600/5 blur-[120px] rounded-full" />
      </div>

      <div className="z-10 flex flex-col items-center gap-10 w-full max-w-lg">
        {/* Header */}
        <div className="text-center space-y-3">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="inline-block px-4 py-1 rounded-full bg-yellow-500/10 border border-yellow-500/20 text-yellow-500 text-[10px] font-bold uppercase tracking-[0.3em] mb-2"
          >
            Lucky Casino Edition
          </motion.div>
          <motion.h1 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-6xl md:text-7xl font-black italic uppercase tracking-tighter text-transparent bg-clip-text bg-gradient-to-b from-white via-slate-200 to-slate-500 drop-shadow-[0_10px_10px_rgba(0,0,0,0.5)]"
            id="game-title"
          >
            幸运大转盘
          </motion.h1>
          <div className="flex items-center justify-center gap-4">
             <div className="h-px w-8 bg-slate-800" />
             <p className="text-slate-500 font-bold tracking-[0.2em] uppercase text-[10px]" id="game-subtitle">
               Spin to Win Big
             </p>
             <div className="h-px w-8 bg-slate-800" />
          </div>
        </div>

        {/* Wheel Container */}
        <div className="relative group">
          {/* Neon Ring */}
          <div className="absolute inset-0 -m-8 border-[1px] border-white/5 rounded-full z-0" />
          <div className="absolute inset-0 -m-6 border-[1px] border-white/10 rounded-full z-0" />
          
          {/* Main Frame */}
          <div className="absolute inset-0 -m-5 bg-gradient-to-b from-slate-700 to-slate-900 rounded-full shadow-[0_30px_60px_-15px_rgba(0,0,0,0.7)] z-0 border-[8px] border-slate-800" />
          
          {/* Decorative "Lights" */}
          <div className="absolute inset-0 -m-5 z-10 pointer-events-none">
            {[...Array(16)].map((_, i) => (
              <div 
                key={i}
                className={`absolute w-2.5 h-2.5 rounded-full ${isSpinning && i % 2 === 0 ? 'bg-white shadow-[0_0_15px_white]' : 'bg-yellow-400 shadow-[0_0_10px_#fbbf24]'} transition-all duration-100`}
                style={{
                  top: '50%',
                  left: '50%',
                  transform: `rotate(${i * (360/16)}deg) translate(0, -202px)`,
                }}
              />
            ))}
          </div>

          {/* Pointer */}
          <div className="absolute -top-10 left-1/2 -translate-x-1/2 z-40">
            <div className="relative">
              <div className="w-10 h-12 bg-white rounded-t-lg shadow-2xl flex flex-col items-center justify-center p-1">
                <div className="w-full h-full bg-red-600 rounded-sm shadow-inner" />
              </div>
              <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-[12px] border-l-transparent border-r-[12px] border-r-transparent border-t-[16px] border-t-white" />
            </div>
          </div>

          {/* Actual Wheel */}
          <motion.div
            animate={wheelControls}
            className="relative w-80 h-80 md:w-96 md:h-96 rounded-full overflow-hidden shadow-[inset_0_0_50px_rgba(0,0,0,0.5)] z-20 border-[6px] border-[#1e293b]"
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
                    <path
                      d={`M 50 50 L ${x1} ${y1} A 50 50 0 0 1 ${x2} ${y2} Z`}
                      fill={prize.color}
                      stroke="#0f172a"
                      strokeWidth="0.5"
                    />
                    {/* Shadow overlay for depth */}
                    <path
                      d={`M 50 50 L ${x1} ${y1} A 50 50 0 0 1 ${x2} ${y2} Z`}
                      fill="url(#segmentGradient)"
                      className="opacity-20"
                    />
                    <g transform={`rotate(${startAngle + angle / 2}, 50, 50)`}>
                      <text
                        x="72"
                        y="50"
                        fill="white"
                        fontSize="5.5"
                        fontWeight="900"
                        textAnchor="middle"
                        alignmentBaseline="middle"
                        transform="rotate(90, 72, 50)"
                        className="pointer-events-none select-none tracking-tighter"
                        style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.5))' }}
                      >
                        {prize.label}
                      </text>
                    </g>
                  </g>
                );
              })}
              <defs>
                <radialGradient id="segmentGradient" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="black" />
                  <stop offset="100%" stopColor="transparent" />
                </radialGradient>
              </defs>
            </svg>
            
            {/* Center Cap */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-20 h-20 bg-slate-900 rounded-full flex items-center justify-center shadow-2xl z-10 border-[6px] border-slate-800">
               <button 
                onClick={spin}
                disabled={isSpinning}
                className="w-full h-full rounded-full flex flex-col items-center justify-center bg-gradient-to-b from-yellow-400 to-yellow-600 hover:from-yellow-300 hover:to-yellow-500 active:scale-90 transition-all text-slate-900 font-black text-[10px] tracking-tighter px-2"
               >
                 <Sparkles className="w-4 h-4 mb-0.5" />
                 START
               </button>
            </div>
          </motion.div>
        </div>

        {/* Action Button */}
        <div className="flex flex-col items-center gap-6 w-full">
          <button
            onClick={spin}
            disabled={isSpinning}
            className={`
              w-full py-5 rounded-3xl font-black text-2xl flex items-center justify-center gap-4 shadow-[0_15px_30px_-10px_rgba(239,68,68,0.5)] transition-all active:translate-y-1
              ${isSpinning 
                ? 'bg-slate-800 text-slate-500 cursor-not-allowed shadow-none' 
                : 'bg-gradient-to-r from-[#FF3D3D] to-[#FF8A00] hover:scale-[1.02] text-white cursor-pointer active:shadow-none'
              }
            `}
            id="spin-button"
          >
            {isSpinning ? <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}><Sparkles /></motion.div> : <Gift className="w-8 h-8" />}
            {isSpinning ? '正在为您抽取惊喜...' : '开启幸运大奖'}
          </button>

          <div className="flex items-center gap-8">
            <button 
              onClick={handleMuteToggle}
              className="flex items-center gap-2 px-4 py-2 rounded-full bg-slate-800/40 hover:bg-slate-800/60 transition-colors text-slate-400 text-[10px] font-bold uppercase tracking-widest"
              id="mute-button"
            >
              {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
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
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#070B14]/90 backdrop-blur-md"
            onClick={() => setResult(null)}
          >
            {/* Celebration Sparkles */}
            <div className="absolute inset-0 pointer-events-none">
              {[...Array(20)].map((_, i) => (
                <Sparkle key={i} delay={i * 0.1} />
              ))}
            </div>

            <motion.div 
              initial={{ scale: 0.5, y: 100, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.5, y: 100, opacity: 0 }}
              className="bg-[#111827] border-[1px] border-white/10 p-10 rounded-[40px] max-w-sm w-full text-center space-y-8 shadow-[0_50px_100px_-20px_rgba(0,0,0,1)] relative overflow-hidden"
              onClick={e => e.stopPropagation()}
            >
              {/* Modal Background Glow */}
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-48 bg-blue-500/10 blur-[60px] rounded-full -z-10" />

              <div 
                className="w-28 h-28 mx-auto rounded-[32px] flex items-center justify-center text-white shadow-2xl relative"
                style={{ backgroundColor: result.color }}
              >
                 <motion.div
                   animate={{ rotate: [0, -10, 10, 0] }}
                   transition={{ repeat: Infinity, duration: 2 }}
                 >
                   {result.icon}
                 </motion.div>
                 <div className="absolute -top-3 -right-3 bg-yellow-400 text-slate-900 w-8 h-8 rounded-full flex items-center justify-center text-xs font-black shadow-lg">
                   ★
                 </div>
              </div>
              
              <div className="space-y-3">
                <motion.h2 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-yellow-500 text-xs font-black uppercase tracking-[0.4em]"
                >
                  Victory Alert
                </motion.h2>
                <h3 className="text-4xl font-black text-white tracking-tighter leading-none italic uppercase">
                  {result.label}
                </h3>
                <p className="text-slate-400 text-sm font-medium px-4">
                  {result.description}
                </p>
              </div>

              <div className="bg-white/5 p-5 rounded-2xl border border-white/5 flex items-center justify-center gap-3">
                <Sparkles className="text-yellow-500 w-4 h-4" />
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Rewards added to wallet</p>
                <Sparkles className="text-yellow-500 w-4 h-4" />
              </div>

              <button 
                onClick={() => setResult(null)}
                className="w-full py-4 bg-white text-slate-950 font-black rounded-2xl transition-all active:scale-95 shadow-[0_10px_20px_rgba(255,255,255,0.1)] hover:bg-slate-100"
              >
                CLOSE & CLAIM
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <footer className="mt-12 text-slate-600 text-xs font-medium tracking-tight uppercase z-10" id="copyright">
        © 2026 Lucky Spin Game • Strictly Confidential
      </footer>
    </div>
  );
}
