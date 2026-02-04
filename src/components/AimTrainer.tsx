'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { FaCrosshairs } from 'react-icons/fa';
import { Timestamp } from 'firebase/firestore';
import { saveAimSession } from '@/lib/aimSessions';
import { XCircle, Activity } from 'lucide-react';

type GameMode = 'normal' | 'drag-drop' | 'dual-targets' | 'moving-targets';

interface Target {
  id: number;
  x: number;
  y: number;
  size: number;
  createdAt: number;
  lifetime: number; // Target lifetime (ms)
  isDragging?: boolean;
  dragOffsetX?: number;
  dragOffsetY?: number;
  velocityX?: number;
  velocityY?: number;
}

interface AimTrainerProps {
  userEmail?: string;
}

export default function AimTrainer({ userEmail }: AimTrainerProps) {
  const [targets, setTargets] = useState<Target[]>([]);
  const [score, setScore] = useState(0);
  const [misses, setMisses] = useState(0);
  const [time, setTime] = useState(0);
  const [isActive, setIsActive] = useState(false);
  const [level, setLevel] = useState(1);
  const [accuracy, setAccuracy] = useState(100);
  const [expiredTargets, setExpiredTargets] = useState(0); // Expired targets count
  const [gameOver, setGameOver] = useState(false);
  const [gameMode, setGameMode] = useState<GameMode>('normal');
  const [draggedTarget, setDraggedTarget] = useState<number | null>(null);
  const [sessionStartTime, setSessionStartTime] = useState<Timestamp | null>(null);
  const isSessionSavingRef = useRef(false);
  const hasSessionBeenSavedRef = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const targetIdRef = useRef(0);
  const spawnIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const timeIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Target size based on difficulty level
  const getTargetSize = (currentLevel: number) => {
    // Target gets smaller as level increases (min 40px, max 80px)
    return Math.max(40, 80 - currentLevel * 3);
  };

  // Time-based spawn rate calculation
  // Start: 2 targets per second (every 500ms)
  // At 30 seconds: 10 targets per second (every 100ms)
  const getSpawnInterval = (currentTime: number) => {
    // Linear increase: decreases from 500ms to 100ms (in 30 seconds)
    const maxTime = 30; // 30 seconds
    const startInterval = 500; // Start: 500ms (2 per second)
    const endInterval = 100; // At 30 seconds: 100ms (10 per second)

    if (currentTime >= maxTime) {
      return endInterval; // Maximum speed after 30 seconds
    }

    // Linear interpolation
    const progress = currentTime / maxTime;
    const interval = startInterval - (startInterval - endInterval) * progress;

    return Math.max(endInterval, Math.round(interval));
  };

  const getTargetLifetime = (currentLevel: number) => {
    // Targets disappear faster as level increases (min 2000ms, max 4000ms)
    return Math.max(2000, 4000 - currentLevel * 150);
  };

  // Create random target
  const createTarget = useCallback((count: number = 1) => {
    if (!containerRef.current || gameOver) return;

    const container = containerRef.current;
    const containerRect = container.getBoundingClientRect();
    const size = getTargetSize(level);
    const padding = 20;

    const newTargets: Target[] = [];

    for (let i = 0; i < count; i++) {
      const x = Math.random() * (containerRect.width - size - padding * 2) + padding;
      const y = Math.random() * (containerRect.height - size - padding * 2) + padding;

      const newTarget: Target = {
        id: targetIdRef.current++,
        x,
        y,
        size,
        createdAt: Date.now(),
        lifetime: getTargetLifetime(level),
        velocityX: gameMode === 'moving-targets' ? (Math.random() - 0.5) * 2 : undefined,
        velocityY: gameMode === 'moving-targets' ? (Math.random() - 0.5) * 2 : undefined,
      };

      newTargets.push(newTarget);
    }

    setTargets((prev) => [...prev, ...newTargets]);
  }, [level, gameOver, gameMode]);

  // Accuracy calculation
  const updateAccuracy = useCallback(() => {
    // Use functional updates to get latest values
    setScore((currentScore) => {
      setMisses((currentMisses) => {
        const total = currentScore + currentMisses + 1;
        const newAccuracy = total > 0 ? ((currentScore + 1) / total) * 100 : 100;
        setAccuracy(Math.round(newAccuracy * 10) / 10);
        return currentMisses;
      });
      return currentScore;
    });
  }, []);

  // Drop target handler for drag-drop mode
  const handleDropTarget = useCallback((targetId: number) => {
    if (gameMode !== 'drag-drop' || gameOver) return;

    setTargets((prev) => prev.filter((t) => t.id !== targetId));
    setScore((prev) => {
      const newScore = prev + 1;
      if (newScore % 10 === 0) {
        setLevel((prevLevel) => prevLevel + 1);
      }
      return newScore;
    });
    updateAccuracy();
  }, [gameMode, gameOver, updateAccuracy]);

  // Target click handler
  const handleTargetClick = (targetId: number) => {
    if (gameOver || gameMode === 'drag-drop') return;

    setTargets((prev) => prev.filter((t) => t.id !== targetId));
    setScore((prev) => {
      const newScore = prev + 1;
      // Level up every 10 points
      if (newScore % 10 === 0) {
        setLevel((prevLevel) => prevLevel + 1);
      }
      return newScore;
    });
    updateAccuracy();
  };

  // Drag handlers for drag-drop mode
  const handleMouseDown = (e: React.MouseEvent, targetId: number) => {
    if (gameMode !== 'drag-drop' || gameOver) return;

    e.stopPropagation();
    e.preventDefault();
    const target = targets.find(t => t.id === targetId);
    if (!target || !containerRef.current) return;

    const container = containerRef.current.getBoundingClientRect();
    const offsetX = e.clientX - container.left - target.x;
    const offsetY = e.clientY - container.top - target.y;

    setDraggedTarget(targetId);
    setTargets((prev) => prev.map(t =>
      t.id === targetId
        ? { ...t, isDragging: true, dragOffsetX: offsetX, dragOffsetY: offsetY }
        : t
    ));
  };

  // Global mouse move handler
  useEffect(() => {
    if (gameMode !== 'drag-drop' || !draggedTarget || !containerRef.current) return;

    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;

      const container = containerRef.current.getBoundingClientRect();

      setTargets((prev) => {
        const target = prev.find(t => t.id === draggedTarget);
        if (!target) return prev;

        const newX = e.clientX - container.left - (target.dragOffsetX || 0);
        const newY = e.clientY - container.top - (target.dragOffsetY || 0);

        return prev.map(t =>
          t.id === draggedTarget
            ? { ...t, x: Math.max(0, Math.min(container.width - t.size, newX)), y: Math.max(0, Math.min(container.height - t.size, newY)) }
            : t
        );
      });
    };

    document.addEventListener('mousemove', handleGlobalMouseMove);
    return () => document.removeEventListener('mousemove', handleGlobalMouseMove);
  }, [draggedTarget, gameMode]);

  // Global mouse up handler
  useEffect(() => {
    if (gameMode !== 'drag-drop' || !draggedTarget) return;

    const handleGlobalMouseUp = () => {
      if (!containerRef.current) return;

      setTargets((prev) => {
        const target = prev.find(t => t.id === draggedTarget);
        if (!target) {
          setDraggedTarget(null);
          return prev;
        }

        // Check if target is in drop zone
        const container = containerRef.current!.getBoundingClientRect();
        const centerX = container.width / 2;
        const centerY = container.height / 2;
        const targetCenterX = target.x + target.size / 2;
        const targetCenterY = target.y + target.size / 2;
        const distance = Math.sqrt(
          Math.pow(targetCenterX - centerX, 2) + Math.pow(targetCenterY - centerY, 2)
        );
        const dropZoneRadius = 80; // Increased drop zone radius

        if (distance < dropZoneRadius) {
          // Target is in drop zone - score!
          handleDropTarget(draggedTarget);
        }

        setDraggedTarget(null);
        return prev.map(t =>
          t.id === draggedTarget
            ? { ...t, isDragging: false, dragOffsetX: undefined, dragOffsetY: undefined }
            : t
        );
      });
    };

    document.addEventListener('mouseup', handleGlobalMouseUp);
    return () => document.removeEventListener('mouseup', handleGlobalMouseUp);
  }, [draggedTarget, gameMode, handleDropTarget]);

  // Target expiration check and movement update
  useEffect(() => {
    if (!isActive || gameOver) return;

    const checkInterval = setInterval(() => {
      const now = Date.now();
      setTargets((prev) => {
        // Update moving targets position
        const updated = prev.map((target) => {
          if (gameMode === 'moving-targets' && target.velocityX !== undefined && target.velocityY !== undefined && containerRef.current) {
            const container = containerRef.current.getBoundingClientRect();
            let newX = target.x + (target.velocityX || 0);
            let newY = target.y + (target.velocityY || 0);

            // Bounce off walls
            if (newX <= 0 || newX >= container.width - target.size) {
              newX = Math.max(0, Math.min(container.width - target.size, newX));
              return { ...target, x: newX, velocityX: -(target.velocityX || 0) };
            }
            if (newY <= 0 || newY >= container.height - target.size) {
              newY = Math.max(0, Math.min(container.height - target.size, newY));
              return { ...target, y: newY, velocityY: -(target.velocityY || 0) };
            }

            return { ...target, x: newX, y: newY };
          }
          return target;
        });

        const expired = updated.filter((target) => {
          const age = now - target.createdAt;
          return age >= target.lifetime;
        });

        if (expired.length > 0) {
          setExpiredTargets((prevExpired) => {
            const newExpired = prevExpired + expired.length;
            // Game over when 3 targets expire
            if (newExpired >= 3) {
              setGameOver(true);
              stopGame();
            }
            return newExpired;
          });
        }

        return updated.filter((target) => {
          const age = now - target.createdAt;
          return age < target.lifetime;
        });
      });
    }, 50); // Check every 50ms

    return () => clearInterval(checkInterval);
  }, [isActive, gameOver, gameMode]);

  // Container click (miss)
  const handleContainerClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget && gameMode !== 'drag-drop') {
      setMisses((prev) => prev + 1);
      updateAccuracy();
    }
  };

  // Save session to database
  const saveSessionToDatabase = useCallback(async (
    finalScore: number,
    finalMisses: number,
    finalExpired: number,
    finalAccuracy: number,
    finalLevel: number
  ) => {
    if (!sessionStartTime || !userEmail || isSessionSavingRef.current) {
      return;
    }

    isSessionSavingRef.current = true;
    const endTime = Timestamp.now();
    const totalDuration = endTime.toMillis() - sessionStartTime.toMillis();
    const totalDurationSeconds = Math.round(totalDuration / 1000);

    const session = {
      email: userEmail,
      startTime: sessionStartTime,
      endTime,
      totalDuration,
      totalDurationSeconds,
      gameMode,
      score: finalScore,
      misses: finalMisses,
      expiredTargets: finalExpired,
      accuracy: finalAccuracy,
      level: finalLevel,
    };

    try {
      const result = await saveAimSession(session);
      if (result.error) {
        console.error('Error saving aim session:', result.error);
      } else {
        console.log('Aim session saved successfully:', result.id);
      }
    } catch (error) {
      console.error('Error saving aim session:', error);
    } finally {
      isSessionSavingRef.current = false;
    }
  }, [sessionStartTime, userEmail, gameMode]);

  // Start game
  const startGame = () => {
    setIsActive(true);
    setScore(0);
    setMisses(0);
    setTime(0);
    setLevel(1);
    setTargets([]);
    setExpiredTargets(0);
    setGameOver(false);
    setAccuracy(100);
    isSessionSavingRef.current = false;
    hasSessionBeenSavedRef.current = false;
    targetIdRef.current = 0;

    // Record session start time
    const startTime = Timestamp.now();
    setSessionStartTime(startTime);

    // Timer
    timeIntervalRef.current = setInterval(() => {
      setTime((prev) => prev + 1);
    }, 1000);

    // Set initial spawn interval (at time 0)
    const initialSpawnInterval = getSpawnInterval(0);
    spawnIntervalRef.current = setInterval(() => {
      if (containerRef.current && !gameOver) {
        const spawnCount = gameMode === 'dual-targets' ? 2 : 1;
        createTarget(spawnCount);
      }
    }, initialSpawnInterval);
  };

  // Stop game
  const stopGame = () => {
    setIsActive(false);
    if (spawnIntervalRef.current) {
      clearInterval(spawnIntervalRef.current);
      spawnIntervalRef.current = null;
    }
    if (timeIntervalRef.current) {
      clearInterval(timeIntervalRef.current);
      timeIntervalRef.current = null;
    }
    setTargets([]);
    setDraggedTarget(null);

    // Save session if game was active and not already saving (only if manually stopped, not game over)
    if (!gameOver && sessionStartTime && userEmail && !isSessionSavingRef.current && !hasSessionBeenSavedRef.current && time > 0) {
      hasSessionBeenSavedRef.current = true;
      setTimeout(() => {
        saveSessionToDatabase(score, misses, expiredTargets, accuracy, level);
      }, 100);
    }
  };

  // Save session when game ends (only once when gameOver becomes true)
  useEffect(() => {
    if (gameOver && sessionStartTime && userEmail && !isSessionSavingRef.current && !hasSessionBeenSavedRef.current) {
      hasSessionBeenSavedRef.current = true;

      // Use a small delay to ensure all state updates are complete
      const timer = setTimeout(() => {
        // Get current values at the time of saving
        setScore((currentScore) => {
          setMisses((currentMisses) => {
            setExpiredTargets((currentExpired) => {
              setAccuracy((currentAccuracy) => {
                setLevel((currentLevel) => {
                  saveSessionToDatabase(
                    currentScore,
                    currentMisses,
                    currentExpired,
                    currentAccuracy,
                    currentLevel
                  );
                  return currentLevel;
                });
                return currentAccuracy;
              });
              return currentExpired;
            });
            return currentMisses;
          });
          return currentScore;
        });
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [gameOver, sessionStartTime, userEmail, saveSessionToDatabase]);

  // Reset game
  const resetGame = () => {
    stopGame();
    setScore(0);
    setMisses(0);
    setTime(0);
    setLevel(1);
    setAccuracy(100);
    setExpiredTargets(0);
    setGameOver(false);
    setDraggedTarget(null);
  };

  // Update spawn rate as time changes
  useEffect(() => {
    if (isActive && spawnIntervalRef.current && !gameOver) {
      clearInterval(spawnIntervalRef.current);
      const spawnInterval = getSpawnInterval(time);
      spawnIntervalRef.current = setInterval(() => {
        if (containerRef.current && !gameOver) {
          const spawnCount = gameMode === 'dual-targets' ? 2 : 1;
          createTarget(spawnCount);
        }
      }, spawnInterval);
    }
  }, [time, isActive, gameOver, createTarget, gameMode]);

  // Component unmount olduğunda temizlik
  useEffect(() => {
    return () => {
      if (spawnIntervalRef.current) {
        clearInterval(spawnIntervalRef.current);
      }
      if (timeIntervalRef.current) {
        clearInterval(timeIntervalRef.current);
      }
    };
  }, []);

  // Format time (mm:ss)
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Game mode descriptions
  const modeDescriptions: Record<GameMode, string> = {
    'normal': 'Click targets to score points',
    'drag-drop': 'Drag targets to the center to score',
    'dual-targets': 'Two targets spawn at once',
    'moving-targets': 'Targets move around the screen',
  };

  return (
    <div className="w-full max-w-6xl mx-auto space-y-8">
      {/* Statistics Header */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
        {[
          { label: 'Xal', value: score, color: 'text-white' },
          { label: 'Səhv', value: misses, color: 'text-red-400' },
          { label: 'Qaçırılan', value: `${expiredTargets}/3`, color: 'text-orange-400' },
          { label: 'Dəqiqlik', value: `${accuracy}%`, color: 'text-[#00965e]' },
          { label: 'Vaxt', value: formatTime(time), color: 'text-blue-400' },
          { label: 'Mərhələ', value: level, color: 'text-purple-400' },
        ].map((stat, i) => (
          <div key={i} className="bg-white/5 backdrop-blur-xl rounded-2xl p-4 border border-white/10 shadow-xl transition-transform hover:scale-105">
            <div className="text-[10px] font-black text-white/30 uppercase tracking-[2px] mb-1">{stat.label}</div>
            <div className={`text-2xl font-black italic tracking-tighter ${stat.color}`}>{stat.value}</div>
          </div>
        ))}
      </div>

      {/* Control Actions & Mode Selection */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-6 bg-white/5 backdrop-blur-xl p-6 rounded-[32px] border border-white/10 shadow-2xl">
        <div className="flex flex-wrap gap-2 justify-center md:justify-start">
          {(['normal', 'drag-drop', 'dual-targets', 'moving-targets'] as GameMode[]).map((mode) => (
            <button
              key={mode}
              disabled={isActive}
              onClick={() => setGameMode(mode)}
              className={`px-4 py-2 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all ${gameMode === mode
                ? 'bg-[#00965e] text-white shadow-[0_0_20px_rgba(0,150,94,0.3)]'
                : 'bg-white/5 text-white/40 hover:bg-white/10 hover:text-white border border-transparent hover:border-white/10'
                } ${isActive ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {mode.replace('-', ' ')}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-4">
          {!isActive ? (
            <button
              onClick={startGame}
              className="px-10 py-3.5 bg-[#00965e] hover:bg-[#007a4d] text-white font-black uppercase tracking-[3px] text-[13px] rounded-2xl transition-all shadow-lg hover:shadow-[#00965e]/25 active:scale-95"
            >
              BAŞLA
            </button>
          ) : (
            <button
              onClick={stopGame}
              className="px-10 py-3.5 bg-red-500 hover:bg-red-600 text-white font-black uppercase tracking-[3px] text-[13px] rounded-2xl transition-all shadow-lg hover:shadow-red-500/25 active:scale-95"
            >
              DAYANDIR
            </button>
          )}
          <button
            onClick={resetGame}
            className="w-12 h-12 bg-white/5 border border-white/10 flex items-center justify-center rounded-2xl text-white/40 hover:text-white hover:bg-white/10 transition-all active:rotate-180"
          >
            <FaCrosshairs size={20} className="rotate-45" />
          </button>
        </div>
      </div>

      {/* Game Area */}
      <div
        ref={containerRef}
        onClick={handleContainerClick}
        className="relative bg-black/40 backdrop-blur-sm rounded-[40px] shadow-2xl border-4 border-white/5 overflow-hidden cursor-crosshair group perspective-1000"
        style={{ height: '600px', minHeight: '600px' }}
      >
        {/* Decorative Grid */}
        <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ backgroundImage: 'radial-gradient(#ffffff 1px, transparent 1px)', backgroundSize: '40px 40px' }}></div>

        {/* Drop zone for drag-drop mode */}
        {gameMode === 'drag-drop' && isActive && (
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-48 h-48 border-4 border-dashed border-[#00965e]/30 rounded-full flex flex-col items-center justify-center bg-[#00965e]/5 animate-pulse z-0">
            <div className="w-20 h-20 rounded-full border-2 border-[#00965e]/40 flex items-center justify-center mb-2">
              <FaCrosshairs className="text-[#00965e]/60 text-3xl" />
            </div>
            <span className="text-[#00965e] font-black uppercase tracking-[3px] text-[11px]">HƏDƏF ZONASI</span>
          </div>
        )}

        {!isActive && targets.length === 0 && !gameOver && (
          <div className="absolute inset-0 flex items-center justify-center z-10">
            <div className="text-center animate-in zoom-in-50 duration-500">
              <div className="w-24 h-24 bg-gradient-to-tr from-[#00965e] to-[#4fbfa3] rounded-[32px] flex items-center justify-center mx-auto mb-8 shadow-2xl rotate-12">
                <FaCrosshairs className="text-white text-5xl" />
              </div>
              <h3 className="text-3xl font-black text-white mb-2 uppercase tracking-tighter italic">HAZIRSAN?</h3>
              <p className="text-white/30 font-bold uppercase tracking-widest text-sm">
                Başlamaq üçün &quot;BAŞLA&quot; düyməsini sıxın
              </p>
              <div className="mt-6 px-6 py-2 bg-white/5 border border-white/10 rounded-full inline-block">
                <span className="text-[10px] font-black text-[#00965e] uppercase tracking-[3px]">{modeDescriptions[gameMode]}</span>
              </div>
            </div>
          </div>
        )}

        {gameOver && (
          <div className="absolute inset-0 flex items-center justify-center bg-[#0a0a0a]/90 backdrop-blur-xl z-[100] animate-in fade-in duration-500">
            <div className="text-center max-w-md w-full p-12 bg-white/5 border border-white/10 rounded-[48px] shadow-2xl">
              <div className="w-20 h-20 bg-red-500/20 text-red-500 rounded-full flex items-center justify-center mx-auto mb-8 animate-bounce">
                <XCircle size={48} />
              </div>
              <h3 className="text-[42px] font-black text-white mb-2 tracking-tighter uppercase italic leading-none">
                OYUN BİTDİ!
              </h3>
              <p className="text-white/40 font-bold uppercase tracking-widest text-sm mb-10">
                3 hədəf qaçırıldı
              </p>

              <div className="grid grid-cols-2 gap-4 mb-10">
                <div className="bg-white/5 p-5 rounded-3xl border border-white/10">
                  <div className="text-[10px] font-black text-white/30 uppercase tracking-[2px] mb-1">Yekun Xal</div>
                  <div className="text-3xl font-black text-[#00965e] italic">{score}</div>
                </div>
                <div className="bg-white/5 p-5 rounded-3xl border border-white/10">
                  <div className="text-[10px] font-black text-white/30 uppercase tracking-[2px] mb-1">Zaman</div>
                  <div className="text-3xl font-black text-blue-400 italic">{formatTime(time)}</div>
                </div>
              </div>

              <button
                onClick={startGame}
                className="w-full py-5 bg-[#00965e] text-white rounded-3xl font-black uppercase tracking-[4px] text-sm hover:bg-[#007a4d] transition-all shadow-lg hover:shadow-[#00965e]/25 active:scale-95"
              >
                YENİDƏN BAŞLA
              </button>
            </div>
          </div>
        )}

        {targets.map((target) => {
          const now = Date.now();
          const age = now - target.createdAt;
          const progress = age / target.lifetime; // 0 to 1

          let scale: number;
          if (gameMode === 'drag-drop') {
            if (progress < 0.5) {
              scale = 0.3 + (progress * 2 * 0.7); // 0.3 to 1.0
            } else {
              scale = 2 - (progress * 2);
            }
          } else {
            if (progress < 0.5) {
              scale = progress * 2;
            } else {
              scale = 2 - (progress * 2);
            }
          }

          const isInDropZone = gameMode === 'drag-drop' && containerRef.current && draggedTarget === target.id && (() => {
            const container = containerRef.current!.getBoundingClientRect();
            const centerX = container.width / 2;
            const centerY = container.height / 2;
            const targetCenterX = target.x + target.size / 2;
            const targetCenterY = target.y + target.size / 2;
            const distance = Math.sqrt(
              Math.pow(targetCenterX - centerX, 2) + Math.pow(targetCenterY - centerY, 2)
            );
            return distance < 80;
          })();

          return (
            <button
              key={target.id}
              onMouseDown={(e) => {
                e.stopPropagation();
                handleMouseDown(e, target.id);
              }}
              onClick={(e) => {
                e.stopPropagation();
                if (gameMode !== 'drag-drop') {
                  handleTargetClick(target.id);
                }
              }}
              className={`absolute rounded-[20px] transition-all bg-gradient-to-tr from-[#00965e] to-[#4fbfa3] shadow-2xl flex items-center justify-center border-2 border-white/20 ${gameMode === 'drag-drop'
                ? 'cursor-grab active:cursor-grabbing select-none'
                : 'cursor-crosshair hover:brightness-125 active:scale-90'
                } ${isInDropZone ? 'ring-8 ring-[#00965e]/30 scale-110 !border-[#00965e]' : ''
                }`}
              style={{
                left: `${target.x}px`,
                top: `${target.y}px`,
                width: `${target.size}px`,
                height: `${target.size}px`,
                transform: `scale(${scale}) ${target.velocityX ? `rotate(${age / 10}deg)` : ''}`,
                opacity: progress > 0.8 ? (1 - progress) * 5 : 1,
                transformOrigin: 'center',
                zIndex: target.isDragging ? 1000 : 1,
              }}
              aria-label="Target"
            >
              <div className="absolute inset-0 rounded-[18px] border-4 border-white/10 flex items-center justify-center">
                <div className="w-1.5 h-1.5 bg-white rounded-full shadow-[0_0_10px_white]"></div>
              </div>
              <FaCrosshairs
                className="text-white/40"
                style={{ fontSize: `${target.size * 0.6}px` }}
              />
            </button>
          );
        })}
      </div>

      {/* Info Tip */}
      <div className="flex justify-center">
        <div className="inline-flex items-center gap-4 px-8 py-3 bg-white/5 backdrop-blur-md rounded-2xl border border-white/10">
          <Activity size={18} className="text-[#00965e]" />
          <p className="text-[12px] font-bold text-white/40 uppercase tracking-widest leading-none">
            Məsləhət: Hədəflər tədricən kiçilir. 3 hədəfi qaçırtsanız simulyasiya dayanır!
          </p>
        </div>
      </div>
    </div>
  );
}
