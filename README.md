# Art Board - Reference Collector MADE BY QWEN

A web-based tool for collecting and organizing art references. Perfect for artists, designers, and creative professionals who need to gather inspiration, pick colors, and organize visual references.

![Art Board](https://img.shields.io/badge/Art-Board-blue?style=for-the-badge)
![React](https://img.shields.io/badge/React-18-61dafb?style=flat-square&logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178c6?style=flat-square&logo=typescript)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-3-38bdf8?style=flat-square&logo=tailwind-css)

##  [✨ DEMO HERE ✨](https://natthapongsu.github.io/Ref-Collecting-Board/)

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
- **Color wheel** with triangle picker (HSV)
- **Color palette** - Save and organize picked colors
- **Copy color codes** - HEX, RGB, and HSV formats
- **Visual indicators** - See color position in the wheel

### 🖼️ Canvas Features
- **Infinite canvas** - Pan and zoom freely
- **Auto-save** - All data saved to browser cache (IndexedDB)
- **Light theme** - Clean, minimal interface
- **Dot grid background** - Visual reference for positioning

## 🚀 Quick Start

### Windows Users
Simply double-click `quickstart.bat` and follow the menu!

### Manual Setup

#### Development
```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
```

#### Production
```bash
# Install dependencies
npm install

# Build the project
npm run build

# Preview production build
npm run preview
```

## 🎯 Use Cases

- **Art Reference Boards** - Collect inspiration for projects
- **Color Palette Creation** - Extract and organize colors from images
- **Mood Boards** - Organize visual references for design projects
- **Character Design** - Gather references for character development
- **Scene Planning** - Collect visual references for environments

## 💾 Data Storage

All data is automatically saved to your browser's IndexedDB:
- Images (stored as compressed base64)
- Color palettes
- Canvas position and zoom
- Image positions and transformations

**Storage Capacity:** ~10GB (varies by browser)
**Note:** Data is stored locally in your browser. Clearing browser data will remove saved content.

## 🛠️ Tech Stack

- **React 18** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool
- **Tailwind CSS** - Styling
- **IndexedDB** - Client-side storage
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
