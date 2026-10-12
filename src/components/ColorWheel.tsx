import React, { useRef, useEffect, useState } from 'react';

interface ColorWheelProps {
  hue: number;
  saturation: number;
  lightness: number;
  onChange: (h: number, s: number, l: number) => void;
  size?: number;
}

const ColorWheel: React.FC<ColorWheelProps> = ({ hue, saturation, lightness, onChange, size = 220 }) => {
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

    // Draw square with pixel-perfect HSL rendering
    // Top-left: L=100% (white), Top-right: L=0% (black)
    // Bottom-left: L=50%, S=0% (gray), Bottom-right: L=50%, S=100% (pure hue)
    const imageData = ctx.createImageData(Math.ceil(squareSize), Math.ceil(squareSize));
    const data = imageData.data;
    
    for (let py = 0; py < squareSize; py++) {
      for (let px = 0; px < squareSize; px++) {
        // Horizontal: lightness from 100% (left) to 0% (right)
        const l = 100 * (1 - px / squareSize);
        // Vertical: saturation from 0% (top) to 100% (bottom)
        const s = (py / squareSize) * 100;
        
        // Convert HSL to RGB
        const [r, g, b] = hslToRgb(hue, s, l);
        
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
    const slPos = getSLPosition(squareLeft, squareTop, squareSize, saturation, lightness);
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
    // Horizontal: lightness from 100% (left) to 0% (right)
    const l = Math.max(0, Math.min(100, (1 - (pos.x - squareLeft) / squareSize) * 100));
    // Vertical: saturation from 0% (top) to 100% (bottom)
    const s = Math.max(0, Math.min(100, ((pos.y - squareTop) / squareSize) * 100));
    onChange(hue, Math.round(s), Math.round(l));
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
  // Map saturation and lightness to square coordinates
  // Horizontal: lightness from 100% (left) to 0% (right)
  // Vertical: saturation from 0% (top) to 100% (bottom)
  const x = squareLeft + (1 - l / 100) * squareSize;
  const y = squareTop + (s / 100) * squareSize;
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

export default ColorWheel;
