
import React, { useEffect, useRef, useState } from 'react';
import { GameEngine } from './game/GameEngine';
import { GeminiService } from './game/GeminiService';
import { Action } from './game/Input';

// Define the interface for global type safety with a unique name to avoid naming collisions
interface AIStudioAPI {
  hasSelectedApiKey(): Promise<boolean>;
  openSelectKey(): Promise<void>;
}

declare global {
  interface Window {
    // Removed readonly modifier to match the likely global definition and fix identical modifiers error
    aistudio: AIStudioAPI;
  }
}

const App: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const radarRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<GameEngine | null>(null);
  
  const [hasKey, setHasKey] = useState<boolean | null>(null);
  const [gameState, setGameState] = useState<'START' | 'PLAYING' | 'CINEMA'>('START');
  const [spiritMessage, setSpiritMessage] = useState("Sincronizando red neuronal de la nutria...");
  const [coverImage, setCoverImage] = useState<string | null>(null);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [isGeneratingVideo, setIsGeneratingVideo] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [loadingStep, setLoadingStep] = useState("");
  
  const [controls, setControls] = useState<Record<Action, string>>({
    FORWARD: 'w',
    BACKWARD: 's',
    LEFT: 'a',
    RIGHT: 'd',
    JUMP: ' ',
    BOOST: 'shift',
    DIVE: 'control'
  });

  const [hud, setHud] = useState({ 
    state: 'LAND', 
    stamina: 100, 
    score: 0, 
    speed: 0,
    isBoosting: false
  });

  const lastGeminiUpdate = useRef(0);

  useEffect(() => {
    const checkKey = async () => {
      const selected = await window.aistudio.hasSelectedApiKey();
      setHasKey(selected);
    };
    checkKey();
  }, []);

  const handleSelectKey = async () => {
    await window.aistudio.openSelectKey();
    // Mitigating race condition by assuming success and proceeding to application state
    setHasKey(true);
  };

  const startGame = () => {
    setGameState('PLAYING');
    if (containerRef.current && !gameRef.current) {
      gameRef.current = new GameEngine(containerRef.current, (data) => {
        setHud({
          state: data.state,
          stamina: Math.floor(data.stamina),
          score: Math.floor(data.score),
          speed: Math.floor(data.speed * 3.6),
          isBoosting: data.isBoosting
        });
        updateRadar(data.playerPos, data.fishes);
        checkGeminiLogic(data);
      });
      gameRef.current.otterUpdateControls(controls);
    }
  };

  const handleGenerateCinema = async () => {
    setGameState('CINEMA');
    setIsGeneratingVideo(true);
    setLoadingStep("Analizando datos de la simulación...");
    
    try {
      const messages = [
        "Renderizando partículas de neón...",
        "Sincronizando con el Espíritu del Río...",
        "Compilando memorias tácticas...",
        "Finalizando trailer cinemático..."
      ];
      
      let msgIdx = 0;
      const interval = setInterval(() => {
        setLoadingStep(messages[msgIdx % messages.length]);
        msgIdx++;
      }, 3000);

      const url = await GeminiService.generateCinematicTrailer(hud.score);
      clearInterval(interval);
      
      if (url) {
        setVideoUrl(url);
      }
    } catch (error: any) {
      // If the request fails with 404, reset key selection and re-prompt user
      if (error.message?.includes("Requested entity was not found")) {
        setHasKey(false);
      }
    }
    setIsGeneratingVideo(false);
  };

  const handleGenerateCover = async () => {
    setIsGeneratingImage(true);
    try {
      const img = await GeminiService.generateCoverImage();
      if (img) setCoverImage(img);
    } catch (error: any) {
      if (error.message?.includes("Requested entity was not found")) {
        setHasKey(false);
      }
    }
    setIsGeneratingImage(false);
  };

  const checkGeminiLogic = async (data: any) => {
    const now = Date.now();
    if (now - lastGeminiUpdate.current > 18000) {
      lastGeminiUpdate.current = now;
      try {
        const comment = await GeminiService.getCommentary(data);
        setSpiritMessage(comment);
        GeminiService.speak(comment);
      } catch (error: any) {
        if (error.message?.includes("Requested entity was not found")) {
          setHasKey(false);
        }
      }
    }
  };

  const updateControl = (action: Action, key: string) => {
    const newControls = { ...controls, [action]: key };
    setControls(newControls);
    if (gameRef.current) {
      gameRef.current.otterUpdateControls(newControls);
    }
  };

  useEffect(() => {
    return () => gameRef.current?.dispose();
  }, []);

  const updateRadar = (playerPos: any, fishes: any[]) => {
    const canvas = radarRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const scale = 0.35;

    ctx.strokeStyle = hud.isBoosting ? 'rgba(56, 189, 248, 0.5)' : 'rgba(56, 189, 248, 0.2)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(centerX, centerY, 55, 0, Math.PI * 2); ctx.stroke();

    fishes.forEach(f => {
      const dx = (f.x - playerPos.x) * scale;
      const dy = (f.z - playerPos.z) * scale;
      const dist = Math.sqrt(dx*dx + dy*dy);
      if (dist < 55) {
        ctx.fillStyle = dist < 20 ? '#ef4444' : '#fbbf24';
        ctx.beginPath(); ctx.arc(centerX + dx, centerY + dy, 3, 0, Math.PI * 2); ctx.fill();
      }
    });

    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(centerX, centerY, 4, 0, Math.PI * 2); ctx.fill();
  };

  if (hasKey === false) {
    return (
      <div className="fixed inset-0 bg-black z-[100] flex items-center justify-center p-6 text-center font-mono">
        <div className="max-w-md bg-zinc-900 border border-sky-400/30 p-10 rounded-[3rem] shadow-[0_0_100px_rgba(56,189,248,0.2)]">
          <div className="text-6xl mb-6">🔑</div>
          <h2 className="text-3xl font-black italic text-white mb-4 tracking-tighter uppercase">Neural Access Required</h2>
          <p className="text-white/60 text-sm mb-8 leading-relaxed">
            Se requiere una API Key con facturación activa para alimentar la red neuronal de <strong>The Otter Way</strong>.
          </p>
          <button 
            onClick={handleSelectKey}
            className="w-full py-4 bg-sky-400 text-black font-black uppercase tracking-widest rounded-full hover:scale-105 transition-transform shadow-lg"
          >
            Configurar API Key
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`relative w-full h-full bg-[#0a0a0a] overflow-hidden font-sans select-none text-white ${hud.isBoosting ? 'animate-pulse-slow' : ''}`}>
      {/* Scanline Overlay Effect */}
      <div className="absolute inset-0 pointer-events-none z-[90] opacity-[0.03] bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,118,0.06))] bg-[length:100%_2px,3px_100%]" />
      
      <div ref={containerRef} className={`w-full h-full transition-opacity duration-1000 ${gameState === 'PLAYING' ? 'opacity-100' : 'opacity-0'}`} />

      {gameState === 'START' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center z-50 overflow-hidden px-4">
          <div className="absolute inset-0 transition-all duration-1000">
            {coverImage ? (
              <div 
                className="absolute inset-0 bg-cover bg-center opacity-60 scale-110 blur-[2px]"
                style={{ backgroundImage: `url(${coverImage})` }}
              />
            ) : (
              <div className="absolute inset-0 bg-gradient-to-b from-[#0c4a6e] to-[#082f49]" />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-black/40" />
          </div>

          <div className="relative text-center z-10 w-full max-w-5xl mx-auto flex flex-col items-center">
            <div className="mb-4">
               <h1 className="text-6xl sm:text-7xl md:text-8xl lg:text-9xl font-black italic tracking-tighter leading-[0.85] drop-shadow-[0_10px_30px_rgba(0,0,0,0.8)] animate-float">
                THE OTTER<br/><span className="text-sky-400">WAY</span>
              </h1>
            </div>
            
            <p className="text-sky-300/80 uppercase tracking-[0.4em] sm:tracking-[0.8em] text-[10px] sm:text-xs mb-12 font-bold drop-shadow-md">
              <span className="opacity-50">[SYSTEM_READY]</span> Super-Otter Tactical Simulation
            </p>
            
            <div className="flex flex-col gap-6 items-center w-full max-w-xs sm:max-w-md">
              <button 
                onClick={startGame}
                className="group relative w-full py-6 bg-white text-black font-black uppercase tracking-widest rounded-full overflow-hidden transition-all hover:scale-105 active:scale-95 shadow-[0_0_40px_rgba(255,255,255,0.3)]"
              >
                <span className="relative z-10 text-lg">Initialize Sync</span>
                <div className="absolute inset-0 bg-sky-400 transform translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
              </button>

              <div className="flex flex-col sm:flex-row gap-4 w-full">
                <button 
                  onClick={handleGenerateCover}
                  disabled={isGeneratingImage}
                  className="flex-1 px-6 py-4 bg-black/60 backdrop-blur-md border border-sky-400/40 rounded-full text-[10px] font-black uppercase tracking-widest hover:bg-sky-400 hover:text-black transition-all disabled:opacity-50"
                >
                  {isGeneratingImage ? "Imagining World..." : "Generate AI Cover"}
                </button>
                <button 
                  onClick={() => setShowSettings(true)}
                  className="flex-1 px-6 py-4 bg-black/60 backdrop-blur-md border border-white/20 rounded-full text-[10px] font-black uppercase tracking-widest hover:bg-white/10 transition-all"
                >
                  Controls Config
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {gameState === 'CINEMA' && (
        <div className="absolute inset-0 bg-black z-[100] flex flex-col items-center justify-center p-8">
          <div className="absolute top-12 left-12">
            <h2 className="text-4xl font-black italic text-sky-400 tracking-tighter">THE_OTTER_LEGEND.MOV</h2>
          </div>
          
          <div className="w-full max-w-5xl aspect-video bg-zinc-900 rounded-[3rem] border border-sky-400/30 overflow-hidden relative shadow-[0_0_100px_rgba(56,189,248,0.1)]">
            {isGeneratingVideo ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-6">
                <div className="w-24 h-24 border-4 border-sky-400 border-t-transparent rounded-full animate-spin" />
                <p className="text-sky-400 font-mono text-sm tracking-widest uppercase animate-pulse">{loadingStep}</p>
                <div className="absolute bottom-12 text-[10px] text-white/20 uppercase tracking-[1em]">Generando Video via VEO 3.1</div>
              </div>
            ) : videoUrl ? (
              <video 
                src={videoUrl} 
                className="w-full h-full object-cover" 
                controls 
                autoPlay 
                loop 
              />
            ) : (
              <div className="flex items-center justify-center h-full text-white/40">Error en la simulación cinemática.</div>
            )}
          </div>

          <div className="mt-12 flex gap-6">
            <button 
              onClick={() => { setGameState('START'); setVideoUrl(null); }}
              className="px-12 py-5 bg-white text-black font-black uppercase tracking-widest rounded-full hover:scale-105 transition-transform"
            >
              Regresar al Inicio
            </button>
            {videoUrl && (
               <a 
               href={videoUrl} 
               download="OtterWay_Legend.mp4"
               className="px-12 py-5 bg-sky-500 text-black font-black uppercase tracking-widest rounded-full hover:scale-105 transition-transform flex items-center gap-2"
             >
               Descargar Memoria
             </a>
            )}
          </div>
        </div>
      )}

      {gameState === 'PLAYING' && (
        <>
          <div className="absolute top-4 sm:top-8 left-4 sm:left-8 flex flex-col gap-4 pointer-events-none scale-90 sm:scale-100 origin-top-left z-20">
            <div className={`bg-black/60 backdrop-blur-3xl p-6 sm:p-8 rounded-[2rem] sm:rounded-[3rem] border transition-all duration-500 ${hud.isBoosting ? 'border-sky-400 shadow-[0_0_50px_rgba(56,189,248,0.3)]' : 'border-white/10'}`}>
              <div className="flex justify-between items-end mb-6 sm:mb-8">
                <div>
                  <h2 className="text-2xl sm:text-3xl font-black tracking-tighter leading-none uppercase">Otter<span className="text-sky-400">_Way</span></h2>
                  <div className="flex items-center gap-2 mt-2">
                    <div className={`w-2 h-2 rounded-full ${hud.isBoosting ? 'bg-sky-400 animate-ping' : 'bg-green-500'}`} />
                    <p className="text-[9px] sm:text-[11px] text-white/40 uppercase tracking-widest font-bold">
                      {hud.isBoosting ? 'Sonic Dash Active' : 'Neural Link Stable'}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-4xl sm:text-5xl font-mono font-black tabular-nums tracking-tighter">{hud.score}</span>
                  <p className="text-[10px] sm:text-[11px] text-sky-400 uppercase font-black tracking-widest">Nano-Credits</p>
                </div>
              </div>

              <div className="space-y-6 sm:space-y-8">
                <div>
                  <div className="flex justify-between text-[10px] sm:text-[11px] font-black uppercase tracking-[0.3em] mb-3 opacity-60">
                    <span>Power Core</span>
                    <span className={hud.stamina < 30 ? 'text-red-500 animate-pulse' : ''}>{hud.stamina}%</span>
                  </div>
                  <div className="w-full sm:w-80 h-3 sm:h-4 bg-white/5 rounded-full overflow-hidden p-1 border border-white/10">
                    <div 
                      className={`h-full rounded-full transition-all duration-300 ${hud.stamina < 30 ? 'bg-red-500' : 'bg-gradient-to-r from-sky-400 to-blue-600 shadow-[0_0_20px_rgba(56,189,248,0.5)]'}`}
                      style={{ width: `${hud.stamina}%` }}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 sm:gap-6">
                  <div className="p-3 sm:p-4 bg-white/5 rounded-2xl sm:rounded-3xl border border-white/5">
                    <p className="text-[9px] sm:text-[10px] text-white/40 uppercase font-black mb-1">Mode</p>
                    <p className="text-xs sm:text-sm font-black text-sky-300 italic uppercase">{hud.state}</p>
                  </div>
                  <div className="p-3 sm:p-4 bg-white/5 rounded-2xl sm:rounded-3xl border border-white/5">
                    <p className="text-[9px] sm:text-[10px] text-white/40 uppercase font-black mb-1">Velocity</p>
                    <p className="text-xl sm:text-2xl font-mono font-black">{hud.speed}<span className="text-[10px] sm:text-[12px] ml-1 opacity-40">KM/H</span></p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="absolute top-4 sm:top-8 right-4 sm:right-8 w-64 sm:w-80 bg-black/40 backdrop-blur-2xl p-5 sm:p-6 rounded-[2rem] sm:rounded-[2.5rem] border border-sky-400/20 scale-90 sm:scale-100 origin-top-right z-20">
            <div className="flex items-center gap-4 mb-3 sm:mb-4 border-b border-white/5 pb-3 sm:pb-4">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-sky-500/10 flex items-center justify-center border border-sky-400/30">
                <span className="text-xl sm:text-2xl">⚡</span>
              </div>
              <div>
                <p className="text-[10px] sm:text-[11px] font-black text-sky-400 uppercase tracking-widest">Spirit AI</p>
                <p className="text-[8px] sm:text-[9px] text-white/30 uppercase">Hyper-Fluid Comms</p>
              </div>
            </div>
            <p className="text-sm sm:text-md font-bold leading-relaxed text-sky-100 italic">
              "{spiritMessage}"
            </p>
          </div>

          <button 
            onClick={handleGenerateCinema}
            className="absolute bottom-6 left-1/2 -translate-x-1/2 px-10 py-4 bg-sky-500/20 backdrop-blur-3xl border border-sky-400/50 rounded-full text-xs font-black uppercase tracking-[0.3em] hover:bg-sky-400 hover:text-black transition-all shadow-2xl z-30 flex items-center gap-3 group"
          >
            <span className="group-hover:animate-bounce">🎬</span> Generar Memoria VEO
          </button>

          <div className="absolute bottom-6 sm:bottom-12 right-6 sm:right-12 p-4 sm:p-6 bg-black/60 backdrop-blur-3xl rounded-full border border-sky-400/20 shadow-2xl scale-75 sm:scale-100 z-20">
            <canvas ref={radarRef} width="120" height="120" className="opacity-90" />
            <div className="absolute inset-0 rounded-full border border-sky-400/10 animate-ping pointer-events-none" />
          </div>
        </>
      )}

      {showSettings && (
        <div className="absolute inset-0 bg-black/80 backdrop-blur-xl z-[110] flex items-center justify-center p-4 font-mono">
          <div className="bg-zinc-900 border border-sky-400/30 rounded-[2rem] sm:rounded-[3rem] p-6 sm:p-10 w-full max-w-2xl shadow-[0_0_100px_rgba(56,189,248,0.2)] max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-8">
              <h2 className="text-3xl sm:text-4xl font-black italic text-sky-400 tracking-tighter uppercase">Neural_Maps</h2>
              <div className="flex gap-4">
                <button onClick={handleSelectKey} className="text-[9px] font-black text-sky-400/50 hover:text-sky-400 transition-colors uppercase tracking-widest">Change Key</button>
                <button onClick={() => setShowSettings(false)} className="text-white/40 hover:text-white transition-colors text-xs font-bold uppercase tracking-widest">Close [X]</button>
              </div>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {Object.entries(controls).map(([action, key]) => (
                <div key={action} className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5">
                  <span className="text-[10px] font-black text-sky-400 tracking-widest uppercase">{action}</span>
                  <input 
                    type="text" 
                    value={(key as string) === ' ' ? 'SPACE' : (key as string).toUpperCase()} 
                    readOnly
                    onClick={(e) => {
                      const input = e.target as HTMLInputElement;
                      input.value = "...";
                      const handler = (event: KeyboardEvent) => {
                        event.preventDefault();
                        updateControl(action as Action, event.key);
                        window.removeEventListener('keydown', handler);
                      };
                      window.addEventListener('keydown', handler);
                    }}
                    className="w-24 bg-sky-400/10 border border-sky-400/30 rounded-lg text-center py-2 text-xs font-mono font-bold text-white cursor-pointer hover:bg-sky-400/20 transition-colors"
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }
        .animate-float { animation: float 6s ease-in-out infinite; }
        @keyframes pulse-slow {
          0%, 100% { background-color: rgba(10, 10, 10, 1); }
          50% { background-color: rgba(12, 74, 110, 0.15); }
        }
      `}</style>
    </div>
  );
};

export default App;
