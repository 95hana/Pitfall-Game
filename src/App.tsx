import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Timer, RotateCcw, Sparkles, CloudRain, Volume2, VolumeX } from 'lucide-react';
import './App.css';

type GameState = 'playing' | 'won' | 'lost';

const HOLE_LABELS = ['A', 'B', 'C', 'D', 'E'];
const CONFETTI_COLORS = ['#fde047', '#f472b6', '#38bdf8', '#4ade80', '#c084fc', '#fb923c'];

export function App() {
  const [gameState, setGameState] = useState<GameState>('playing');
  const [timeLeft, setTimeLeft] = useState<number>(30);
  const [pitfallIndex, setPitfallIndex] = useState<number>(() => Math.floor(Math.random() * 5));
  const [selectedHole, setSelectedHole] = useState<number | null>(null);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [lossReason, setLossReason] = useState<'pitfall' | 'timeout' | null>(null);

  const audioCtxRef = useRef<AudioContext | null>(null);

  const getAudioContext = () => {
    if (!audioCtxRef.current) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      audioCtxRef.current = new AudioCtx();
    }
    if (audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume();
    }
    return audioCtxRef.current;
  };

  // カウントダウン音（残り10秒以下）
  const playTickSound = useCallback((seconds: number) => {
    if (isMuted) return;
    try {
      const ctx = getAudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(seconds <= 3 ? 880 : 660, ctx.currentTime);
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.15);
    } catch {
      // ユーザー操作前の自動再生制限を無視
    }
  }, [isMuted]);

  // ファンファーレ（勝利時）
  const playFanfare = useCallback(() => {
    if (isMuted) return;
    try {
      const ctx = getAudioContext();
      const notes = [
        { freq: 523.25, time: 0.0, dur: 0.15 }, // C5
        { freq: 659.25, time: 0.15, dur: 0.15 }, // E5
        { freq: 783.99, time: 0.3, dur: 0.15 }, // G5
        { freq: 1046.5, time: 0.45, dur: 0.6 }, // C6
      ];

      notes.forEach(({ freq, time, dur }) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, ctx.currentTime + time);
        gain.gain.setValueAtTime(0.25, ctx.currentTime + time);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + time + dur);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime + time);
        osc.stop(ctx.currentTime + time + dur);
      });
    } catch {
      // ignore
    }
  }, [isMuted]);

  // 悲しい音楽（敗北時）
  const playSadMusic = useCallback(() => {
    if (isMuted) return;
    try {
      const ctx = getAudioContext();
      const notes = [
        { freq: 392.0, time: 0.0, dur: 0.35 },  // G4
        { freq: 369.99, time: 0.35, dur: 0.35 }, // F#4
        { freq: 349.23, time: 0.7, dur: 0.35 },  // F4
        { freq: 329.63, time: 1.05, dur: 0.9 },  // E4
      ];

      notes.forEach(({ freq, time, dur }) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';

        // 音を少し柔らかくするローパスフィルタ
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(700, ctx.currentTime + time);

        osc.frequency.setValueAtTime(freq, ctx.currentTime + time);
        osc.frequency.linearRampToValueAtTime(freq * 0.97, ctx.currentTime + time + dur);

        gain.gain.setValueAtTime(0.18, ctx.currentTime + time);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + time + dur);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(ctx.destination);

        osc.start(ctx.currentTime + time);
        osc.stop(ctx.currentTime + time + dur);
      });
    } catch {
      // ignore
    }
  }, [isMuted]);

  // タイマー処理
  useEffect(() => {
    if (gameState !== 'playing') return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          setGameState('lost');
          setLossReason('timeout');
          playSadMusic();
          return 0;
        }
        const nextTime = prev - 1;
        if (nextTime <= 10) {
          playTickSound(nextTime);
        }
        return nextTime;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [gameState, playTickSound, playSadMusic]);

  // 穴を選んだときの処理
  const handleSelectHole = (index: number) => {
    if (gameState !== 'playing') return;
    setSelectedHole(index);

    if (index === pitfallIndex) {
      setGameState('lost');
      setLossReason('pitfall');
      playSadMusic();
    } else {
      setGameState('won');
      playFanfare();
    }
  };

  // ゲームのリセット
  const resetGame = () => {
    setGameState('playing');
    setTimeLeft(30);
    setPitfallIndex(Math.floor(Math.random() * 5));
    setSelectedHole(null);
    setLossReason(null);
  };

  return (
    <div className={`game-container ${gameState === 'lost' ? 'defeat-bg' : ''}`}>
      {/* 勝利時：キラキラテープ */}
      {gameState === 'won' && (
        <div className="confetti-layer">
          {Array.from({ length: 55 }).map((_, i) => {
            const left = `${(i * 19) % 100}%`;
            const delay = `${(i % 10) * 0.25}s`;
            const duration = `${2.2 + (i % 5) * 0.4}s`;
            const color = CONFETTI_COLORS[i % CONFETTI_COLORS.length];
            return (
              <div
                key={i}
                className="confetti-piece"
                style={{
                  left,
                  backgroundColor: color,
                  animationDelay: delay,
                  animationDuration: duration,
                  boxShadow: `0 0 8px ${color}`,
                }}
              />
            );
          })}
        </div>
      )}

      {/* 敗北時：曇り空と雨 */}
      {gameState === 'lost' && (
        <div className="weather-layer">
          <div className="cloud" style={{ left: '8%' }} />
          <div className="cloud" style={{ right: '10%', top: '10%', animationDelay: '-5s' }} />
          <div className="cloud" style={{ left: '42%', top: '3%', animationDelay: '-9s' }} />
          {Array.from({ length: 65 }).map((_, i) => (
            <div
              key={i}
              className="raindrop"
              style={{
                left: `${(i * 17) % 100}%`,
                animationDelay: `${(i % 12) * 0.12}s`,
                animationDuration: `${0.65 + (i % 4) * 0.15}s`,
              }}
            />
          ))}
        </div>
      )}

      <main className="game-card">
        <header className="game-header">
          <h1 className="game-title">
            {gameState === 'won' && <Sparkles size={26} color="#eab308" />}
            {gameState === 'lost' && <CloudRain size={26} color="#4b5563" />}
            落とし穴チャレンジ
          </h1>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <button
              onClick={() => setIsMuted(!isMuted)}
              aria-label="音量切り替え"
              style={{
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                color: '#6b7280',
                display: 'flex',
                alignItems: 'center',
              }}
            >
              {isMuted ? <VolumeX size={22} /> : <Volume2 size={22} />}
            </button>

            <div className={`timer-badge ${gameState === 'playing' && timeLeft <= 10 ? 'urgent' : ''}`}>
              <Timer size={20} />
              <span>{timeLeft}秒</span>
            </div>
          </div>
        </header>

        {/* ステータスメッセージ */}
        <p className="status-message">
          {gameState === 'playing' && (
            timeLeft <= 10
              ? `急いで！残り ${timeLeft} 秒！安全な穴を選んで！`
              : '5つの穴のうち1つが落とし穴！安全な道を選んで通過しよう'
          )}
          {gameState === 'won' && '🎉 見事通過！ファンファーレと共にクリアおめでとう！ 🎉'}
          {gameState === 'lost' && (
            lossReason === 'timeout'
              ? '☔ 時間切れ…冷たい雨が降ってきた…'
              : '☔ 落とし穴に落ちてしまった…'
          )}
        </p>

        {/* 5つのカラフルな穴 */}
        <div className="holes-grid">
          {HOLE_LABELS.map((label, index) => {
            const isPitfall = index === pitfallIndex;
            const isSelected = index === selectedHole;

            let extraClass = '';
            if (gameState !== 'playing') {
              if (isPitfall) {
                extraClass = 'revealed-pitfall';
              } else if (isSelected) {
                extraClass = 'revealed-safe';
              } else {
                extraClass = 'dimmed';
              }
            }

            return (
              <button
                key={label}
                className={`hole-btn hole-color-${index} ${extraClass}`}
                onClick={() => handleSelectHole(index)}
                disabled={gameState !== 'playing'}
              >
                {gameState === 'playing' ? (
                  <span>穴 {label}</span>
                ) : isPitfall ? (
                  <>
                    <span style={{ fontSize: '1.5rem' }}>🕳️</span>
                    <span style={{ fontSize: '0.85rem', color: '#fca5a5' }}>落とし穴</span>
                  </>
                ) : (
                  <>
                    <span style={{ fontSize: '1.4rem' }}>{isSelected ? '✨' : '⭕'}</span>
                    <span style={{ fontSize: '0.85rem' }}>{isSelected ? '通過！' : '安全'}</span>
                  </>
                )}
              </button>
            );
          })}
        </div>

        {/* リトライボタン */}
        {gameState !== 'playing' && (
          <button className="action-btn" onClick={resetGame}>
            <RotateCcw size={20} />
            もう一度挑戦する
          </button>
        )}
      </main>
    </div>
  );
}

export default App;