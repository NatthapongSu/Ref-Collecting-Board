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

    // Draw square inside
    ctx.save();
    ctx.beginPath();
    ctx.rect(squareLeft, squareTop, squareSize, squareSize);
    ctx.clip();

    // Base hue color
    ctx.fillStyle = `hsl(${hue}, 100%, 50%)`;
    ctx.fillRect(squareLeft, squareTop, squareSize, squareSize);

    // White gradient (left to right for saturation)
    const gradWhite = ctx.createLinearGradient(squareLeft, 0, squareLeft + squareSize, 0);
    gradWhite.addColorStop(0, 'rgba(255,255,255,1)');
    gradWhite.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = gradWhite;
    ctx.fillRect(squareLeft, squareTop, squareSize, squareSize);

    // Black gradient (top to bottom for lightness)
    const gradBlack = ctx.createLinearGradient(0, squareTop, 0, squareTop + squareSize);
    gradBlack.addColorStop(0, 'rgba(0,0,0,0)');
    gradBlack.addColorStop(1, 'rgba(0,0,0,1)');
    ctx.fillStyle = gradBlack;
    ctx.fillRect(squareLeft, squareTop, squareSize, squareSize);

    ctx.restore();

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
    // Saturation: left (white) = 0, right (hue) = 100
    const s = Math.max(0, Math.min(100, ((pos.x - squareLeft) / squareSize) * 100));
    // Lightness: top (light) = 100, bottom (dark) = 0
    const l = Math.max(0, Math.min(100, (1 - (pos.y - squareTop) / squareSize) * 100));
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
  // Map saturation (0-100) and lightness (0-100) to square coordinates
  // Saturation: 0 (white) at left, 100 (pure hue) at right
  // Lightness: 100 (light) at top, 0 (black) at bottom
  const x = squareLeft + (s / 100) * squareSize;
  const y = squareTop + (1 - l / 100) * squareSize;
  return { x, y };
}

export default ColorWheel;
