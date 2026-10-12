import React, { useRef, useEffect, useState, useCallback } from 'react';

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

  const drawWheel = useCallback(() => {
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
    const triRadius = innerRadius - 8;
    const triPoints = getTrianglePoints(center, center, triRadius, hue);

    // Fill triangle with gradient
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(triPoints[0].x, triPoints[0].y);
    ctx.lineTo(triPoints[1].x, triPoints[1].y);
    ctx.lineTo(triPoints[2].x, triPoints[2].y);
    ctx.closePath();
    ctx.clip();

    // Create gradient for saturation (from center to edges)
    const gradWhite = ctx.createLinearGradient(
      triPoints[1].x, triPoints[1].y,
      triPoints[0].x, triPoints[0].y
    );
    gradWhite.addColorStop(0, 'rgba(255,255,255,1)');
    gradWhite.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = `hsl(${hue}, 100%, 50%)`;
    ctx.fillRect(0, 0, size, size);
    ctx.fillStyle = gradWhite;
    ctx.fillRect(0, 0, size, size);

    // Black gradient for lightness
    const gradBlack = ctx.createLinearGradient(
      (triPoints[0].x + triPoints[1].x) / 2,
      (triPoints[0].y + triPoints[1].y) / 2,
      triPoints[2].x, triPoints[2].y
    );
    gradBlack.addColorStop(0, 'rgba(0,0,0,0)');
    gradBlack.addColorStop(1, 'rgba(0,0,0,1)');
    ctx.fillStyle = gradBlack;
    ctx.fillRect(0, 0, size, size);

    ctx.restore();

    // Draw triangle border
    ctx.beginPath();
    ctx.moveTo(triPoints[0].x, triPoints[0].y);
    ctx.lineTo(triPoints[1].x, triPoints[1].y);
    ctx.lineTo(triPoints[2].x, triPoints[2].y);
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
    const slPos = getSLPosition(center, triRadius, hue, saturation, lightness);
    ctx.beginPath();
    ctx.arc(slPos.x, slPos.y, 7, 0, Math.PI * 2);
    ctx.fillStyle = '#fff';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(slPos.x, slPos.y, 5, 0, Math.PI * 2);
    const currentColor = `hsl(${hue}, ${saturation}%, ${lightness}%)`;
    ctx.fillStyle = currentColor;
    ctx.fill();
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1;
    ctx.stroke();
  }, [hue, saturation, lightness, size, center, outerRadius, innerRadius]);

  useEffect(() => {
    drawWheel();
  }, [drawWheel]);

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
    } else if (dist < innerRadius) {
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
    const triRadius = innerRadius - 8;
    const triPoints = getTrianglePoints(center, center, triRadius, hue);
    const result = getPositionSL(pos, triPoints);
    if (result) {
      onChange(hue, Math.round(result.s), Math.round(result.l));
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

function getTrianglePoints(cx: number, cy: number, radius: number, hue: number) {
  // Triangle points at hue angle, hue+120, hue+240
  const angle = hue * Math.PI / 180;
  return [
    { x: cx + Math.cos(angle) * radius, y: cy + Math.sin(angle) * radius },
    { x: cx + Math.cos(angle + (2 * Math.PI / 3)) * radius, y: cy + Math.sin(angle + (2 * Math.PI / 3)) * radius },
    { x: cx + Math.cos(angle + (4 * Math.PI / 3)) * radius, y: cy + Math.sin(angle + (4 * Math.PI / 3)) * radius },
  ];
}

function getSLPosition(cx: number, triRadius: number, hue: number, s: number, l: number) {
  const triPoints = getTrianglePoints(cx, cx, triRadius, hue);
  // Map S/L to triangle position
  // Top point = pure hue, bottom-left = white, bottom-right = black
  const sat = s / 100;
  const lit = l / 100;

  // Interpolate between the three corners
  const x = triPoints[0].x * (1 - lit) * sat + triPoints[1].x * (1 - sat) * (1 - lit) + triPoints[2].x * lit;
  const y = triPoints[0].y * (1 - lit) * sat + triPoints[1].y * (1 - sat) * (1 - lit) + triPoints[2].y * lit;

  return { x, y };
}

function getPositionSL(pos: { x: number; y: number }, triPoints: { x: number; y: number }[]) {
  // Convert position back to S/L using barycentric coordinates
  const [p0, p1, p2] = triPoints;

  const v0x = p1.x - p0.x;
  const v0y = p1.y - p0.y;
  const v1x = p2.x - p0.x;
  const v1y = p2.y - p0.y;
  const v2x = pos.x - p0.x;
  const v2y = pos.y - p0.y;

  const dot00 = v0x * v0x + v0y * v0y;
  const dot01 = v0x * v1x + v0y * v1y;
  const dot02 = v0x * v2x + v0y * v2y;
  const dot11 = v1x * v1x + v1y * v1y;
  const dot12 = v1x * v2x + v1y * v2y;

  const inv = 1 / (dot00 * dot11 - dot01 * dot01);
  const u = (dot11 * dot02 - dot01 * dot12) * inv;
  const v = (dot00 * dot12 - dot01 * dot02) * inv;

  // Clamp to triangle
  if (u < 0 || v < 0 || u + v > 1) {
    // Find closest point on triangle edge
    const clamped = clampToTriangle(pos, triPoints);
    return getPositionSL(clamped, triPoints);
  }

  // u = weight for p1 (white), v = weight for p2 (black)
  // 1-u-v = weight for p0 (pure hue)
  const colorWeight = 1 - u - v;
  const sat = Math.min(100, Math.max(0, Math.round(colorWeight * 100)));
  const lit = Math.min(100, Math.max(0, Math.round(v * 100)));

  return { s: sat, l: lit };
}

function clampToTriangle(pos: { x: number; y: number }, triPoints: { x: number; y: number }[]) {
  // Simple clamp: find nearest point on triangle edges
  const [p0, p1, p2] = triPoints;
  const edges = [
    [p0, p1], [p1, p2], [p2, p0]
  ];

  let minDist = Infinity;
  let closest = pos;

  for (const [a, b] of edges) {
    const cp = closestPointOnLine(pos, a, b);
    const dist = Math.hypot(pos.x - cp.x, pos.y - cp.y);
    if (dist < minDist) {
      minDist = dist;
      closest = cp;
    }
  }

  return closest;
}

function closestPointOnLine(p: { x: number; y: number }, a: { x: number; y: number }, b: { x: number; y: number }) {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const apx = p.x - a.x;
  const apy = p.y - a.y;
  const t = Math.max(0, Math.min(1, (apx * abx + apy * aby) / (abx * abx + aby * aby)));
  return { x: a.x + t * abx, y: a.y + t * aby };
}

export default ColorWheel;
