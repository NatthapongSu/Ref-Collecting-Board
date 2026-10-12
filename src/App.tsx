import React, { useState, useEffect, useRef, useCallback } from 'react';
import ColorWheel from './components/ColorWheel';

interface BoardImage {
  id: string;
  src: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
}

interface PickedColor {
  hex: string;
  rgb: { r: number; g: number; b: number };
  hsl: { h: number; s: number; l: number };
}

const STORAGE_KEY = 'art-board-data';

function App() {
  const [images, setImages] = useState<BoardImage[]>([]);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [pickedColors, setPickedColors] = useState<PickedColor[]>([]);
  const [currentColor, setCurrentColor] = useState<PickedColor>({
    hex: '#ff0000',
    rgb: { r: 255, g: 0, b: 0 },
    hsl: { h: 0, s: 100, l: 50 }
  });
  const [hsl, setHsl] = useState({ h: 0, s: 100, l: 50 });
  const [isColorPicking, setIsColorPicking] = useState(false);
  const [copiedText, setCopiedText] = useState('');
  const [boardOffset, setBoardOffset] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [selectedImageId, setSelectedImageId] = useState<string | null>(null);
  const [showColorPanel, setShowColorPanel] = useState(true);
  const [resizingId, setResizingId] = useState<string | null>(null);
  const [resizeCorner, setResizeCorner] = useState<'tl' | 'tr' | 'bl' | 'br' | null>(null);
  const [resizeStart, setResizeStart] = useState({ x: 0, y: 0, width: 0, height: 0, imgX: 0, imgY: 0 });
  const [rotatingId, setRotatingId] = useState<string | null>(null);
  const [rotateStart, setRotateStart] = useState({ angle: 0, centerX: 0, centerY: 0 });

  const boardRef = useRef<HTMLDivElement>(null);
  const boardOffsetRef = useRef({ x: 0, y: 0 });
  const zoomRef = useRef(1);
  const draggingIdRef = useRef<string | null>(null);
  const dragOffsetRef = useRef({ x: 0, y: 0 });
  const isPanningRef = useRef(false);
  const panStartRef = useRef({ x: 0, y: 0 });
  const resizingIdRef = useRef<string | null>(null);
  const resizeCornerRef = useRef<'tl' | 'tr' | 'bl' | 'br' | null>(null);
  const resizeStartRef = useRef({ x: 0, y: 0, width: 0, height: 0, imgX: 0, imgY: 0 });
  const rotatingIdRef = useRef<string | null>(null);
  const rotateStartRef = useRef({ angle: 0, centerX: 0, centerY: 0 });

  // Load from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const data = JSON.parse(saved);
        if (data.images) setImages(data.images);
        if (data.pickedColors) setPickedColors(data.pickedColors);
        if (data.boardOffset) {
          setBoardOffset(data.boardOffset);
          boardOffsetRef.current = data.boardOffset;
        }
        if (data.zoom) {
          setZoom(data.zoom);
          zoomRef.current = data.zoom;
        }
      }
    } catch (e) {
      console.error('Failed to load saved data:', e);
    }
  }, []);

  // Auto-save to localStorage (debounced)
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      const saveData = {
        images,
        pickedColors,
        boardOffset,
        zoom
      };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(saveData));
      } catch (e) {
        console.error('Failed to save data:', e);
      }
    }, 500); // Debounce for 500ms

    return () => clearTimeout(timeoutId);
  }, [images, pickedColors, boardOffset, zoom]);

  // Handle paste
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        if (items[i].type.startsWith('image/')) {
          e.preventDefault();
          const file = items[i].getAsFile();
          if (file) {
            const reader = new FileReader();
            reader.onload = (ev) => {
              const src = ev.target?.result as string;
              addImage(src);
            };
            reader.readAsDataURL(file);
          }
          break;
        }
      }
    };

    document.addEventListener('paste', handlePaste);
    return () => document.removeEventListener('paste', handlePaste);
  }, []);

  // Handle drop
  useEffect(() => {
    const handleDrop = (e: DragEvent) => {
      e.preventDefault();
      const files = e.dataTransfer?.files;
      if (!files) return;

      for (let i = 0; i < files.length; i++) {
        if (files[i].type.startsWith('image/')) {
          const reader = new FileReader();
          reader.onload = (ev) => {
            const src = ev.target?.result as string;
            const rect = boardRef.current?.getBoundingClientRect();
            const x = ((e.clientX - (rect?.left || 0)) - boardOffsetRef.current.x) / zoomRef.current;
            const y = ((e.clientY - (rect?.top || 0)) - boardOffsetRef.current.y) / zoomRef.current;
            addImage(src, x, y);
          };
          reader.readAsDataURL(files[i]);
        }
      }
    };

    const handleDragOver = (e: DragEvent) => {
      e.preventDefault();
    };

    document.addEventListener('drop', handleDrop);
    document.addEventListener('dragover', handleDragOver);
    return () => {
      document.removeEventListener('drop', handleDrop);
      document.removeEventListener('dragover', handleDragOver);
    };
  }, []);

  // Handle wheel zoom / image scale
  useEffect(() => {
    const board = boardRef.current;
    if (!board) return;

    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const delta = e.deltaY > 0 ? 0.9 : 1.1;
        setZoom(prev => {
          const newZoom = Math.min(3, Math.max(0.2, prev * delta));
          zoomRef.current = newZoom;
          return newZoom;
        });
      } else if (selectedImageId) {
        // Scale selected image with scroll wheel
        e.preventDefault();
        const scaleFactor = e.deltaY > 0 ? 0.95 : 1.05;
        setImages(prev => prev.map(img => {
          if (img.id === selectedImageId) {
            const ratio = img.height / img.width;
            const newWidth = Math.max(50, Math.min(2000, img.width * scaleFactor));
            const newHeight = newWidth * ratio;
            // Scale from center
            const dx = (newWidth - img.width) / 2;
            const dy = (newHeight - img.height) / 2;
            return { ...img, width: newWidth, height: newHeight, x: img.x - dx, y: img.y - dy };
          }
          return img;
        }));
      }
    };

    board.addEventListener('wheel', handleWheel, { passive: false });
    return () => board.removeEventListener('wheel', handleWheel);
  }, [selectedImageId]);

  const addImage = (src: string, x?: number, y?: number) => {
    const img = new Image();
    img.onload = () => {
      const maxDim = 400;
      let width = img.width;
      let height = img.height;
      if (width > maxDim || height > maxDim) {
        const ratio = Math.min(maxDim / width, maxDim / height);
        width *= ratio;
        height *= ratio;
      }
      const newImage: BoardImage = {
        id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
        src,
        x: x ?? (Math.random() * 200 + 100),
        y: y ?? (Math.random() * 200 + 100),
        width,
        height,
        rotation: 0
      };
      setImages(prev => [...prev, newImage]);
    };
    img.src = src;
  };

  const handleImageMouseDown = (e: React.MouseEvent, id: string) => {
    if (isColorPicking) return;
    e.stopPropagation();
    e.preventDefault();
    const img = images.find(i => i.id === id);
    if (!img) return;
    setDraggingId(id);
    draggingIdRef.current = id;
    setSelectedImageId(id);
    const rect = boardRef.current?.getBoundingClientRect();
    if (rect) {
      const offset = {
        x: (e.clientX - rect.left - boardOffsetRef.current.x) / zoomRef.current - img.x,
        y: (e.clientY - rect.top - boardOffsetRef.current.y) / zoomRef.current - img.y
      };
      setDragOffset(offset);
      dragOffsetRef.current = offset;
    }
  };

  const handleResizeMouseDown = (e: React.MouseEvent, id: string, corner: 'tl' | 'tr' | 'bl' | 'br') => {
    e.stopPropagation();
    e.preventDefault();
    const img = images.find(i => i.id === id);
    if (!img) return;
    
    const rect = boardRef.current?.getBoundingClientRect();
    if (rect) {
      const mouseX = (e.clientX - rect.left - boardOffsetRef.current.x) / zoomRef.current;
      const mouseY = (e.clientY - rect.top - boardOffsetRef.current.y) / zoomRef.current;
      
      const startData = {
        x: mouseX,
        y: mouseY,
        width: img.width,
        height: img.height,
        imgX: img.x,
        imgY: img.y
      };
      
      setResizingId(id);
      resizingIdRef.current = id;
      setResizeCorner(corner);
      resizeCornerRef.current = corner;
      setResizeStart(startData);
      resizeStartRef.current = startData;
      setSelectedImageId(id);
    }
  };

  const handleRotateMouseDown = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    e.preventDefault();
    const img = images.find(i => i.id === id);
    if (!img) return;
    
    const rect = boardRef.current?.getBoundingClientRect();
    if (rect) {
      const centerX = img.x + img.width / 2;
      const centerY = img.y + img.height / 2;
      
      const startData = {
        angle: img.rotation,
        centerX,
        centerY
      };
      
      setRotatingId(id);
      rotatingIdRef.current = id;
      setRotateStart(startData);
      rotateStartRef.current = startData;
      setSelectedImageId(id);
    }
  };

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const currentDraggingId = draggingIdRef.current;
    const currentIsPanning = isPanningRef.current;
    const currentResizingId = resizingIdRef.current;
    const currentRotatingId = rotatingIdRef.current;

    if (currentResizingId) {
      const rect = boardRef.current?.getBoundingClientRect();
      if (rect) {
        const mouseX = (e.clientX - rect.left - boardOffsetRef.current.x) / zoomRef.current;
        const mouseY = (e.clientY - rect.top - boardOffsetRef.current.y) / zoomRef.current;
        const dx = mouseX - resizeStartRef.current.x;
        const dy = mouseY - resizeStartRef.current.y;
        
        let newWidth = resizeStartRef.current.width;
        let newHeight = resizeStartRef.current.height;
        let newX = resizeStartRef.current.imgX;
        let newY = resizeStartRef.current.imgY;
        
        const aspectRatio = resizeStartRef.current.height / resizeStartRef.current.width;
        const corner = resizeCornerRef.current;
        
        if (corner === 'br') {
          newWidth = Math.max(50, resizeStartRef.current.width + dx);
          newHeight = newWidth * aspectRatio;
        } else if (corner === 'bl') {
          newWidth = Math.max(50, resizeStartRef.current.width - dx);
          newHeight = newWidth * aspectRatio;
          newX = resizeStartRef.current.imgX + (resizeStartRef.current.width - newWidth);
        } else if (corner === 'tr') {
          newWidth = Math.max(50, resizeStartRef.current.width + dx);
          newHeight = newWidth * aspectRatio;
          newY = resizeStartRef.current.imgY + (resizeStartRef.current.height - newHeight);
        } else if (corner === 'tl') {
          newWidth = Math.max(50, resizeStartRef.current.width - dx);
          newHeight = newWidth * aspectRatio;
          newX = resizeStartRef.current.imgX + (resizeStartRef.current.width - newWidth);
          newY = resizeStartRef.current.imgY + (resizeStartRef.current.height - newHeight);
        }
        
        setImages(prev => prev.map(img =>
          img.id === currentResizingId ? { ...img, width: newWidth, height: newHeight, x: newX, y: newY } : img
        ));
      }
    } else if (currentRotatingId) {
      const rect = boardRef.current?.getBoundingClientRect();
      if (rect) {
        const mouseX = (e.clientX - rect.left - boardOffsetRef.current.x) / zoomRef.current;
        const mouseY = (e.clientY - rect.top - boardOffsetRef.current.y) / zoomRef.current;
        const centerX = rotateStartRef.current.centerX;
        const centerY = rotateStartRef.current.centerY;
        
        const angle = Math.atan2(mouseY - centerY, mouseX - centerX) * (180 / Math.PI) + 90;
        
        setImages(prev => prev.map(img =>
          img.id === currentRotatingId ? { ...img, rotation: angle } : img
        ));
      }
    } else if (currentDraggingId) {
      const rect = boardRef.current?.getBoundingClientRect();
      if (rect) {
        const x = (e.clientX - rect.left - boardOffsetRef.current.x) / zoomRef.current - dragOffsetRef.current.x;
        const y = (e.clientY - rect.top - boardOffsetRef.current.y) / zoomRef.current - dragOffsetRef.current.y;
        setImages(prev => prev.map(img =>
          img.id === currentDraggingId ? { ...img, x, y } : img
        ));
      }
    } else if (currentIsPanning) {
      const dx = e.clientX - panStartRef.current.x;
      const dy = e.clientY - panStartRef.current.y;
      const newOffset = { x: boardOffsetRef.current.x + dx, y: boardOffsetRef.current.y + dy };
      boardOffsetRef.current = newOffset;
      setBoardOffset(newOffset);
      panStartRef.current = { x: e.clientX, y: e.clientY };
      setPanStart({ x: e.clientX, y: e.clientY });
    }
  }, []);

  const handleMouseUp = useCallback(() => {
    setDraggingId(null);
    draggingIdRef.current = null;
    setIsPanning(false);
    isPanningRef.current = false;
    setResizingId(null);
    resizingIdRef.current = null;
    setResizeCorner(null);
    resizeCornerRef.current = null;
    setRotatingId(null);
    rotatingIdRef.current = null;
  }, []);

  const handleBoardMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.target === boardRef.current || (e.target as HTMLElement).classList.contains('board-bg')) {
      setSelectedImageId(null);
      if (e.button === 1 || (e.button === 0 && e.altKey)) {
        setIsPanning(true);
        isPanningRef.current = true;
        const start = { x: e.clientX, y: e.clientY };
        setPanStart(start);
        panStartRef.current = start;
      }
    }
  }, []);

  const deleteImage = (id: string) => {
    setImages(prev => prev.filter(img => img.id !== id));
    if (selectedImageId === id) setSelectedImageId(null);
  };



  // Color picking from image
  const handleColorPickClick = (e: React.MouseEvent<HTMLImageElement>, imgId: string) => {
    if (!isColorPicking) return;
    e.stopPropagation();

    const img = e.currentTarget;
    const rect = img.getBoundingClientRect();
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    ctx.drawImage(img, 0, 0);

    const scaleX = img.naturalWidth / rect.width;
    const scaleY = img.naturalHeight / rect.height;
    const px = Math.floor((e.clientX - rect.left) * scaleX);
    const py = Math.floor((e.clientY - rect.top) * scaleY);

    const pixel = ctx.getImageData(px, py, 1, 1).data;
    const r = pixel[0], g = pixel[1], b = pixel[2];
    const hex = rgbToHex(r, g, b);
    const hslVal = rgbToHsl(r, g, b);

    const color: PickedColor = { hex, rgb: { r, g, b }, hsl: hslVal };
    setCurrentColor(color);
    setHsl(hslVal);
    setIsColorPicking(false);
  };

  const saveColor = () => {
    if (!pickedColors.find(c => c.hex === currentColor.hex)) {
      setPickedColors(prev => [...prev, currentColor]);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(label);
    setTimeout(() => setCopiedText(''), 1500);
  };

  const handleColorWheelChange = useCallback((h: number, s: number, l: number) => {
    setHsl({ h, s, l });
    const rgb = hslToRgb(h, s, l);
    const hex = rgbToHex(rgb.r, rgb.g, rgb.b);
    setCurrentColor({ hex, rgb, hsl: { h, s, l } });
  }, []);

  const clearBoard = () => {
    if (confirm('Clear all images from the board?')) {
      setImages([]);
    }
  };

  const clearColors = () => {
    setPickedColors([]);
  };

  return (
    <div className="h-screen w-screen flex flex-col bg-gray-50 overflow-hidden">
      {/* Top Toolbar */}
      <div className="h-14 bg-white border-b border-gray-200 flex items-center px-4 gap-3 shadow-sm z-50">
        <div className="flex items-center gap-2">
          <span className="text-xl">🎨</span>
          <h1 className="text-lg font-semibold text-gray-800">Art Board</h1>
        </div>

        <div className="h-6 w-px bg-gray-200 mx-2" />

        <button
          onClick={() => setIsColorPicking(!isColorPicking)}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
            isColorPicking
              ? 'bg-amber-100 text-amber-700 ring-2 ring-amber-300'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
          title="Pick color from image"
        >
          <span className="mr-1">💧</span> Eyedropper
        </button>

        <button
          onClick={() => setShowColorPanel(!showColorPanel)}
          className="px-3 py-1.5 rounded-lg text-sm font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 transition-all"
        >
          <span className="mr-1">🎯</span> Colors
        </button>

        <button
          onClick={clearBoard}
          className="px-3 py-1.5 rounded-lg text-sm font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 transition-all"
        >
          <span className="mr-1">🗑️</span> Clear Board
        </button>

        <div className="flex-1" />

        <div className="flex items-center gap-2 text-sm text-gray-500">
          <span>{Math.round(zoom * 100)}%</span>
          <button
            onClick={() => setZoom(1)}
            className="px-2 py-1 rounded bg-gray-100 hover:bg-gray-200 text-xs"
          >
            Reset
          </button>
        </div>

        <div className="text-xs text-gray-400">
          Paste/Drop images • Drag to move • Corner handles to resize • Top handle to rotate • Alt+Drag to pan
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Main Board */}
        <div
          ref={boardRef}
          className="flex-1 relative overflow-hidden board-bg"
          style={{
            cursor: isColorPicking ? 'crosshair' : isPanning ? 'grabbing' : 'default',
            backgroundImage: 'radial-gradient(circle, #d1d5db 1px, transparent 1px)',
            backgroundSize: `${20 * zoom}px ${20 * zoom}px`,
            backgroundPosition: `${boardOffset.x}px ${boardOffset.y}px`
          }}
          onMouseDown={handleBoardMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          {/* Transform container */}
          <div
            style={{
              transform: `translate(${boardOffset.x}px, ${boardOffset.y}px) scale(${zoom})`,
              transformOrigin: '0 0',
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%'
            }}
          >
            {images.map(img => (
              <div
                key={img.id}
                className="absolute group"
                style={{
                  left: img.x,
                  top: img.y,
                  width: img.width,
                  height: img.height,
                  transform: `rotate(${img.rotation}deg)`,
                  transformOrigin: 'center center',
                  zIndex: draggingId === img.id || resizingId === img.id || rotatingId === img.id ? 1000 : selectedImageId === img.id ? 500 : 1
                }}
              >
                <img
                  src={img.src}
                  alt="Reference"
                  className="w-full h-full rounded-lg shadow-lg select-none"
                  style={{
                    filter: isColorPicking ? 'brightness(1.05)' : 'none',
                    cursor: isColorPicking ? 'crosshair' : 'move'
                  }}
                  onMouseDown={(e) => {
                    if (isColorPicking) {
                      handleColorPickClick(e, img.id);
                    } else {
                      handleImageMouseDown(e, img.id);
                    }
                  }}
                  onClick={(e) => {
                    if (!isColorPicking) {
                      e.stopPropagation();
                      setSelectedImageId(img.id);
                    }
                  }}
                  draggable={false}
                />

                {/* Selection border and handles */}
                {selectedImageId === img.id && !isColorPicking && (
                  <>
                    {/* Selection border */}
                    <div className="absolute inset-0 rounded-lg ring-2 ring-blue-400 pointer-events-none" style={{ zIndex: 10 }} />
                    
                    {/* Rotation handle */}
                    <div
                      className="absolute -top-8 left-1/2 -translate-x-1/2 w-4 h-4 bg-white border-2 border-blue-400 rounded-full cursor-grab active:cursor-grabbing shadow-sm hover:scale-110 transition-transform"
                      style={{ zIndex: 20 }}
                      onMouseDown={(e) => handleRotateMouseDown(e, img.id)}
                    />
                    <div className="absolute -top-6 left-1/2 -translate-x-1/2 w-0.5 h-4 bg-blue-400 pointer-events-none" style={{ zIndex: 15 }} />
                    
                    {/* Resize handles */}
                    <div
                      className="absolute -top-1.5 -left-1.5 w-3 h-3 bg-white border-2 border-blue-400 rounded-sm cursor-nwse-resize hover:scale-125 transition-transform"
                      style={{ zIndex: 20 }}
                      onMouseDown={(e) => handleResizeMouseDown(e, img.id, 'tl')}
                    />
                    <div
                      className="absolute -top-1.5 -right-1.5 w-3 h-3 bg-white border-2 border-blue-400 rounded-sm cursor-nesw-resize hover:scale-125 transition-transform"
                      style={{ zIndex: 20 }}
                      onMouseDown={(e) => handleResizeMouseDown(e, img.id, 'tr')}
                    />
                    <div
                      className="absolute -bottom-1.5 -left-1.5 w-3 h-3 bg-white border-2 border-blue-400 rounded-sm cursor-nesw-resize hover:scale-125 transition-transform"
                      style={{ zIndex: 20 }}
                      onMouseDown={(e) => handleResizeMouseDown(e, img.id, 'bl')}
                    />
                    <div
                      className="absolute -bottom-1.5 -right-1.5 w-3 h-3 bg-white border-2 border-blue-400 rounded-sm cursor-nwse-resize hover:scale-125 transition-transform"
                      style={{ zIndex: 20 }}
                      onMouseDown={(e) => handleResizeMouseDown(e, img.id, 'br')}
                    />
                  </>
                )}
              </div>
            ))}
          </div>

          {/* Empty state */}
          {images.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="text-center text-gray-400">
                <div className="text-6xl mb-4">📋</div>
                <p className="text-lg font-medium">Paste or drop images here</p>
                <p className="text-sm mt-1">Ctrl+V to paste • Drag & drop files</p>
              </div>
            </div>
          )}

          {/* Color picking indicator */}
          {isColorPicking && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-amber-500 text-white px-4 py-2 rounded-full shadow-lg text-sm font-medium animate-pulse">
              Click on an image to pick a color
            </div>
          )}

          {/* Copied indicator */}
          {copiedText && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-green-500 text-white px-4 py-2 rounded-full shadow-lg text-sm font-medium">
              ✓ {copiedText} copied!
            </div>
          )}
        </div>

        {/* Color Panel */}
        {showColorPanel && (
          <div className="w-80 bg-white border-l border-gray-200 flex flex-col overflow-hidden shadow-sm">
            {/* Color Wheel Section */}
            <div className="p-4 border-b border-gray-100">
              <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                <span>🔮</span> Color Wheel
              </h3>
              <div className="flex justify-center">
                <ColorWheel
                  hue={hsl.h}
                  saturation={hsl.s}
                  lightness={hsl.l}
                  onChange={handleColorWheelChange}
                  size={240}
                />
              </div>
            </div>

            {/* Current Color Display */}
            <div className="p-4 border-b border-gray-100">
              <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                <span>🎨</span> Current Color
              </h3>
              <div className="flex items-center gap-3 mb-3">
                <div
                  className="w-16 h-16 rounded-xl shadow-inner border border-gray-200"
                  style={{ backgroundColor: currentColor.hex }}
                />
                <div className="flex-1 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-500">HEX</span>
                    <button
                      onClick={() => copyToClipboard(currentColor.hex, 'HEX')}
                      className="text-xs font-mono bg-gray-100 px-2 py-0.5 rounded hover:bg-gray-200 transition-colors"
                    >
                      {currentColor.hex}
                    </button>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-500">RGB</span>
                    <button
                      onClick={() => copyToClipboard(`rgb(${currentColor.rgb.r}, ${currentColor.rgb.g}, ${currentColor.rgb.b})`, 'RGB')}
                      className="text-xs font-mono bg-gray-100 px-2 py-0.5 rounded hover:bg-gray-200 transition-colors"
                    >
                      {currentColor.rgb.r}, {currentColor.rgb.g}, {currentColor.rgb.b}
                    </button>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-500">HSL</span>
                    <button
                      onClick={() => copyToClipboard(`hsl(${currentColor.hsl.h}, ${currentColor.hsl.s}%, ${currentColor.hsl.l}%)`, 'HSL')}
                      className="text-xs font-mono bg-gray-100 px-2 py-0.5 rounded hover:bg-gray-200 transition-colors"
                    >
                      {currentColor.hsl.h}°, {currentColor.hsl.s}%, {currentColor.hsl.l}%
                    </button>
                  </div>
                </div>
              </div>
              <button
                onClick={saveColor}
                className="w-full py-2 bg-blue-50 text-blue-600 rounded-lg text-sm font-medium hover:bg-blue-100 transition-colors"
              >
                + Save to Palette
              </button>
            </div>

            {/* Saved Colors */}
            <div className="flex-1 overflow-y-auto p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                  <span>🎭</span> Palette ({pickedColors.length})
                </h3>
                {pickedColors.length > 0 && (
                  <button
                    onClick={clearColors}
                    className="text-xs text-gray-400 hover:text-red-500 transition-colors"
                  >
                    Clear
                  </button>
                )}
              </div>

              {pickedColors.length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-4">
                  Pick colors from images or use the wheel
                </p>
              ) : (
                <div className="grid grid-cols-4 gap-2">
                  {pickedColors.map((color, idx) => (
                    <div key={idx} className="group relative">
                      <button
                        onClick={() => {
                          setCurrentColor(color);
                          setHsl(color.hsl);
                        }}
                        className="w-full aspect-square rounded-lg shadow-sm border border-gray-200 hover:scale-110 transition-transform"
                        style={{ backgroundColor: color.hex }}
                        title={`${color.hex}\nRGB: ${color.rgb.r}, ${color.rgb.g}, ${color.rgb.b}`}
                      />
                      <button
                        onClick={() => copyToClipboard(color.hex, 'HEX')}
                        className="absolute -top-1 -right-1 w-4 h-4 bg-white rounded-full shadow text-[8px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        📋
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Utility functions
function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('');
}

function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }

  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100)
  };
}

function hslToRgb(h: number, s: number, l: number): { r: number; g: number; b: number } {
  h /= 360; s /= 100; l /= 100;
  let r, g, b;

  if (s === 0) {
    r = g = b = l;
  } else {
    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1/6) return p + (q - p) * 6 * t;
      if (t < 1/2) return q;
      if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
      return p;
    };
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1/3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1/3);
  }

  return {
    r: Math.round(r * 255),
    g: Math.round(g * 255),
    b: Math.round(b * 255)
  };
}

export default App;
