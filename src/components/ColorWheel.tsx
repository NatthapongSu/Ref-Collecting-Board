import React, { useRef, useEffect, useState, useCallback } from 'react';

interface ColorWheelProps {
  hue: number;
  saturation: number;
  lightness: number;
  onChange: (h: number, s: number, l: number) => void;
  size?: number;
}

interface Point {
  x: number;
  y: number;
}

// Helper functions (outside component)
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

function isPointInTriangle(p: Point, v0: Point, v1: Point, v2: Point): boolean {
  const d1 = sign(p, v0, v1);
  const d2 = sign(p, v1, v2);
  const d3 = sign(p, v2, v0);
  const hasNeg = (d1 < 0) || (d2 < 0) || (d3 < 0);
  const hasPos = (d1 > 0) || (d2 > 0) || (d3 > 0);
  return !(hasNeg && hasPos);
}

function sign(p1: Point, p2: Point, p3: Point): number {
  return (p1.x - p3.x) * (p2.y - p3.y) - (p2.x - p3.x) * (p1.y - p3.y);
}

function trianglePosToSL(px: number, py: number, triRight: Point, triTopLeft: Point, triBottomLeft: Point) {
  const x0 = triRight.x, y0 = triRight.y;
  const x1 = triTopLeft.x, y1 = triTopLeft.y;
  const x2 = triBottomLeft.x, y2 = triBottomLeft.y;
  
  const denom = (y1 - y2) * (x0 - x2) + (x2 - x1) * (y0 - y2);
  if (Math.abs(denom) < 1e-10) return { s: 50, l: 50 };
  
  const w0 = ((y1 - y2) * (px - x2) + (x2 - x1) * (py - y2)) / denom;
  const w1 = ((y2 - y0) * (px - x2) + (x0 - x2) * (py - y2)) / denom;
  const w2 = 1 - w0 - w1;
  
  const cw0 = Math.max(0, Math.min(1, w0));
  const cw1 = Math.max(0, Math.min(1, w1));
  const cw2 = Math.max(0, Math.min(1, w2));
  
  const sum = cw0 + cw1 + cw2;
  const nw0 = cw0 / sum;
  const nw1 = cw1 / sum;
  const nw2 = cw2 / sum;
  
  const s = Math.round(nw0 * 100);
  
  // Handle edge case: at right vertex (pure hue), lightness is 50%
  let l: number;
  if (nw1 + nw2 < 1e-10) {
    l = 50; // Pure hue has 50% lightness
  } else {
    l = Math.round(nw1 / (nw1 + nw2) * 100);
  }
  
  return { s: Math.max(0, Math.min(100, s)), l: Math.max(0, Math.min(100, l)) };
}

function slToTrianglePos(s: number, l: number, triRight: Point, triTopLeft: Point, triBottomLeft: Point): Point {
  const sNorm = s / 100;
  const lNorm = l / 100;
  
  const w0 = sNorm;
  const remaining = 1 - w0;
  const w1 = remaining * lNorm;
  const w2 = remaining * (1 - lNorm);
  
  const x = triRight.x * w0 + triTopLeft.x * w1 + triBottomLeft.x * w2;
  const y = triRight.y * w0 + triTopLeft.y * w1 + triBottomLeft.y * w2;
  
  return { x, y };
}

const ColorWheel: React.FC<ColorWheelProps> = ({ hue, saturation, lightness, onChange, size = 240 }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [dragging, setDragging] = useState<'wheel' | 'triangle' | null>(null);
  const draggingRef = useRef<'wheel' | 'triangle' | null>(null);
  const wheelCacheRef = useRef<ImageData | null>(null);
  
  const center = size / 2;
  const outerRadius = size / 2 - 6;
  const innerRadius = outerRadius - 20;
  
  const triRadius = (innerRadius - 10) * 0.92;
  const triRight = { x: center + triRadius, y: center };
  const triTopLeft = { x: center - triRadius * 0.5, y: center - triRadius * 0.866 };
  const triBottomLeft = { x: center - triRadius * 0.5, y: center + triRadius * 0.866 };

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

    // === Draw hue wheel (cached) ===
    if (!wheelCacheRef.current) {
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
      wheelCacheRef.current = wheelImageData;
    }
    ctx.putImageData(wheelCacheRef.current, 0, 0);

    // === Draw triangle with pixel-perfect rendering ===
    const triImageData = ctx.createImageData(size, size);
    const triData = triImageData.data;
    
    const minX = Math.floor(Math.min(triRight.x, triTopLeft.x, triBottomLeft.x));
    const maxX = Math.ceil(Math.max(triRight.x, triTopLeft.x, triBottomLeft.x));
    const minY = Math.floor(Math.min(triRight.y, triTopLeft.y, triBottomLeft.y));
    const maxY = Math.ceil(Math.max(triRight.y, triTopLeft.y, triBottomLeft.y));
    
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const point = { x, y };
        
        if (!isPointInTriangle(point, triRight, triTopLeft, triBottomLeft)) continue;
        
        const sl = trianglePosToSL(x, y, triRight, triTopLeft, triBottomLeft);
        const [r, g, b] = hslToRgbRaw(hue, sl.s, sl.l);
        
        const idx = (y * size + x) * 4;
        triData[idx] = r;
        triData[idx + 1] = g;
        triData[idx + 2] = b;
        triData[idx + 3] = 255;
      }
    }
    
    ctx.putImageData(triImageData, 0, 0);

    // === Triangle border ===
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

    // === Hue indicator ===
    const hueAngle = hue * Math.PI / 180;
    const indicatorR = (outerRadius + innerRadius) / 2;
    const ix = center + Math.cos(hueAngle) * indicatorR;
    const iy = center + Math.sin(hueAngle) * indicatorR;
    
    ctx.beginPath();
    ctx.arc(ix, iy, 9, 0, Math.PI * 2);
    ctx.fillStyle = '#fff';
    ctx.shadowColor = 'rgba(0,0,0,0.3)';
    ctx.shadowBlur = 4;
    ctx.fill();
    ctx.shadowBlur = 0;
    
    ctx.beginPath();
    ctx.arc(ix, iy, 6.5, 0, Math.PI * 2);
    ctx.fillStyle = `hsl(${hue}, 100%, 50%)`;
    ctx.fill();

    // === SL indicator ===
    const slPos = slToTrianglePos(saturation, lightness, triRight, triTopLeft, triBottomLeft);
    
    ctx.beginPath();
    ctx.arc(slPos.x, slPos.y, 9, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    ctx.fill();
    
    ctx.beginPath();
    ctx.arc(slPos.x, slPos.y, 8, 0, Math.PI * 2);
    ctx.fillStyle = '#fff';
    ctx.fill();
    
    ctx.beginPath();
    ctx.arc(slPos.x, slPos.y, 5.5, 0, Math.PI * 2);
    ctx.fillStyle = `hsl(${hue}, ${saturation}%, ${lightness}%)`;
    ctx.fill();
    
    ctx.beginPath();
    ctx.arc(slPos.x, slPos.y, 5.5, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(0,0,0,0.3)';
    ctx.lineWidth = 0.5;
    ctx.stroke();

  }, [hue, saturation, lightness, size, center, outerRadius, innerRadius, triRight, triTopLeft, triBottomLeft]);

  useEffect(() => {
    draw();
  }, [draw]);

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
    } else if (isPointInTriangle(pos, triRight, triTopLeft, triBottomLeft)) {
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

  const updateHue = (pos: Point) => {
    const dx = pos.x - center;
    const dy = pos.y - center;
    let angle = Math.atan2(dy, dx) * 180 / Math.PI;
    if (angle < 0) angle += 360;
    onChange(Math.round(angle) % 360, saturation, lightness);
  };

  const updateSL = (pos: Point) => {
    const result = trianglePosToSL(pos.x, pos.y, triRight, triTopLeft, triBottomLeft);
    onChange(hue, result.s, result.l);
  };

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

export default ColorWheel;
