import React, { useState, useEffect, useRef, useCallback } from 'react';
import ColorWheel from './components/ColorWheel';
import { saveData, loadData, migrateFromLocalStorage, getStorageEstimate } from './lib/db';

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
  hsv: { h: number; s: number; v: number };
}

interface Canvas {
  id: string;
  name: string;
  images: BoardImage[];
  pickedColors: PickedColor[];
  boardOffset: { x: number; y: number };
  zoom: number;
}

const STORAGE_KEY = 'board-data';

// HSV to RGB conversion
function hsvToRgb(h: number, s: number, v: number): { r: number; g: number; b: number } {
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
  
  return {
    r: Math.round((r + m) * 255),
    g: Math.round((g + m) * 255),
    b: Math.round((b + m) * 255)
  };
}

// RGB to HSV conversion
function rgbToHsv(r: number, g: number, b: number): { h: number; s: number; v: number } {
  r /= 255;
  g /= 255;
  b /= 255;
  
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  
  let h = 0;
  const s = max === 0 ? 0 : d / max;
  const v = max;
  
  if (d !== 0) {
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
    else if (max === g) h = ((b - r) / d + 2) / 6;
    else h = ((r - g) / d + 4) / 6;
  }
  
  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    v: Math.round(v * 100)
  };
}

// RGB to HEX conversion
function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('');
}

function App() {
  // Canvas management
  const [canvases, setCanvases] = useState<Canvas[]>([]);
  const [activeCanvasId, setActiveCanvasId] = useState<string>('');
  
  // UI state
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const dragStartPosRef = useRef({ x: 0, y: 0 });
  const initialPositionsRef = useRef<Map<string, { x: number; y: number }>>(new Map());
  const [currentColor, setCurrentColor] = useState<PickedColor>({
    hex: '#ff0000',
    rgb: { r: 255, g: 0, b: 0 },
    hsv: { h: 0, s: 100, v: 100 }
  });
  const [hsv, setHsv] = useState({ h: 0, s: 100, v: 100 });
  const [isColorPicking, setIsColorPicking] = useState(false);
  const [isPanningMode, setIsPanningMode] = useState(false);
  const isPanningModeRef = useRef(false);
  
  useEffect(() => {
    isPanningModeRef.current = isPanningMode;
  }, [isPanningMode]);
  
  const [copiedText, setCopiedText] = useState('');
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [selectedImageId, setSelectedImageId] = useState<string | null>(null);
  const [selectedImageIds, setSelectedImageIds] = useState<string[]>([]);
  const [selectionBox, setSelectionBox] = useState<{ startX: number; startY: number; endX: number; endY: number } | null>(null);
  const [isSelecting, setIsSelecting] = useState(false);
  const [showColorPanel, setShowColorPanel] = useState(true);
  const [resizingId, setResizingId] = useState<string | null>(null);
  const [resizeCorner, setResizeCorner] = useState<'tl' | 'tr' | 'bl' | 'br' | null>(null);
  const [resizeStart, setResizeStart] = useState({ x: 0, y: 0, width: 0, height: 0, imgX: 0, imgY: 0 });
  const [isGroupResize, setIsGroupResize] = useState(false);
  const isGroupResizeRef = useRef(false);
  const groupBoundsRef = useRef<{ minX: number; minY: number; maxX: number; maxY: number } | null>(null);
  const initialGroupPositionsRef = useRef<Map<string, { x: number; y: number; width: number; height: number }>>(new Map());
  const [rotatingId, setRotatingId] = useState<string | null>(null);
  const [rotateStart, setRotateStart] = useState({ angle: 0, centerX: 0, centerY: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [storageInfo, setStorageInfo] = useState<{ usage: number; quota: number } | null>(null);
  const [colorWheelSize, setColorWheelSize] = useState(220);

  // Update color wheel size based on screen width
  useEffect(() => {
    const updateSize = () => {
      setColorWheelSize(window.innerWidth < 640 ? 180 : 220);
    };
    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  // Get active canvas data
  const activeCanvas = canvases.find(c => c.id === activeCanvasId);
  const images = activeCanvas?.images || [];
  const pickedColors = activeCanvas?.pickedColors || [];
  const boardOffset = activeCanvas?.boardOffset || { x: 0, y: 0 };
  const zoom = activeCanvas?.zoom || 1;

  // Helper to update active canvas
  const updateActiveCanvas = (updates: Partial<Canvas>) => {
    setCanvases(prev => prev.map(c => 
      c.id === activeCanvasIdRef.current ? { ...c, ...updates } : c
    ));
  };

  // Canvas management functions
  const addCanvas = () => {
    const newCanvas: Canvas = {
      id: Date.now().toString(),
      name: `Canvas ${canvases.length + 1}`,
      images: [],
      pickedColors: [],
      boardOffset: { x: 0, y: 0 },
      zoom: 1
    };
    setCanvases(prev => [...prev, newCanvas]);
    setActiveCanvasId(newCanvas.id);
    activeCanvasIdRef.current = newCanvas.id;
  };

  const removeCanvas = (id: string) => {
    if (canvases.length === 1) {
      alert('Cannot remove the last canvas');
      return;
    }
    if (confirm('Remove this canvas and all its content?')) {
      setCanvases(prev => prev.filter(c => c.id !== id));
      if (activeCanvasId === id) {
        const remaining = canvases.filter(c => c.id !== id);
        const newActiveId = remaining[0]?.id || '';
        setActiveCanvasId(newActiveId);
        activeCanvasIdRef.current = newActiveId;
      }
    }
  };

  const switchCanvas = (id: string) => {
    setActiveCanvasId(id);
    activeCanvasIdRef.current = id;
    setSelectedImageId(null);
  };

  // Sync refs when active canvas changes
  useEffect(() => {
    if (activeCanvas) {
      boardOffsetRef.current = activeCanvas.boardOffset;
      zoomRef.current = activeCanvas.zoom;
    }
  }, [activeCanvasId, activeCanvas]);

  // Wrapper functions to update active canvas state
  const setImages = (updater: BoardImage[] | ((prev: BoardImage[]) => BoardImage[])) => {
    setCanvases(prev => prev.map(c => {
      if (c.id === activeCanvasIdRef.current) {
        return {
          ...c,
          images: typeof updater === 'function' ? updater(c.images) : updater
        };
      }
      return c;
    }));
  };

  const setPickedColors = (updater: PickedColor[] | ((prev: PickedColor[]) => PickedColor[])) => {
    setCanvases(prev => prev.map(c => {
      if (c.id === activeCanvasIdRef.current) {
        return {
          ...c,
          pickedColors: typeof updater === 'function' ? updater(c.pickedColors) : updater
        };
      }
      return c;
    }));
  };

  const setBoardOffset = (updater: { x: number; y: number } | ((prev: { x: number; y: number }) => { x: number; y: number })) => {
    setCanvases(prev => prev.map(c => {
      if (c.id === activeCanvasIdRef.current) {
        return {
          ...c,
          boardOffset: typeof updater === 'function' ? updater(c.boardOffset) : updater
        };
      }
      return c;
    }));
  };

  const setZoom = (updater: number | ((prev: number) => number)) => {
    setCanvases(prev => prev.map(c => {
      if (c.id === activeCanvasIdRef.current) {
        return {
          ...c,
          zoom: typeof updater === 'function' ? updater(c.zoom) : updater
        };
      }
      return c;
    }));
  };

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
  const activeCanvasIdRef = useRef<string>('');
  const isSelectingRef = useRef(false);
  const selectionBoxRef = useRef<{ startX: number; startY: number; endX: number; endY: number } | null>(null);
  
  useEffect(() => {
    activeCanvasIdRef.current = activeCanvasId;
  }, [activeCanvasId]);
  
  useEffect(() => {
    isSelectingRef.current = isSelecting;
  }, [isSelecting]);
  
  useEffect(() => {
    selectionBoxRef.current = selectionBox;
  }, [selectionBox]);

  // Load from IndexedDB (with localStorage migration)
  useEffect(() => {
    const loadInitialData = async () => {
      try {
        // Try to migrate from localStorage first (one-time)
        const migrated = await migrateFromLocalStorage();
        if (migrated) {
          console.log('Migrated data from localStorage to IndexedDB');
        }

        // Load from IndexedDB
        const data = await loadData<any>(STORAGE_KEY);
        if (data && data.canvases && data.canvases.length > 0) {
          setCanvases(data.canvases);
          const activeId = data.activeCanvasId || data.canvases[0].id;
          setActiveCanvasId(activeId);
          activeCanvasIdRef.current = activeId;
          
          // Sync refs with active canvas
          const activeCanvasData = data.canvases.find((c: Canvas) => c.id === activeId) || data.canvases[0];
          boardOffsetRef.current = activeCanvasData.boardOffset;
          zoomRef.current = activeCanvasData.zoom;
        } else if (data && data.images) {
          // Migrate old single-canvas format
          const defaultCanvas: Canvas = {
            id: Date.now().toString(),
            name: 'Canvas 1',
            images: data.images || [],
            pickedColors: data.pickedColors || [],
            boardOffset: data.boardOffset || { x: 0, y: 0 },
            zoom: data.zoom || 1
          };
          setCanvases([defaultCanvas]);
          setActiveCanvasId(defaultCanvas.id);
          activeCanvasIdRef.current = defaultCanvas.id;
          boardOffsetRef.current = defaultCanvas.boardOffset;
          zoomRef.current = defaultCanvas.zoom;
        } else {
          // Create default canvas
          const defaultCanvas: Canvas = {
            id: Date.now().toString(),
            name: 'Canvas 1',
            images: [],
            pickedColors: [],
            boardOffset: { x: 0, y: 0 },
            zoom: 1
          };
          setCanvases([defaultCanvas]);
          setActiveCanvasId(defaultCanvas.id);
          activeCanvasIdRef.current = defaultCanvas.id;
        }
      } catch (e) {
        console.error('Failed to load saved data:', e);
        const defaultCanvas: Canvas = {
          id: Date.now().toString(),
          name: 'Canvas 1',
          images: [],
          pickedColors: [],
          boardOffset: { x: 0, y: 0 },
          zoom: 1
        };
        setCanvases([defaultCanvas]);
        setActiveCanvasId(defaultCanvas.id);
        activeCanvasIdRef.current = defaultCanvas.id;
      } finally {
        setIsLoading(false);
      }
    };

    loadInitialData();
  }, []);

  // Auto-save to IndexedDB (debounced)
  useEffect(() => {
    if (isLoading) return; // Don't save during initial load

    const timeoutId = setTimeout(async () => {
      const dataToSave = {
        canvases,
        activeCanvasId
      };
      try {
        await saveData(STORAGE_KEY, dataToSave);
        // Update storage info after save
        const estimate = await getStorageEstimate();
        setStorageInfo(estimate);
      } catch (e) {
        console.error('Failed to save data:', e);
        // If quota exceeded, try clearing old data
        if (e instanceof DOMException && e.name === 'QuotaExceededError') {
          alert('Storage quota exceeded. Please remove some images to free up space.');
        }
      }
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [canvases, activeCanvasId, isLoading]);

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

  // Touch support for mobile
  useEffect(() => {
    const board = boardRef.current;
    if (!board) return;

    let touchStartPos = { x: 0, y: 0 };
    let isTouchPanning = false;

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 1) {
        const touch = e.touches[0];
        const target = e.target as HTMLElement;
        const isImageElement = target.tagName === 'IMG' || target.closest('[data-image-id]');
        
        if (!isImageElement || isPanningModeRef.current) {
          isTouchPanning = true;
          touchStartPos = { x: touch.clientX, y: touch.clientY };
          setIsPanning(true);
          isPanningRef.current = true;
          setPanStart(touchStartPos);
          panStartRef.current = touchStartPos;
        }
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (isTouchPanning && e.touches.length === 1) {
        e.preventDefault();
        const touch = e.touches[0];
        const dx = touch.clientX - panStartRef.current.x;
        const dy = touch.clientY - panStartRef.current.y;
        const newOffset = { x: boardOffsetRef.current.x + dx, y: boardOffsetRef.current.y + dy };
        boardOffsetRef.current = newOffset;
        setBoardOffset(newOffset);
        panStartRef.current = { x: touch.clientX, y: touch.clientY };
        setPanStart({ x: touch.clientX, y: touch.clientY });
      }
    };

    const handleTouchEnd = () => {
      isTouchPanning = false;
      setIsPanning(false);
      isPanningRef.current = false;
    };

    board.addEventListener('touchstart', handleTouchStart, { passive: false });
    board.addEventListener('touchmove', handleTouchMove, { passive: false });
    board.addEventListener('touchend', handleTouchEnd);

    return () => {
      board.removeEventListener('touchstart', handleTouchStart);
      board.removeEventListener('touchmove', handleTouchMove);
      board.removeEventListener('touchend', handleTouchEnd);
    };
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
        e.preventDefault();
        const scaleFactor = e.deltaY > 0 ? 0.95 : 1.05;
        setImages(prev => prev.map(img => {
          if (img.id === selectedImageId) {
            const ratio = img.height / img.width;
            const newWidth = Math.max(50, Math.min(2000, img.width * scaleFactor));
            const newHeight = newWidth * ratio;
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

  // Compress image to save storage
  const compressImage = (src: string, maxWidth = 800, quality = 0.8): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        
        if (width > maxWidth) {
          const ratio = maxWidth / width;
          width = maxWidth;
          height = height * ratio;
        }
        
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(src);
          return;
        }
        
        ctx.drawImage(img, 0, 0, width, height);
        // Use JPEG for better compression (except for images with transparency)
        const compressed = canvas.toDataURL('image/jpeg', quality);
        resolve(compressed);
      };
      img.onerror = () => resolve(src);
      img.src = src;
    });
  };

  const addImage = async (src: string, x?: number, y?: number) => {
    const img = new Image();
    img.onload = async () => {
      // Display dimensions (smaller for canvas)
      const maxDim = 400;
      let width = img.width;
      let height = img.height;
      if (width > maxDim || height > maxDim) {
        const ratio = Math.min(maxDim / width, maxDim / height);
        width *= ratio;
        height *= ratio;
      }
      
      // Compress the source for storage (larger but still compressed)
      const compressedSrc = await compressImage(src, 800, 0.8);
      
      const newImage: BoardImage = {
        id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
        src: compressedSrc,
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
    // If in grab mode or alt is held, don't interact with image - let it pan
    if (isPanningModeRef.current || e.altKey) {
      return; // Let event bubble to board handler
    }
    
    if (isColorPicking) return;
    e.stopPropagation();
    e.preventDefault();
    const img = images.find(i => i.id === id);
    if (!img) return;
    
    // Handle multi-select with Ctrl/Cmd
    if (e.ctrlKey || e.metaKey) {
      setSelectedImageIds(prev => {
        if (prev.includes(id)) {
          const newIds = prev.filter(i => i !== id);
          setSelectedImageId(newIds.length === 1 ? newIds[0] : null);
          return newIds;
        } else {
          return [...prev, id];
        }
      });
    } else {
      // If clicking on an already selected image, keep selection for dragging
      if (!selectedImageIds.includes(id)) {
        setSelectedImageIds([id]);
        setSelectedImageId(id);
      }
    }
    
    setDraggingId(id);
    draggingIdRef.current = id;
    
    // Save drag start position and initial positions of all selected images
    dragStartPosRef.current = { x: e.clientX, y: e.clientY };
    const positions = new Map<string, { x: number; y: number }>();
    
    // If clicking on a selected image, move all selected images
    if (selectedImageIds.includes(id)) {
      selectedImageIds.forEach(selectedId => {
        const selectedImg = images.find(i => i.id === selectedId);
        if (selectedImg) {
          positions.set(selectedId, { x: selectedImg.x, y: selectedImg.y });
        }
      });
    } else {
      // Otherwise, just move the clicked image
      positions.set(id, { x: img.x, y: img.y });
    }
    
    initialPositionsRef.current = positions;
    
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
    
    // Check if this is a group resize (multiple images selected)
    const isGroup = selectedImageIds.length > 1;
    setIsGroupResize(isGroup);
    isGroupResizeRef.current = isGroup;
    
    if (isGroup) {
      // Calculate bounding box of all selected images
      const selectedImages = images.filter(img => selectedImageIds.includes(img.id));
      const minX = Math.min(...selectedImages.map(img => img.x));
      const minY = Math.min(...selectedImages.map(img => img.y));
      const maxX = Math.max(...selectedImages.map(img => img.x + img.width));
      const maxY = Math.max(...selectedImages.map(img => img.y + img.height));
      
      groupBoundsRef.current = { minX, minY, maxX, maxY };
      
      // Store initial positions and sizes of all selected images
      const positions = new Map<string, { x: number; y: number; width: number; height: number }>();
      selectedImages.forEach(img => {
        positions.set(img.id, { x: img.x, y: img.y, width: img.width, height: img.height });
      });
      initialGroupPositionsRef.current = positions;
    }
    
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
    const currentIsSelecting = isSelectingRef.current;

    if (currentIsSelecting) {
      const rect = boardRef.current?.getBoundingClientRect();
      if (rect) {
        const endX = (e.clientX - rect.left - boardOffsetRef.current.x) / zoomRef.current;
        const endY = (e.clientY - rect.top - boardOffsetRef.current.y) / zoomRef.current;
        setSelectionBox(prev => prev ? { ...prev, endX, endY } : null);
      }
    } else if (currentResizingId) {
      const rect = boardRef.current?.getBoundingClientRect();
      if (rect) {
        const mouseX = (e.clientX - rect.left - boardOffsetRef.current.x) / zoomRef.current;
        const mouseY = (e.clientY - rect.top - boardOffsetRef.current.y) / zoomRef.current;
        const dx = mouseX - resizeStartRef.current.x;
        const dy = mouseY - resizeStartRef.current.y;
        
        // Check if this is a group resize
        if (isGroupResizeRef.current && groupBoundsRef.current) {
          const bounds = groupBoundsRef.current;
          const corner = resizeCornerRef.current;
          
          // Calculate new bounding box dimensions
          let newMinX = bounds.minX;
          let newMinY = bounds.minY;
          let newMaxX = bounds.maxX;
          let newMaxY = bounds.maxY;
          
          if (corner === 'br') {
            newMaxX = Math.max(bounds.minX + 50, bounds.maxX + dx);
            newMaxY = Math.max(bounds.minY + 50, bounds.maxY + dy);
          } else if (corner === 'bl') {
            newMinX = Math.min(bounds.maxX - 50, bounds.minX + dx);
            newMaxY = Math.max(bounds.minY + 50, bounds.maxY + dy);
          } else if (corner === 'tr') {
            newMaxX = Math.max(bounds.minX + 50, bounds.maxX + dx);
            newMinY = Math.min(bounds.maxY - 50, bounds.minY + dy);
          } else if (corner === 'tl') {
            newMinX = Math.min(bounds.maxX - 50, bounds.minX + dx);
            newMinY = Math.min(bounds.maxY - 50, bounds.minY + dy);
          }
          
          // Calculate scale factors
          const scaleX = (newMaxX - newMinX) / (bounds.maxX - bounds.minX);
          const scaleY = (newMaxY - newMinY) / (bounds.maxY - bounds.minY);
          
          // Update all selected images proportionally
          setImages(prev => prev.map(img => {
            const initialPos = initialGroupPositionsRef.current.get(img.id);
            if (!initialPos) return img;
            
            // Calculate relative position within bounding box
            const relX = (initialPos.x - bounds.minX) / (bounds.maxX - bounds.minX);
            const relY = (initialPos.y - bounds.minY) / (bounds.maxY - bounds.minY);
            const relWidth = initialPos.width / (bounds.maxX - bounds.minX);
            const relHeight = initialPos.height / (bounds.maxY - bounds.minY);
            
            // Apply new position and size
            const newX = newMinX + relX * (newMaxX - newMinX);
            const newY = newMinY + relY * (newMaxY - newMinY);
            const newWidth = relWidth * (newMaxX - newMinX);
            const newHeight = relHeight * (newMaxY - newMinY);
            
            return { ...img, x: newX, y: newY, width: newWidth, height: newHeight };
          }));
        } else {
          // Single image resize
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
        // Calculate total delta from drag start
        const totalDx = (e.clientX - dragStartPosRef.current.x) / zoomRef.current;
        const totalDy = (e.clientY - dragStartPosRef.current.y) / zoomRef.current;
        
        // Move all selected images to their initial position + total delta
        setImages(prev => prev.map(img => {
          const initialPos = initialPositionsRef.current.get(img.id);
          if (initialPos) {
            return { ...img, x: initialPos.x + totalDx, y: initialPos.y + totalDy };
          }
          return img;
        }));
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
    // Finalize selection box if selecting
    if (isSelectingRef.current && selectionBoxRef.current) {
      const box = selectionBoxRef.current;
      const selMinX = Math.min(box.startX, box.endX);
      const selMaxX = Math.max(box.startX, box.endX);
      const selMinY = Math.min(box.startY, box.endY);
      const selMaxY = Math.max(box.startY, box.endY);
      
      // Find images that intersect with selection box (any overlap)
      const selectedIds = images.filter(img => {
        const imgMinX = img.x;
        const imgMaxX = img.x + img.width;
        const imgMinY = img.y;
        const imgMaxY = img.y + img.height;
        
        // Check if rectangles intersect
        return !(imgMaxX < selMinX || imgMinX > selMaxX || 
                 imgMaxY < selMinY || imgMinY > selMaxY);
      }).map(img => img.id);
      
      setSelectedImageIds(selectedIds);
      if (selectedIds.length === 1) {
        setSelectedImageId(selectedIds[0]);
      } else {
        setSelectedImageId(null);
      }
      
      setIsSelecting(false);
      isSelectingRef.current = false;
      setSelectionBox(null);
      selectionBoxRef.current = null;
    }
    
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
    setIsGroupResize(false);
    isGroupResizeRef.current = false;
    
    // Clear initial positions after drag ends
    initialPositionsRef.current.clear();
    initialGroupPositionsRef.current.clear();
    groupBoundsRef.current = null;
  }, [images]);

  const handleBoardMouseDown = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    const isImageElement = target.tagName === 'IMG' || target.closest('[data-image-id]');
    const isGrabMode = e.altKey || isPanningModeRef.current;
    
    // Only deselect if not in grab mode and not clicking on an image
    if (!isImageElement && !isGrabMode) {
      setSelectedImageId(null);
      setSelectedImageIds([]);
      
      // Start selection box if not in grab mode
      if (e.button === 0) {
        const rect = boardRef.current?.getBoundingClientRect();
        if (rect) {
          const startX = (e.clientX - rect.left - boardOffsetRef.current.x) / zoomRef.current;
          const startY = (e.clientY - rect.top - boardOffsetRef.current.y) / zoomRef.current;
          setSelectionBox({ startX, startY, endX: startX, endY: startY });
          setIsSelecting(true);
          isSelectingRef.current = true;
        }
      }
    }
    
    // Start panning if middle mouse button, alt key, or grab mode is active
    if (e.button === 1 || (e.button === 0 && isGrabMode)) {
      e.preventDefault();
      setIsPanning(true);
      isPanningRef.current = true;
      const start = { x: e.clientX, y: e.clientY };
      setPanStart(start);
      panStartRef.current = start;
    }
  }, []);

  const deleteImage = (id: string) => {
    setImages(prev => prev.filter(img => img.id !== id));
    if (selectedImageId === id) setSelectedImageId(null);
  };

  // Layer control functions
  const bringForward = (id: string) => {
    setImages(prev => {
      const index = prev.findIndex(img => img.id === id);
      if (index === -1 || index === prev.length - 1) return prev; // Already at front
      const newImages = [...prev];
      [newImages[index], newImages[index + 1]] = [newImages[index + 1], newImages[index]];
      return newImages;
    });
  };

  const sendBackward = (id: string) => {
    setImages(prev => {
      const index = prev.findIndex(img => img.id === id);
      if (index <= 0) return prev; // Already at back
      const newImages = [...prev];
      [newImages[index], newImages[index - 1]] = [newImages[index - 1], newImages[index]];
      return newImages;
    });
  };

  const bringToFront = (id: string) => {
    setImages(prev => {
      const index = prev.findIndex(img => img.id === id);
      if (index === -1 || index === prev.length - 1) return prev;
      const newImages = prev.filter(img => img.id !== id);
      newImages.push(prev[index]);
      return newImages;
    });
  };

  const sendToBack = (id: string) => {
    setImages(prev => {
      const index = prev.findIndex(img => img.id === id);
      if (index <= 0) return prev;
      const newImages = prev.filter(img => img.id !== id);
      newImages.unshift(prev[index]);
      return newImages;
    });
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
    const hsvVal = rgbToHsv(r, g, b);

    const color: PickedColor = { hex, rgb: { r, g, b }, hsv: hsvVal };
    setCurrentColor(color);
    setHsv(hsvVal);
    setIsColorPicking(false);
  };

  const saveColor = () => {
    if (!pickedColors.find(c => c.hex === currentColor.hex)) {
      setPickedColors(prev => [...prev, currentColor]);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(() => {
        setCopiedText(label);
        setTimeout(() => setCopiedText(''), 1500);
      }).catch(() => {
        fallbackCopy(text, label);
      });
    } else {
      fallbackCopy(text, label);
    }
  };

  const fallbackCopy = (text: string, label: string) => {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    try {
      document.execCommand('copy');
      setCopiedText(label);
      setTimeout(() => setCopiedText(''), 1500);
    } catch (err) {
      console.error('Copy failed:', err);
    }
    document.body.removeChild(textarea);
  };

  const handleColorWheelChange = useCallback((h: number, s: number, v: number) => {
    setHsv({ h, s, v });
    const rgb = hsvToRgb(h, s, v);
    const hex = rgbToHex(rgb.r, rgb.g, rgb.b);
    setCurrentColor({ hex, rgb, hsv: { h, s, v } });
  }, []);

  const clearBoard = () => {
    if (confirm('Clear all images from the board?')) {
      setImages([]);
    }
  };

  const clearColors = () => {
    setPickedColors([]);
  };

  // Loading screen
  if (isLoading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="mb-4 animate-pulse flex justify-center">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-500">
              <circle cx="13.5" cy="6.5" r=".5" fill="currentColor"></circle>
              <circle cx="17.5" cy="10.5" r=".5" fill="currentColor"></circle>
              <circle cx="8.5" cy="7.5" r=".5" fill="currentColor"></circle>
              <circle cx="6.5" cy="12.5" r=".5" fill="currentColor"></circle>
              <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2Z"></path>
            </svg>
          </div>
          <p className="text-lg font-medium text-gray-700">Loading Art Board...</p>
          <p className="text-sm text-gray-500 mt-1">Restoring your workspace</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen flex flex-col bg-gray-50 overflow-hidden">
      {/* Top Toolbar */}
      <div className="h-auto min-h-[3.5rem] bg-white border-b border-gray-200 flex flex-wrap items-center px-2 sm:px-4 gap-2 shadow-sm z-50">
        <div className="flex items-center gap-2">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-500">
            <circle cx="13.5" cy="6.5" r=".5" fill="currentColor"></circle>
            <circle cx="17.5" cy="10.5" r=".5" fill="currentColor"></circle>
            <circle cx="8.5" cy="7.5" r=".5" fill="currentColor"></circle>
            <circle cx="6.5" cy="12.5" r=".5" fill="currentColor"></circle>
            <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2Z"></path>
          </svg>
          <h1 className="text-sm sm:text-lg font-semibold text-gray-800">Art Board</h1>
          <span className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded font-mono hidden sm:inline">v0.8.2</span>
        </div>

        <div className="h-6 w-px bg-gray-200 mx-1 hidden sm:block" />

        <div className="flex items-center gap-1 sm:gap-2">
          <button
            onClick={() => {
              setIsPanningMode(!isPanningMode);
              setIsColorPicking(false);
            }}
            className={`px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-all flex items-center gap-1.5 ${
              isPanningMode
                ? 'bg-blue-100 text-blue-700 ring-2 ring-blue-300'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
            title="Pan canvas (or hold Alt + drag)"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 11V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v0"></path>
              <path d="M14 10V4a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v2"></path>
              <path d="M10 10.5V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v8"></path>
              <path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15"></path>
            </svg>
            <span className="hidden sm:inline">Grab</span>
          </button>

          <button
            onClick={() => {
              setIsColorPicking(!isColorPicking);
              setIsPanningMode(false);
            }}
            className={`px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-all flex items-center gap-1.5 ${
              isColorPicking
                ? 'bg-amber-100 text-amber-700 ring-2 ring-amber-300'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
            title="Color pick from image"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m19 11-8-8-8.6 8.6a2 2 0 0 0 0 2.8l5.2 5.2c.8.8 2 .8 2.8 0L19 11Z"></path>
              <path d="m5 2 5 5"></path>
              <path d="M2 13h15"></path>
              <path d="M22 20a2 2 0 1 1-4 0c0-1.6 1.7-2.4 2-4 .3 1.6 2 2.4 2 4Z"></path>
            </svg>
            <span className="hidden sm:inline">Color Pick</span>
          </button>

          <button
            onClick={() => setShowColorPanel(!showColorPanel)}
            className={`px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-all flex items-center gap-1.5 ${
              showColorPanel
                ? 'bg-blue-100 text-blue-700'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="13.5" cy="6.5" r=".5" fill="currentColor"></circle>
              <circle cx="17.5" cy="10.5" r=".5" fill="currentColor"></circle>
              <circle cx="8.5" cy="7.5" r=".5" fill="currentColor"></circle>
              <circle cx="6.5" cy="12.5" r=".5" fill="currentColor"></circle>
              <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2Z"></path>
            </svg>
            <span className="hidden sm:inline">Colors</span>
          </button>

          <button
            onClick={clearBoard}
            className="px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg text-xs sm:text-sm font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 transition-all flex items-center gap-1.5"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 6h18"></path>
              <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path>
              <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path>
            </svg>
            <span className="hidden sm:inline">Clear</span>
          </button>
        </div>

        <div className="flex-1" />

        <div className="flex items-center gap-2 text-xs sm:text-sm text-gray-500">
          <span>{Math.round(zoom * 100)}%</span>
          <button
            onClick={() => setZoom(1)}
            className="px-2 py-1 rounded bg-gray-100 hover:bg-gray-200 text-xs"
          >
            Reset
          </button>
        </div>

        {storageInfo && (
          <div 
            className="text-xs text-gray-400 flex items-center gap-1 hidden sm:flex"
            title={`${(storageInfo.usage / 1024 / 1024).toFixed(2)} MB / ${(storageInfo.quota / 1024 / 1024).toFixed(0)} MB used`}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z"></path>
            </svg>
            <span>{(storageInfo.usage / 1024 / 1024).toFixed(1)}MB</span>
          </div>
        )}

        <div className="text-xs text-gray-400 hidden lg:block">
          Drag to select multiple • Ctrl+Click to add • Drag selected to move • Alt+Drag to pan
        </div>
      </div>

      {/* Canvas Tabs */}
      <div className="h-8 sm:h-10 bg-gray-100 border-b border-gray-200 flex items-center px-1 sm:px-2 gap-1 overflow-x-auto">
        {canvases.map((canvas) => (
          <div
            key={canvas.id}
            className={`flex items-center gap-1 px-2 sm:px-3 py-1 sm:py-1.5 rounded-t-lg text-xs sm:text-sm cursor-pointer transition-all whitespace-nowrap ${
              canvas.id === activeCanvasId
                ? 'bg-white text-gray-800 font-medium border-b-2 border-blue-500'
                : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
            }`}
            onClick={() => switchCanvas(canvas.id)}
          >
            <span>{canvas.name}</span>
            {canvases.length > 1 && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  removeCanvas(canvas.id);
                }}
                className="ml-1 w-3 h-3 sm:w-4 sm:h-4 flex items-center justify-center rounded hover:bg-red-100 hover:text-red-600 text-xs"
                title="Remove canvas"
              >
                ×
              </button>
            )}
          </div>
        ))}
        <button
          onClick={addCanvas}
          className="px-2 sm:px-3 py-1 sm:py-1.5 rounded-t-lg text-xs sm:text-sm bg-gray-200 text-gray-600 hover:bg-gray-300 transition-all whitespace-nowrap"
          title="Add new canvas"
        >
          + <span className="hidden sm:inline">Add Canvas</span>
        </button>
      </div>

      <div className="flex flex-col lg:flex-row flex-1 overflow-hidden">
        {/* Main Board */}
        <div
          ref={boardRef}
          className="flex-1 relative overflow-hidden board-bg min-h-[300px]"
          style={{
            cursor: isColorPicking ? 'crosshair' : isPanningMode ? (isPanning ? 'grabbing' : 'grab') : isPanning ? 'grabbing' : 'default',
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
            {/* Group resize overlay */}
            {selectedImageIds.length > 1 && (() => {
              const selectedImages = images.filter(i => selectedImageIds.includes(i.id));
              if (selectedImages.length === 0) return null;
              
              const minX = Math.min(...selectedImages.map(i => i.x));
              const minY = Math.min(...selectedImages.map(i => i.y));
              const maxX = Math.max(...selectedImages.map(i => i.x + i.width));
              const maxY = Math.max(...selectedImages.map(i => i.y + i.height));
              
              return (
                <div
                  className="absolute pointer-events-none"
                  style={{
                    left: minX,
                    top: minY,
                    width: maxX - minX,
                    height: maxY - minY,
                    zIndex: 999
                  }}
                >
                  {/* Group bounding box outline */}
                  <div
                    className="absolute inset-0 border-2 border-purple-400 border-dashed pointer-events-none"
                  />
                  
                  {/* Top-left handle */}
                  <div
                    className="absolute w-3 h-3 bg-white border-2 border-purple-500 rounded-sm cursor-nwse-resize hover:scale-125 transition-transform pointer-events-auto"
                    style={{
                      left: -6,
                      top: -6,
                      zIndex: 20
                    }}
                    onMouseDown={(e) => handleResizeMouseDown(e, selectedImages[0].id, 'tl')}
                  />
                  {/* Top-right handle */}
                  <div
                    className="absolute w-3 h-3 bg-white border-2 border-purple-500 rounded-sm cursor-nesw-resize hover:scale-125 transition-transform pointer-events-auto"
                    style={{
                      right: -6,
                      top: -6,
                      zIndex: 20
                    }}
                    onMouseDown={(e) => handleResizeMouseDown(e, selectedImages[0].id, 'tr')}
                  />
                  {/* Bottom-left handle */}
                  <div
                    className="absolute w-3 h-3 bg-white border-2 border-purple-500 rounded-sm cursor-nesw-resize hover:scale-125 transition-transform pointer-events-auto"
                    style={{
                      left: -6,
                      bottom: -6,
                      zIndex: 20
                    }}
                    onMouseDown={(e) => handleResizeMouseDown(e, selectedImages[0].id, 'bl')}
                  />
                  {/* Bottom-right handle */}
                  <div
                    className="absolute w-3 h-3 bg-white border-2 border-purple-500 rounded-sm cursor-nwse-resize hover:scale-125 transition-transform pointer-events-auto"
                    style={{
                      right: -6,
                      bottom: -6,
                      zIndex: 20
                    }}
                    onMouseDown={(e) => handleResizeMouseDown(e, selectedImages[0].id, 'br')}
                  />
                </div>
              );
            })()}
            
            {images.map(img => (
              <div
                key={img.id}
                data-image-id={img.id}
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
                    cursor: isPanningMode ? (isPanning ? 'grabbing' : 'grab') : isColorPicking ? 'crosshair' : 'move',
                    pointerEvents: isPanningMode ? 'none' : 'auto'
                  }}
                  onMouseDown={(e) => {
                    if (isColorPicking) {
                      handleColorPickClick(e, img.id);
                    } else {
                      handleImageMouseDown(e, img.id);
                    }
                  }}
                  onClick={(e) => {
                    if (!isColorPicking && !isPanningMode) {
                      e.stopPropagation();
                      setSelectedImageId(img.id);
                    }
                  }}
                  draggable={false}
                />

                {/* Selection border and handles */}
                {(selectedImageId === img.id || selectedImageIds.includes(img.id)) && !isColorPicking && (
                  <>
                    <div 
                      className={`absolute inset-0 rounded-lg ring-2 pointer-events-none ${
                        selectedImageIds.includes(img.id) && selectedImageIds.length > 1 
                          ? 'ring-purple-400' 
                          : 'ring-blue-400'
                      }`}
                      style={{ zIndex: 10 }} 
                    />
                    
                    {/* Resize handles for multi-selection - rendered separately below */}
                    
                    <div
                      className="absolute -top-8 left-1/2 -translate-x-1/2 w-4 h-4 bg-white border-2 border-blue-400 rounded-full cursor-grab active:cursor-grabbing shadow-sm hover:scale-110 transition-transform"
                      style={{ zIndex: 20 }}
                      onMouseDown={(e) => handleRotateMouseDown(e, img.id)}
                    />
                    <div className="absolute -top-6 left-1/2 -translate-x-1/2 w-0.5 h-4 bg-blue-400 pointer-events-none" style={{ zIndex: 15 }} />
                    
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

                    {/* Layer controls toolbar - only show for single selection */}
                    {selectedImageId === img.id && selectedImageIds.length <= 1 && (
                    <div 
                      className="absolute top-1/2 -right-14 -translate-y-1/2 flex flex-col gap-0.5 bg-white rounded-lg shadow-lg px-1.5 py-1 border border-gray-200"
                      style={{ zIndex: 30 }}
                    >
                      <button
                        onClick={() => sendToBack(img.id)}
                        className="w-7 h-7 flex items-center justify-center rounded hover:bg-gray-100 transition-colors"
                        title="Send to back"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="7 13 12 18 17 13"></polyline>
                          <polyline points="7 6 12 11 17 6"></polyline>
                        </svg>
                      </button>
                      <button
                        onClick={() => sendBackward(img.id)}
                        className="w-7 h-7 flex items-center justify-center rounded hover:bg-gray-100 transition-colors"
                        title="Send backward"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <line x1="12" y1="5" x2="12" y2="19"></line>
                          <polyline points="19 12 12 19 5 12"></polyline>
                        </svg>
                      </button>
                      <div className="h-px w-5 bg-gray-200 my-0.5" />
                      <button
                        onClick={() => bringForward(img.id)}
                        className="w-7 h-7 flex items-center justify-center rounded hover:bg-gray-100 transition-colors"
                        title="Bring forward"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <line x1="12" y1="19" x2="12" y2="5"></line>
                          <polyline points="5 12 12 5 19 12"></polyline>
                        </svg>
                      </button>
                      <button
                        onClick={() => bringToFront(img.id)}
                        className="w-7 h-7 flex items-center justify-center rounded hover:bg-gray-100 transition-colors"
                        title="Bring to front"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="17 11 12 6 7 11"></polyline>
                          <polyline points="17 18 12 13 7 18"></polyline>
                        </svg>
                      </button>
                      <div className="h-px w-5 bg-gray-200 my-0.5" />
                      <button
                        onClick={() => deleteImage(img.id)}
                        className="w-7 h-7 flex items-center justify-center rounded hover:bg-red-50 text-red-500 transition-colors"
                        title="Delete"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <line x1="18" y1="6" x2="6" y2="18"></line>
                          <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                      </button>
                    </div>
                    )}
                    
                    {/* Multi-selection counter */}
                    {selectedImageIds.includes(img.id) && selectedImageIds.length > 1 && selectedImageId === img.id && (
                      <div 
                        className="absolute -top-10 left-1/2 -translate-x-1/2 bg-purple-500 text-white px-3 py-1 rounded-full shadow-lg text-xs font-medium whitespace-nowrap"
                        style={{ zIndex: 30 }}
                      >
                        {selectedImageIds.length} images selected
                      </div>
                    )}
                  </>
                )}
              </div>
            ))}
          </div>

          {images.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="text-center text-gray-400">
                <div className="text-6xl mb-4">📋</div>
                <p className="text-lg font-medium">Paste or drop images here</p>
                <p className="text-sm mt-1">Ctrl+V to paste • Drag & drop files</p>
              </div>
            </div>
          )}

          {isColorPicking && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-amber-500 text-white px-4 py-2 rounded-full shadow-lg text-sm font-medium animate-pulse">
              Click on an image to pick a color
            </div>
          )}

          {copiedText && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-green-500 text-white px-4 py-2 rounded-full shadow-lg text-sm font-medium">
              ✓ {copiedText} copied!
            </div>
          )}

          {/* Selection Box */}
          {selectionBox && (
            <div
              className="absolute border-2 border-blue-500 bg-blue-400/50 pointer-events-none rounded-sm"
              style={{
                left: Math.min(selectionBox.startX, selectionBox.endX) * zoom + boardOffset.x,
                top: Math.min(selectionBox.startY, selectionBox.endY) * zoom + boardOffset.y,
                width: Math.abs(selectionBox.endX - selectionBox.startX) * zoom,
                height: Math.abs(selectionBox.endY - selectionBox.startY) * zoom,
                boxShadow: '0 0 0 1px rgba(59, 130, 246, 0.3)',
                zIndex: 9999,
              }}
            />
          )}
        </div>

        {/* Color Panel */}
        {showColorPanel && (
          <div className="
            w-full lg:w-80 
            bg-white border-t lg:border-t-0 lg:border-l border-gray-200 
            flex flex-col overflow-hidden shadow-lg lg:shadow-sm
            max-h-[50vh] lg:max-h-none
          ">
            {/* Mobile close button */}
            <button
              onClick={() => setShowColorPanel(false)}
              className="lg:hidden absolute top-2 right-2 w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 text-gray-600 z-10"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
              
              <div className="p-4 border-b border-gray-100">
                <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"></circle>
                    <circle cx="12" cy="12" r="6"></circle>
                    <circle cx="12" cy="12" r="2"></circle>
                  </svg>
                  Color Wheel
                </h3>
              <div className="flex justify-center">
                <ColorWheel
                  hue={hsv.h}
                  saturation={hsv.s}
                  value={hsv.v}
                  onChange={handleColorWheelChange}
                  size={colorWheelSize}
                />
              </div>
              
              {/* HSV Sliders */}
              <div className="mt-4 space-y-3">
                <div>
                  <label className="text-xs text-gray-600 mb-1 block">Hue ({hsv.h}°)</label>
                  <input
                    type="range"
                    min="0"
                    max="360"
                    value={hsv.h}
                    onChange={(e) => handleColorWheelChange(Number(e.target.value), hsv.s, hsv.v)}
                    className="w-full h-2 rounded-lg appearance-none cursor-pointer"
                    style={{
                      background: `linear-gradient(to right, 
                        hsl(0, 100%, 50%), 
                        hsl(60, 100%, 50%), 
                        hsl(120, 100%, 50%), 
                        hsl(180, 100%, 50%), 
                        hsl(240, 100%, 50%), 
                        hsl(300, 100%, 50%), 
                        hsl(360, 100%, 50%))`
                    }}
                  />
                </div>
                
                <div>
                  <label className="text-xs text-gray-600 mb-1 block">Saturation ({hsv.s}%)</label>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={hsv.s}
                    onChange={(e) => handleColorWheelChange(hsv.h, Number(e.target.value), hsv.v)}
                    className="w-full h-2 rounded-lg appearance-none cursor-pointer"
                    style={{
                      background: `linear-gradient(to right, 
                        rgb(${Math.round(hsv.v * 2.55)}, ${Math.round(hsv.v * 2.55)}, ${Math.round(hsv.v * 2.55)}), 
                        ${(() => {
                          const rgb = hsvToRgb(hsv.h, 100, hsv.v);
                          return `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;
                        })()})`
                    }}
                  />
                </div>
                
                <div>
                  <label className="text-xs text-gray-600 mb-1 block">Value ({hsv.v}%)</label>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={hsv.v}
                    onChange={(e) => handleColorWheelChange(hsv.h, hsv.s, Number(e.target.value))}
                    className="w-full h-2 rounded-lg appearance-none cursor-pointer"
                    style={{
                      background: `linear-gradient(to right, 
                        rgb(0, 0, 0), 
                        ${(() => {
                          const rgb = hsvToRgb(hsv.h, hsv.s, hsv.v);
                          return `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;
                        })()})`
                    }}
                  />
                </div>
              </div>
            </div>

            <div className="p-4 border-b border-gray-100">
              <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                  <circle cx="9" cy="9" r="2"></circle>
                  <circle cx="15" cy="15" r="2"></circle>
                </svg>
                Current Color
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
                    <span className="text-xs text-gray-500">HSV</span>
                    <button
                      onClick={() => copyToClipboard(`hsv(${currentColor.hsv.h}, ${currentColor.hsv.s}%, ${currentColor.hsv.v}%)`, 'HSV')}
                      className="text-xs font-mono bg-gray-100 px-2 py-0.5 rounded hover:bg-gray-200 transition-colors"
                    >
                      {currentColor.hsv.h}°, {currentColor.hsv.s}%, {currentColor.hsv.v}%
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

            <div className="flex-1 overflow-y-auto p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2" y="2" width="20" height="20" rx="2"></rect>
                    <rect x="6" y="6" width="4" height="4" rx="0.5"></rect>
                    <rect x="14" y="6" width="4" height="4" rx="0.5"></rect>
                    <rect x="6" y="14" width="4" height="4" rx="0.5"></rect>
                    <rect x="14" y="14" width="4" height="4" rx="0.5"></rect>
                  </svg>
                  Palette ({pickedColors.length})
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
                          setHsv(color.hsv);
                        }}
                        className="w-full aspect-square rounded-lg shadow-sm border border-gray-200 hover:scale-110 transition-transform"
                        style={{ backgroundColor: color.hex }}
                        title={`${color.hex}\nRGB: ${color.rgb.r}, ${color.rgb.g}, ${color.rgb.b}\nHSV: ${color.hsv.h}°, ${color.hsv.s}%, ${color.hsv.v}%`}
                      />
                      <button
                        onClick={() => copyToClipboard(color.hex, 'HEX')}
                        className="absolute -top-1 -right-1 w-4 h-4 bg-white rounded-full shadow text-[8px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                        </svg>
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

export default App;
