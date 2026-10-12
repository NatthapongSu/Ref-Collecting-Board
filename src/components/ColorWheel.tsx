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
  const [dragging, setDragging] = useState<'wheel' | 'triangle' | null>(null);
  
  const center = size / 2;
  const outerRadius = size / 2 - 4;
  const innerRadius = outerRadius - 22;
  
  // Triangle dimensions - pointing right
  const triRadius = (innerRadius - 8) * 0.9;
  // Right point (pure hue), top-left (white), bottom-left (black)
  const triRight = { x: center + triRadius, y: center };
  const triTopLeft = { x: center - triRadius * 0.5, y: center - triRadius * 0.866 };
  const triBottomLeft = { x: center - triRadius * 0.5, y: center + triRadius * 0.866 };

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

    // Draw triangle inside
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(triRight.x, triRight.y);
    ctx.lineTo(triTopLeft.x, triTopLeft.y);
    ctx.lineTo(triBottomLeft.x, triBottomLeft.y);
    ctx.closePath();
    ctx.clip();

    // Base hue color
    ctx.fillStyle = `hsl(${hue}, 100%, 50%)`;
    ctx.fillRect(0, 0, size, size);

    // White gradient (from right to top-left)
    const gradWhite = ctx.createLinearGradient(triRight.x, triRight.y, triTopLeft.x, triTopLeft.y);
    gradWhite.addColorStop(0, 'rgba(255,255,255,0)');
    gradWhite.addColorStop(1, 'rgba(255,255,255,1)');
    ctx.fillStyle = gradWhite;
    ctx.fillRect(0, 0, size, size);

    // Black gradient (from right to bottom-left)
    const gradBlack = ctx.createLinearGradient(triRight.x, triRight.y, triBottomLeft.x, triBottomLeft.y);
    gradBlack.addColorStop(0, 'rgba(0,0,0,0)');
    gradBlack.addColorStop(1, 'rgba(0,0,0,1)');
    ctx.fillStyle = gradBlack;
    ctx.fillRect(0, 0, size, size);

    ctx.restore();

    // Draw triangle border
    ctx.beginPath();
    ctx.moveTo(triRight.x, triRight.y);
    ctx.lineTo(triTopLeft.x, triTopLeft.y);
    ctx.lineTo(triBottomLeft.x, triBottomLeft.y);
    ctx.closePath();
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

    // Draw SL indicator in triangle
    const slPos = getSLPosition(triRight, triTopLeft, triBottomLeft, saturation, lightness);
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
  }, [hue, saturation, lightness, size, center, outerRadius, innerRadius, triRight, triTopLeft, triBottomLeft]);

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
    } else if (isPointInTriangle(pos, triRight, triTopLeft, triBottomLeft)) {
      setDragging('triangle');
      updateSL(pos);
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!dragging) return;
    const pos = getMousePos(e);
    if (dragging === 'wheel') {
      updateHue(pos);
    } else if (dragging === 'triangle') {
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
    // Map position to saturation and lightness using bounding box
    // Left = 0% saturation, Right = 100% saturation
    // Top = 100% lightness, Bottom = 0% lightness
    
    const minX = triTopLeft.x;
    const maxX = triRight.x;
    const minY = triTopLeft.y;
    const maxY = triBottomLeft.y;
    
    const s = Math.max(0, Math.min(100, ((pos.x - minX) / (maxX - minX)) * 100));
    const l = Math.max(0, Math.min(100, (1 - (pos.y - minY) / (maxY - minY)) * 100));
    
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

function getSLPosition(triRight: {x: number, y: number}, triTopLeft: {x: number, y: number}, triBottomLeft: {x: number, y: number}, s: number, l: number) {
  // Map saturation (0-100) and lightness (0-100) to bounding box coordinates
  // Left = 0% saturation, Right = 100% saturation
  // Top = 100% lightness, Bottom = 0% lightness
  
  const minX = triTopLeft.x;
  const maxX = triRight.x;
  const minY = triTopLeft.y;
  const maxY = triBottomLeft.y;
  
  const x = minX + (s / 100) * (maxX - minX);
  const y = minY + (1 - l / 100) * (maxY - minY);
  
  return { x, y };
}

function isPointInTriangle(p: {x: number, y: number}, a: {x: number, y: number}, b: {x: number, y: number}, c: {x: number, y: number}) {
  const d1 = sign(p, a, b);
  const d2 = sign(p, b, c);
  const d3 = sign(p, c, a);

  const hasNeg = (d1 < 0) || (d2 < 0) || (d3 < 0);
  const hasPos = (d1 > 0) || (d2 > 0) || (d3 > 0);

  return !(hasNeg && hasPos);
}

function sign(p1: {x: number, y: number}, p2: {x: number, y: number}, p3: {x: number, y: number}) {
  return (p1.x - p3.x) * (p2.y - p3.y) - (p2.x - p3.x) * (p1.y - p3.y);
}

export default ColorWheel;
