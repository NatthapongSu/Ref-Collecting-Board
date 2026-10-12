# Art Board - Reference Collector

A web-based tool for collecting and organizing art references. Perfect for artists, designers, and creative professionals who need to gather inspiration, pick colors, and organize visual references.

![Art Board](https://img.shields.io/badge/Art-Board-blue?style=for-the-badge)
![React](https://img.shields.io/badge/React-18-61dafb?style=flat-square&logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178c6?style=flat-square&logo=typescript)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-3-38bdf8?style=flat-square&logo=tailwind-css)

## ✨ Features

### 📋 Image Management
- **Paste images** directly from clipboard (Ctrl+V)
- **Drag & drop** images onto the canvas
- **Move images** freely by dragging
- **Resize** with corner handles (maintains aspect ratio)
- **Rotate** with the top handle
- **Quick scale** with mouse wheel when image is selected
- **Delete** images with the delete button

### 🎨 Color Tools
- **Eyedropper tool** - Pick colors from any image
- **Color wheel** with triangle picker (HSL)
- **Color palette** - Save and organize picked colors
- **Copy color codes** - HEX, RGB, and HSL formats
- **Visual indicators** - See color position in the wheel

### 🖼️ Canvas Features
- **Infinite canvas** - Pan and zoom freely
- **Auto-save** - All data saved to browser cache
- **Light theme** - Clean, minimal interface
- **Dot grid background** - Visual reference for positioning

## 🚀 Quick Start

### Windows Users
Simply double-click one of the batch files:

- **`start.bat`** - Start development server (auto-installs dependencies)
- **`build.bat`** - Build production version

### Manual Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Start development server:**
   ```bash
   npm run dev
   ```

3. **Open in browser:**
   Navigate to `http://localhost:5173`

4. **Build for production:**
   ```bash
   npm run build
   ```

## 📖 How to Use

### Adding Images
1. **Paste:** Press `Ctrl+V` with an image in your clipboard
2. **Drag & Drop:** Drag image files from your computer onto the canvas
3. **File Input:** Click the upload button in the toolbar

### Moving & Transforming Images
- **Move:** Click and drag the image
- **Resize:** Drag any corner handle (white squares)
- **Rotate:** Drag the top circular handle
- **Scale:** Select image and scroll mouse wheel
- **Delete:** Click the × button in the toolbar

### Picking Colors
1. Click the **Eyedropper** button (💧) in the toolbar
2. Click anywhere on an image to pick that color
3. The color appears in the color panel with HEX, RGB, and HSL codes
4. Click any code to copy it to clipboard
5. Click **Save to Palette** to keep the color

### Using the Color Wheel
- **Outer ring:** Click/drag to select hue (0-360°)
- **Triangle:** Click/drag to adjust saturation and lightness
  - Top point: Pure color (100% saturation)
  - Bottom-left: White (0% saturation)
  - Bottom-right: Black (0% lightness)

### Canvas Navigation
- **Pan:** Hold `Alt` + drag on empty space
- **Zoom:** Hold `Ctrl` + scroll mouse wheel
- **Reset zoom:** Click the "Reset" button in toolbar

## 🎯 Use Cases

- **Art Reference Boards** - Collect inspiration for projects
- **Color Palette Creation** - Extract and organize colors from images
- **Mood Boards** - Organize visual references for design projects
- **Character Design** - Gather references for character development
- **Scene Planning** - Collect visual references for environments

## 💾 Data Storage

All data is automatically saved to your browser's localStorage:
- Images (stored as base64)
- Color palettes
- Canvas position and zoom
- Image positions and transformations

**Note:** Data is stored locally in your browser. Clearing browser data will remove saved content.

## 🛠️ Tech Stack

- **React 18** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool
- **Tailwind CSS** - Styling
- **Canvas API** - Color wheel rendering

## 📝 Tips

- Use `Ctrl+Z` to undo (browser native)
- Hold `Shift` while dragging for straight lines
- Double-click an image to select it quickly
- Use the color wheel triangle for precise color adjustments
- Save frequently used colors to your palette

## 🐛 Troubleshooting

**Images not pasting?**
- Make sure you're copying actual image data, not file paths
- Try drag & drop instead

**Colors not accurate?**
- The eyedropper picks from the displayed image
- Zoom in for more precise color picking

**Performance issues?**
- Limit the number of images on the canvas
- Clear old images you no longer need

## 📄 License

MIT License - Feel free to use and modify!

## 🤝 Contributing

Contributions welcome! Feel free to open issues or submit pull requests.

---

Made with ❤️ for artists and designers
