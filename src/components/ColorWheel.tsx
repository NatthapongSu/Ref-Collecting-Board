import React, { useRef, useEffect, useState } from 'react';

interface ColorWheelProps {
  hue: number;
  saturation: number;
  lightness: number;
  onChange: (h: number, s: number, l: number) => void;
  size?: number;
  mode?: 'hsl' | 'hsv';
}

const ColorWheel: React.FC<ColorWheelProps> = ({ hue, saturation, lightness, onChange, size = 220, mode = 'hsl' }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [dragging, setDragging] = useState<'wheel' | 'square' | null>(null);

  const center = size / 2;
  const outerRadius = size / 2 - 4;
  const innerRadius = outerRadius - 22;

  // Square dimensions
  const squareSize = (innerRadius - 8) * Math.sqrt(2) * 0.85;
  const squareLeft = center - squareSize / 2;
  const squareTop = center - squareSize / 2;

  // Draw the wheel whenever props change
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, size, size);

    // Draw hue wheel
    for (let angle = 0; angle < 360; angle++) {
      const startAngle = (angle - 1) * Math.PI / 180;
      const endAngle = (angle + 1) * Math.PI / 180;
      ctx.beginPath();
      ctx.arc(center, center, outerRadius, startAngle, endAngle);
      ctx.arc(center, center, innerRadius, endAngle, startAngle, true);
      ctx.closePath();
      ctx.fillStyle = `hsl(${angle}, 100%, 50%)`;
      ctx.fill();
    }

    // Draw square with pixel-perfect rendering
    const imageData = ctx.createImageData(Math.ceil(squareSize), Math.ceil(squareSize));
    const data = imageData.data;
    
    // Convert current HSL to HSV for display
    const sNorm = saturation / 100;
    const lNorm = lightness / 100;
    const v = lNorm + sNorm * Math.min(lNorm, 1 - lNorm);
    const sHsv = v === 0 ? 0 : 2 * (1 - lNorm / v);
    const currentHsv = { h: hue, s: sHsv * 100, v: v * 100 };
    
    for (let py = 0; py < squareSize; py++) {
      for (let px = 0; px < squareSize; px++) {
        const s = (px / squareSize) * 100;
        
        let r: number, g: number, b: number;
        
        if (mode === 'hsv') {
          // HSV mode: Y-axis is Value (100% top to 0% bottom)
          const v = (1 - py / squareSize) * 100;
          [r, g, b] = hsvToRgb(hue, s, v);
        } else {
          // HSL mode: Y-axis is Lightness (100% top to 0% bottom)
          const l = (1 - py / squareSize) * 100;
          [r, g, b] = hslToRgb(hue, s, l);
        }
        
        const idx = (py * Math.ceil(squareSize) + px) * 4;
        data[idx] = r;
        data[idx + 1] = g;
        data[idx + 2] = b;
        data[idx + 3] = 255;
      }
    }
    
    ctx.putImageData(imageData, squareLeft, squareTop);

    // Draw square border
    ctx.beginPath();
    ctx.rect(squareLeft, squareTop, squareSize, squareSize);
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Draw hue indicator on wheel
    const hueAngle = hue * Math.PI / 180;
    const indicatorR = (outerRadius + innerRadius) / 2;
    const ix = center + Math.cos(hueAngle) * indicatorR;
    const iy = center + Math.sin(hueAngle) * indicatorR;
    ctx.beginPath();
    ctx.arc(ix, iy, 8, 0, Math.PI * 2);
    ctx.fillStyle = '#fff';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(ix, iy, 6, 0, Math.PI * 2);
    ctx.fillStyle = `hsl(${hue}, 100%, 50%)`;
    ctx.fill();

    // Draw SL indicator in square
    const slPos = mode === 'hsv' 
      ? getHSVPosition(squareLeft, squareTop, squareSize, currentHsv.s, currentHsv.v)
      : getSLPosition(squareLeft, squareTop, squareSize, saturation, lightness);
    ctx.beginPath();
    ctx.arc(slPos.x, slPos.y, 7, 0, Math.PI * 2);
    ctx.fillStyle = '#fff';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(slPos.x, slPos.y, 5, 0, Math.PI * 2);
    ctx.fillStyle = `hsl(${hue}, ${saturation}%, ${lightness}%)`;
    ctx.fill();
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1;
    ctx.stroke();
  }, [hue, saturation, lightness, size, center, outerRadius, innerRadius, squareLeft, squareTop, squareSize]);

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

    if (dist >= innerRadius && dist <= outerRadius) {
      setDragging('wheel');
      updateHue(pos);
    } else if (pos.x >= squareLeft && pos.x <= squareLeft + squareSize &&
               pos.y >= squareTop && pos.y <= squareTop + squareSize) {
      setDragging('square');
      updateSL(pos);
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!dragging) return;
    const pos = getMousePos(e);
    if (dragging === 'wheel') {
      updateHue(pos);
    } else if (dragging === 'square') {
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
    onChange(Math.round(angle), saturation, lightness);
  };

  const updateSL = (pos: { x: number; y: number }) => {
    // Saturation: left = 0%, right = 100%
    const s = Math.max(0, Math.min(100, ((pos.x - squareLeft) / squareSize) * 100));
    
    if (mode === 'hsv') {
      // Value: top = 100%, bottom = 0%
      const v = Math.max(0, Math.min(100, (1 - (pos.y - squareTop) / squareSize) * 100));
      // Convert HSV to HSL
      const vNorm = v / 100;
      const sNorm = s / 100;
      const l = vNorm * (1 - sNorm / 2);
      const lHsl = (l === 0 || l === 1) ? 0 : (vNorm - l) / Math.min(l, 1 - l);
      onChange(hue, Math.round(lHsl * 100), Math.round(l * 100));
    } else {
      // Lightness: top = 100%, bottom = 0%
      const l = Math.max(0, Math.min(100, (1 - (pos.y - squareTop) / squareSize) * 100));
      onChange(hue, Math.round(s), Math.round(l));
    }
  };

  return (
    <canvas
      ref={canvasRef}
      width={size}
      height={size}
      className="cursor-crosshair"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    />
  );
};

function getSLPosition(squareLeft: number, squareTop: number, squareSize: number, s: number, l: number) {
  // Top-left: S=0% L=100%, Top-right: S=100% L=100%
  // Bottom-left: S=0% L=0%, Bottom-right: S=100% L=0%
  const x = squareLeft + (s / 100) * squareSize;
  const y = squareTop + (1 - l / 100) * squareSize;
  return { x, y };
}

function getHSVPosition(squareLeft: number, squareTop: number, squareSize: number, s: number, v: number) {
  // Saturation: 0 at left, 100 at right
  // Value: 100 at top, 0 at bottom
  const x = squareLeft + (s / 100) * squareSize;
  const y = squareTop + (1 - v / 100) * squareSize;
  return { x, y };
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  h = h % 360;
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

function hsvToRgb(h: number, s: number, v: number): [number, number, number] {
  h = h % 360;
  s /= 100;
  v /= 100;
  
  const c = v * s;
  const x = c * (1 - Math.abs((h / 60) % 2 - 1));
  const m = v - c;
  
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
