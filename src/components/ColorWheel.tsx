import React, { useRef, useEffect, useState, useCallback } from 'react';

interface ColorWheelProps {
  hue: number;
  saturation: number;
  lightness: number;
  onChange: (h: number, s: number, l: number) => void;
  size?: number;
}

const ColorWheel: React.FC<ColorWheelProps> = ({ hue, saturation, lightness, onChange, size = 240 }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [dragging, setDragging] = useState<'wheel' | 'triangle' | null>(null);
  const draggingRef = useRef<'wheel' | 'triangle' | null>(null);
  
  const center = size / 2;
  const outerRadius = size / 2 - 6;
  const innerRadius = outerRadius - 20;
  
  // Triangle: right = pure hue, top-left = white, bottom-left = black
  const triRadius = (innerRadius - 10) * 0.92;
  const triRight = { x: center + triRadius, y: center };
  const triTopLeft = { x: center - triRadius * 0.5, y: center - triRadius * 0.866 };
  const triBottomLeft = { x: center - triRadius * 0.5, y: center + triRadius * 0.866 };

  // Keep ref in sync
  useEffect(() => {
    draggingRef.current = dragging;
  }, [dragging]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    if (canvas.width !== size * dpr) {
      canvas.width = size * dpr;
      canvas.height = size * dpr;
      canvas.style.width = size + 'px';
      canvas.style.height = size + 'px';
      ctx.scale(dpr, dpr);
    }

    ctx.clearRect(0, 0, size, size);

    // === Draw hue wheel with smooth rendering ===
    // Use imageData for pixel-perfect hue ring
    const wheelImageData = ctx.createImageData(size, size);
    const data = wheelImageData.data;
    
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const dx = x - center;
        const dy = y - center;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        if (dist >= innerRadius - 1 && dist <= outerRadius + 1) {
          let angle = Math.atan2(dy, dx) * 180 / Math.PI;
          if (angle < 0) angle += 360;
          
          const [r, g, b] = hslToRgbRaw(angle, 100, 50);
          
          // Anti-alias edges
          let alpha = 255;
          if (dist < innerRadius) {
            alpha = Math.round(255 * (dist - (innerRadius - 1)));
          } else if (dist > outerRadius) {
            alpha = Math.round(255 * ((outerRadius + 1) - dist));
          }
          
          const idx = (y * size + x) * 4;
          data[idx] = r;
          data[idx + 1] = g;
          data[idx + 2] = b;
          data[idx + 3] = alpha;
        }
      }
    }
    ctx.putImageData(wheelImageData, 0, 0);

    // === Draw triangle with proper HSL gradients ===
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(triRight.x, triRight.y);
    ctx.lineTo(triTopLeft.x, triTopLeft.y);
    ctx.lineTo(triBottomLeft.x, triBottomLeft.y);
    ctx.closePath();
    ctx.clip();

    // Layer 1: Pure hue fill
    ctx.fillStyle = `hsl(${hue}, 100%, 50%)`;
    ctx.fillRect(0, 0, size, size);

    // Layer 2: White gradient from top-left edge
    // Creates desaturation effect
    const whiteGrad = ctx.createLinearGradient(
      triRight.x, triRight.y,
      (triTopLeft.x + triBottomLeft.x) / 2, center
    );
    whiteGrad.addColorStop(0, 'rgba(255,255,255,0)');
    whiteGrad.addColorStop(1, 'rgba(255,255,255,1)');
    ctx.fillStyle = whiteGrad;
    ctx.fillRect(0, 0, size, size);

    // Layer 3: Black gradient from bottom
    const blackGrad = ctx.createLinearGradient(
      0, triTopLeft.y,
      0, triBottomLeft.y
    );
    blackGrad.addColorStop(0, 'rgba(0,0,0,0)');
    blackGrad.addColorStop(1, 'rgba(0,0,0,1)');
    ctx.fillStyle = blackGrad;
    ctx.fillRect(0, 0, size, size);

    ctx.restore();

    // === Triangle border with shadow ===
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.2)';
    ctx.shadowBlur = 4;
    ctx.beginPath();
    ctx.moveTo(triRight.x, triRight.y);
    ctx.lineTo(triTopLeft.x, triTopLeft.y);
    ctx.lineTo(triBottomLeft.x, triBottomLeft.y);
    ctx.closePath();
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();

    // === Hue indicator on wheel ===
    const hueAngle = hue * Math.PI / 180;
    const indicatorR = (outerRadius + innerRadius) / 2;
    const ix = center + Math.cos(hueAngle) * indicatorR;
    const iy = center + Math.sin(hueAngle) * indicatorR;
    
    // Outer ring
    ctx.beginPath();
    ctx.arc(ix, iy, 9, 0, Math.PI * 2);
    ctx.fillStyle = '#fff';
    ctx.shadowColor = 'rgba(0,0,0,0.3)';
    ctx.shadowBlur = 4;
    ctx.fill();
    ctx.shadowBlur = 0;
    
    // Inner color
    ctx.beginPath();
    ctx.arc(ix, iy, 6.5, 0, Math.PI * 2);
    ctx.fillStyle = `hsl(${hue}, 100%, 50%)`;
    ctx.fill();

    // === SL indicator in triangle ===
    const slPos = slToTrianglePos(saturation, lightness);
    
    // Shadow
    ctx.beginPath();
    ctx.arc(slPos.x, slPos.y, 9, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    ctx.fill();
    
    // White outer ring
    ctx.beginPath();
    ctx.arc(slPos.x, slPos.y, 8, 0, Math.PI * 2);
    ctx.fillStyle = '#fff';
    ctx.fill();
    
    // Current color inner
    ctx.beginPath();
    ctx.arc(slPos.x, slPos.y, 5.5, 0, Math.PI * 2);
    ctx.fillStyle = `hsl(${hue}, ${saturation}%, ${lightness}%)`;
    ctx.fill();
    
    // Thin dark border for visibility on light colors
    ctx.beginPath();
    ctx.arc(slPos.x, slPos.y, 5.5, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(0,0,0,0.3)';
    ctx.lineWidth = 0.5;
    ctx.stroke();

  }, [hue, saturation, lightness, size, center, outerRadius, innerRadius, triRight, triTopLeft, triBottomLeft]);

  useEffect(() => {
    draw();
  }, [draw]);

  // Convert SL to triangle position using barycentric coordinates
  const slToTrianglePos = (s: number, l: number) => {
    // Map: saturation 0-100, lightness 0-100
    // Right vertex (pure hue): s=100, l=50
    // Top-left vertex (white): s=0, l=100
    // Bottom-left vertex (black): s=0, l=0
    
    // Using barycentric interpolation
    // w0 = weight for right (pure hue) = s/100 when l=50, adjusted for lightness
    // w1 = weight for top-left (white)
    // w2 = weight for bottom-left (black)
    
    const sNorm = s / 100;
    const lNorm = l / 100;
    
    // At s=100, l=50: pure hue (right point)
    // At s=0, l=100: white (top-left)
    // At s=0, l=0: black (bottom-left)
    
    // Weight for pure hue corner
    const w0 = sNorm;
    // Remaining weight split between white and black based on lightness
    const remaining = 1 - w0;
    const w1 = remaining * lNorm; // white
    const w2 = remaining * (1 - lNorm); // black
    
    const x = triRight.x * w0 + triTopLeft.x * w1 + triBottomLeft.x * w2;
    const y = triRight.y * w0 + triTopLeft.y * w1 + triBottomLeft.y * w2;
    
    return { x, y };
  };

  // Convert triangle position to SL using barycentric coordinates
  const trianglePosToSL = (px: number, py: number) => {
    const x0 = triRight.x, y0 = triRight.y;
    const x1 = triTopLeft.x, y1 = triTopLeft.y;
    const x2 = triBottomLeft.x, y2 = triBottomLeft.y;
    
    // Barycentric coordinate calculation
    const denom = (y1 - y2) * (x0 - x2) + (x2 - x1) * (y0 - y2);
    if (Math.abs(denom) < 1e-10) return { s: 50, l: 50 };
    
    const w0 = ((y1 - y2) * (px - x2) + (x2 - x1) * (py - y2)) / denom;
    const w1 = ((y2 - y0) * (px - x2) + (x0 - x2) * (py - y2)) / denom;
    const w2 = 1 - w0 - w1;
    
    // Clamp weights to valid range
    const cw0 = Math.max(0, Math.min(1, w0));
    const cw1 = Math.max(0, Math.min(1, w1));
    const cw2 = Math.max(0, Math.min(1, w2));
    
    // Normalize so they sum to 1
    const sum = cw0 + cw1 + cw2;
    const nw0 = cw0 / sum;
    const nw1 = cw1 / sum;
    const nw2 = cw2 / sum;
    
    // nw0 = saturation, nw1 = lightness factor, nw2 = darkness factor
    const s = Math.round(nw0 * 100);
    const l = Math.round(nw1 / (nw1 + nw2) * 100);
    
    return { s: Math.max(0, Math.min(100, s)), l: Math.max(0, Math.min(100, l)) };
  };

  const getMousePos = (e: React.MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    const pos = getMousePos(e);
    const dx = pos.x - center;
    const dy = pos.y - center;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist >= innerRadius - 2 && dist <= outerRadius + 2) {
      setDragging('wheel');
      updateHue(pos);
    } else if (isPointInTriangle(pos)) {
      setDragging('triangle');
      updateSL(pos);
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!draggingRef.current) return;
    const pos = getMousePos(e);
    if (draggingRef.current === 'wheel') {
      updateHue(pos);
    } else if (draggingRef.current === 'triangle') {
      updateSL(pos);
    }
  };

  const handleMouseUp = () => {
    setDragging(null);
  };

  const updateHue = (pos: { x: number; y: number }) => {
    const dx = pos.x - center;
    const dy = pos.y - center;
    let angle = Math.atan2(dy, dx) * 180 / Math.PI;
    if (angle < 0) angle += 360;
    onChange(Math.round(angle) % 360, saturation, lightness);
  };

  const updateSL = (pos: { x: number; y: number }) => {
    const result = trianglePosToSL(pos.x, pos.y);
    onChange(hue, result.s, result.l);
  };

  const isPointInTriangle = (p: { x: number; y: number }) => {
    const d1 = sign(p, triRight, triTopLeft);
    const d2 = sign(p, triTopLeft, triBottomLeft);
    const d3 = sign(p, triBottomLeft, triRight);
    const hasNeg = (d1 < 0) || (d2 < 0) || (d3 < 0);
    const hasPos = (d1 > 0) || (d2 > 0) || (d3 > 0);
    return !(hasNeg && hasPos);
  };

  const sign = (p1: {x:number,y:number}, p2: {x:number,y:number}, p3: {x:number,y:number}) => {
    return (p1.x - p3.x) * (p2.y - p3.y) - (p2.x - p3.x) * (p1.y - p3.y);
  };

  // Compute current color for preview
  const currentColor = `hsl(${hue}, ${saturation}%, ${lightness}%)`;

  return (
    <div className="flex flex-col items-center gap-3">
      <canvas
        ref={canvasRef}
        style={{ width: size, height: size }}
        className="cursor-crosshair"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      />
      
      {/* Color preview strip */}
      <div className="flex items-center gap-2 w-full px-2">
        <div
          className="w-10 h-10 rounded-lg shadow-inner border border-gray-200 flex-shrink-0"
          style={{ backgroundColor: currentColor }}
        />
        <div className="flex-1 min-w-0">
          <div className="text-[10px] text-gray-400 uppercase tracking-wide">Selected</div>
          <div className="text-xs font-mono text-gray-700 truncate">
            H:{hue}° S:{saturation}% L:{lightness}%
          </div>
        </div>
      </div>
    </div>
  );
};

// Raw HSL to RGB without rounding (for pixel rendering)
function hslToRgbRaw(h: number, s: number, l: number): [number, number, number] {
  h = ((h % 360) + 360) % 360;
  s /= 100;
  l /= 100;
  
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs((h / 60) % 2 - 1));
  const m = l - c / 2;
  
  let r = 0, g = 0, b = 0;
  if (h < 60) { r = c; g = x; }
  else if (h < 120) { r = x; g = c; }
  else if (h < 180) { g = c; b = x; }
  else if (h < 240) { g = x; b = c; }
  else if (h < 300) { r = x; b = c; }
  else { r = c; b = x; }
  
  return [
    Math.round((r + m) * 255),
    Math.round((g + m) * 255),
    Math.round((b + m) * 255)
  ];
}

export default ColorWheel;
