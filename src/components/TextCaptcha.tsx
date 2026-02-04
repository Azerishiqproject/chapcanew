'use client';

import { useState, useRef, useEffect } from 'react';

interface TextCaptchaProps {
  onVerify?: (isCorrect: boolean) => void;
}

function generateRandomText(length: number = 5): string {
  const chars = 'abcdefghijkmnpqrstuvwxyz23456789'; // Lowercase and numbers
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export default function TextCaptcha({ onVerify }: TextCaptchaProps) {
  const [userInput, setUserInput] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [captchaText, setCaptchaText] = useState<string>(() => generateRandomText(5));

  useEffect(() => {
    if (!canvasRef.current || !captchaText) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = 280;
    const height = 80;
    canvas.width = width;
    canvas.height = height;

    // 1. Background Gradient (Gray to White)
    const bgGrad = ctx.createLinearGradient(0, 0, width, 0);
    bgGrad.addColorStop(0, '#c0c0c0');
    bgGrad.addColorStop(1, '#ffffff');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // 2. Background Noise (Subtle scratches)
    ctx.strokeStyle = 'rgba(0,0,0,0.1)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 15; i++) {
      ctx.beginPath();
      ctx.moveTo(Math.random() * width, Math.random() * height);
      ctx.lineTo(Math.random() * width, Math.random() * height);
      ctx.stroke();
    }

    // 3. Draw Text
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 44px "Courier New", Courier, monospace'; // Monospaced for consistent spacing

    const chars = captchaText.split('');
    const startX = 40;
    const charSpacing = 45;

    chars.forEach((char, i) => {
      ctx.save();
      const x = startX + i * charSpacing;
      const y = height / 2 + (Math.random() - 0.5) * 15;

      ctx.translate(x, y);
      ctx.rotate((Math.random() - 0.5) * 0.4);

      // Multi-layer stroke for "textured" look
      ctx.fillStyle = '#000000';
      ctx.shadowBlur = 1;
      ctx.shadowColor = 'rgba(0,0,0,0.5)';
      ctx.fillText(char, 0, 0);

      // Extra jitter line for specific characters
      if (Math.random() > 0.5) {
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-10, (Math.random() - 0.5) * 20);
        ctx.lineTo(10, (Math.random() - 0.5) * 20);
        ctx.stroke();
      }

      ctx.restore();
    });

    // 4. Overlapping Messy Lines (The main distortion from the image)
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    const drawMessyLine = () => {
      ctx.beginPath();
      let x = 10;
      let y = height / 2 + (Math.random() - 0.5) * 30;
      ctx.moveTo(x, y);

      const segments = 5;
      for (let i = 0; i < segments; i++) {
        x += width / segments;
        y += (Math.random() - 0.5) * 40;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    };

    drawMessyLine();
    if (Math.random() > 0.5) drawMessyLine();

    // 5. Some extra scratchy noise dots
    for (let i = 0; i < 30; i++) {
      ctx.fillStyle = 'rgba(0,0,0,0.2)';
      ctx.fillRect(Math.random() * width, Math.random() * height, 2, 2);
    }

  }, [captchaText]);

  const handleVerify = () => {
    if (userInput.toLowerCase() === captchaText.toLowerCase()) {
      onVerify?.(true);
    } else {
      setError('Mətn düzgün daxil edilməyib');
      setTimeout(() => {
        setUserInput('');
        setError(null);
        setCaptchaText(generateRandomText(5));
      }, 1500);
    }
  };

  const DigitBox = ({ value }: { value: string }) => (
    <div className="flex flex-col items-center">
      <div className="w-12 h-14 bg-white border border-gray-100 rounded-md shadow-sm flex items-center justify-center text-[20px] font-bold text-gray-800 relative lowercase">
        {value ? value : <span className="absolute bottom-3 text-gray-300 font-normal">_</span>}
      </div>
    </div>
  );

  return (
    <div className="w-full font-sans bg-transparent h-full flex flex-col pt-6 px-5">
      {/* Remove Top Gradient Overlay that causes design error */}

      <h3 className="text-[16px] font-black uppercase tracking-tight text-white mb-6 relative z-10 leading-snug">
        Şəkildəki mətni daxil edin:
      </h3>

      <div className="flex justify-center mb-8 relative z-10 rounded-2xl overflow-hidden p-2 bg-white/5 border border-white/10 shadow-2xl">
        <canvas ref={canvasRef} className="rounded-xl border border-white/10 shadow-inner" />
      </div>

      {/* Input Area */}
      <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-4 mb-10 relative z-10 shadow-2xl">
        <div className="flex justify-center items-end gap-3 px-0">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex flex-col items-center">
              <div className="w-14 h-16 bg-white/10 border border-white/10 rounded-xl shadow-inner flex items-center justify-center text-2xl font-black text-[#00965e] relative lowercase">
                {userInput[i] ? userInput[i] : <span className="absolute bottom-4 text-white/20 font-normal">_</span>}
              </div>
            </div>
          ))}
        </div>

        <input
          type="text"
          value={userInput}
          onChange={(e) => {
            setError(null);
            if (e.target.value.length <= 5) setUserInput(e.target.value);
          }}
          className="absolute inset-0 opacity-0 cursor-default"
          autoFocus
        />

        {error && (
          <div className="absolute -bottom-8 left-0 right-0 text-center text-red-500 text-sm font-black uppercase tracking-wider transition-all">
            {error}
          </div>
        )}
      </div>

      <button
        onClick={handleVerify}
        disabled={userInput.length < 5}
        className="w-full h-14 bg-gradient-to-r from-[#00965e] to-[#4fbfa3] text-white font-black uppercase tracking-wider rounded-2xl shadow-xl shadow-[#00965e]/20 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:shadow-none relative z-10 mt-auto border border-white/10"
      >
        Təsdiqlə
      </button>
    </div>
  );
}
