import { Theme } from '../types';

export const THEME_PRESETS: Theme[] = [
  // --- STRICT INTENT PALETTES ---
  {
    name: 'Crimson Offensive',
    category: 'Aggressive',
    primaryColor: '#fb923c', // Orange-400
    backgroundColor: '#450a0a', // Red-950 (Deep Crimson)
    textColor: '#ffedd5', // Orange-100
    titleFont: 'Oswald',
    bodyFont: 'Roboto',
  },
  {
    name: 'Teal Shield',
    category: 'Defensive',
    primaryColor: '#2dd4bf', // Teal-400
    backgroundColor: '#0f172a', // Slate-900 (Navy)
    textColor: '#e0f2fe', // Sky-100
    titleFont: 'Montserrat',
    bodyFont: 'Inter',
  },
  {
    name: 'Slate Educational',
    category: 'Educational',
    primaryColor: '#334155', // Slate-700
    backgroundColor: '#ffffff', // White
    textColor: '#0f172a', // Slate-900
    titleFont: 'Roboto Slab',
    bodyFont: 'Lato',
  },
  // --- EXISTING PRESETS ---
  {
    name: 'Konsepto ng Demand',
    category: 'Educational',
    primaryColor: '#ec4899', // Vibrant Pink
    backgroundColor: '#1F2937', // Dark Charcoal Blue
    textColor: '#D1D5DB', // Soft Light Gray
    titleFont: 'Playfair Display',
    bodyFont: 'Inter',
  },
  {
    name: 'Crimson Scholar',
    category: 'Educational',
    primaryColor: '#dc2626', // Red-600
    backgroundColor: '#111827', // Gray-900
    textColor: '#E5E7EB', // Gray-200
    titleFont: 'Lora',
    bodyFont: 'Lato',
  },
  {
    name: 'Deep Dive',
    category: 'Educational',
    primaryColor: '#2dd4bf', // Teal-400
    backgroundColor: '#0f172a', // Slate-900
    textColor: '#cbd5e1', // Slate-300
    titleFont: 'Roboto Slab',
    bodyFont: 'Roboto',
  },
  {
    name: 'Golden Ratio',
    category: 'Elegant',
    primaryColor: '#f59e0b', // Amber-500
    backgroundColor: '#18181b', // Zinc-900
    textColor: '#d4d4d4', // Zinc-300
    titleFont: 'Playfair Display',
    bodyFont: 'Merriweather',
  },
  {
    name: 'Modern Manuscript',
    category: 'Minimal',
    primaryColor: '#db2777', // Pink-600
    backgroundColor: '#f9fafb', // Gray-50
    textColor: '#1f2937', // Gray-800
    titleFont: 'Playfair Display',
    bodyFont: 'Inter',
  },
  {
    name: 'Academic Ink',
    category: 'Minimal',
    primaryColor: '#f472b6', // Pink-400
    backgroundColor: '#0a0a0a', // Near Black
    textColor: '#e5e5e5', // Neutral-200
    titleFont: 'Lora',
    bodyFont: 'Inter',
  },
  {
    name: 'Cybernetic Blue',
    category: 'Tech',
    primaryColor: '#00FFFF', // Cyan
    backgroundColor: '#001F3F', // Navy Blue
    textColor: '#EAEAEA', // Light Gray
    titleFont: 'Montserrat',
    bodyFont: 'Inter',
  },
  {
    name: 'Nebula Noir',
    category: 'Corporate',
    primaryColor: '#8b5cf6', // A nice purple
    backgroundColor: '#111827', // Gray 900
    textColor: '#d1d5db', // Gray 300
    titleFont: 'Montserrat',
    bodyFont: 'Lato',
  },
  {
    name: 'Oceanic Deep',
    category: 'Creative',
    primaryColor: '#4fe7b3', // Brighter Emerald (WCAG AA compliant)
    backgroundColor: '#0c243b', // Dark blue
    textColor: '#e0f2fe', // Light blue
    titleFont: 'Roboto Slab',
    bodyFont: 'Roboto',
  },
  {
    name: 'Solar Flare',
    category: 'Bold',
    primaryColor: '#f97316', // Orange 500
    backgroundColor: '#262626', // Neutral 800
    textColor: '#fafafa', // Neutral 50
    titleFont: 'Poppins',
    bodyFont: 'Open Sans',
  },
  {
    name: 'Charcoal & Gold',
    category: 'Elegant',
    primaryColor: '#f59e0b', // Amber 500
    backgroundColor: '#171717', // Neutral 900
    textColor: '#e5e5e5', // Neutral 200
    titleFont: 'Playfair Display',
    bodyFont: 'Lato',
  },
  {
    name: 'Crimson Tech',
    category: 'Tech',
    primaryColor: '#ef4444', // Red 500 (WCAG AA compliant)
    backgroundColor: '#1f2937', // Gray 800
    textColor: '#f3f4f6', // Gray 100
    titleFont: 'Poppins',
    bodyFont: 'Inter',
  },
  {
    name: 'Retro Wave',
    category: 'Retro',
    primaryColor: '#f472b6', // Pink 400
    backgroundColor: '#1e1b4b', // Indigo 950
    textColor: '#a5b4fc', // Indigo 300
    titleFont: 'Orbitron',
    bodyFont: 'Source Code Pro',
  },
  {
    name: 'Monochrome Film',
    category: 'Minimal',
    primaryColor: '#ffffff', // White
    backgroundColor: '#171717', // Neutral 900
    textColor: '#d4d4d4', // Neutral 300
    titleFont: 'Source Code Pro',
    bodyFont: 'Source Code Pro',
  },
  {
    name: 'Urban Jungle',
    category: 'Bold',
    primaryColor: '#4d7c0f', // Lime 800
    backgroundColor: '#404040', // Neutral 700
    textColor: '#f5f5f5', // Neutral 100
    titleFont: 'Montserrat',
    bodyFont: 'Inter',
  },
  {
    name: 'Galactic Voyager',
    category: 'Futuristic',
    primaryColor: '#7c3aed', // Violet 600
    backgroundColor: '#020617', // Slate 950
    textColor: '#cbd5e1', // Slate 300
    titleFont: 'Turret Road',
    bodyFont: 'Source Code Pro',
  },
  {
    name: 'Peacock',
    category: 'Elegant',
    primaryColor: '#0d9488', // Teal 600
    backgroundColor: '#0f172a', // Slate 900
    textColor: '#94a3b8', // Slate 400
    titleFont: 'Playfair Display',
    bodyFont: 'Lato',
  },
  {
    name: 'Blueprint',
    category: 'Tech',
    primaryColor: '#f1f5f9', // Slate 100
    backgroundColor: '#1d4ed8', // Blue 700
    textColor: '#e2e8f0', // Slate 200
    titleFont: 'Source Code Pro',
    bodyFont: 'Source Code Pro',
  },
  {
    name: 'Mint Chocolate',
    category: 'Creative',
    primaryColor: '#5eead4', // Teal 300
    backgroundColor: '#27272a', // Zinc 800
    textColor: '#f4f4f5', // Zinc 100
    titleFont: 'Poppins',
    bodyFont: 'Roboto',
  },
  {
    name: 'Sunset Glow',
    category: 'Bold',
    primaryColor: '#fef08a', // Yellow 200
    backgroundColor: '#86198f', // Fuchsia 900
    textColor: '#fbcfe8', // Pink 200
    titleFont: 'Montserrat',
    bodyFont: 'Open Sans',
  },
  {
    name: 'Aqua Tech',
    category: 'Tech',
    primaryColor: '#2dd4bf', // Teal 400
    backgroundColor: '#1e293b', // Slate 800
    textColor: '#e2e8f0', // Slate 200
    titleFont: 'Orbitron',
    bodyFont: 'Inter',
  },
  {
    name: 'Espresso',
    category: 'Elegant',
    primaryColor: '#fef3c7', // Amber 100
    backgroundColor: '#422006', // Brown
    textColor: '#d2b48c', // Tan
    titleFont: 'Playfair Display',
    bodyFont: 'Lora',
  },
  {
    name: 'Mossy Rock',
    category: 'Nature',
    primaryColor: '#a3e635', // Lime 400
    backgroundColor: '#3f3f46', // Zinc 700
    textColor: '#f1f5f9', // Slate 100
    titleFont: 'Roboto Slab',
    bodyFont: 'Roboto',
  },
  {
    name: 'Royal Purple',
    category: 'Elegant',
    primaryColor: '#d8b4fe', // Purple 300
    backgroundColor: '#3b0764', // Purple
    textColor: '#f3e8ff', // Purple 100
    titleFont: 'Merriweather',
    bodyFont: 'Lato',
  },
  {
    name: 'Hacker Terminal',
    category: 'Tech',
    primaryColor: '#4ade80', // Green 400
    backgroundColor: '#0a0a0a', // Black
    textColor: '#a3e635', // Lime 400
    titleFont: 'Source Code Pro',
    bodyFont: 'Source Code Pro',
  },
  {
    name: 'Cosmic Dust',
    category: 'Futuristic',
    primaryColor: '#f472b6', // Pink 400
    backgroundColor: '#1e293b', // Slate 800
    textColor: '#93c5fd', // Blue 300
    titleFont: 'Turret Road',
    bodyFont: 'Montserrat',
  },
  {
    name: 'Crimson Night',
    category: 'Bold',
    primaryColor: '#f43f5e', // Rose 500
    backgroundColor: '#171717', // Neutral 900
    textColor: '#d4d4d4', // Neutral 300
    titleFont: 'Oswald',
    bodyFont: 'Roboto',
  },
  {
    name: 'Matrix Code',
    category: 'Futuristic',
    primaryColor: '#d946ef', // Fuchsia 500
    backgroundColor: '#0a0a0a',
    textColor: '#d946ef',
    titleFont: 'Turret Road',
    bodyFont: 'Source Code Pro',
  },
  {
    name: '80s Arcade',
    category: 'Retro',
    primaryColor: '#22d3ee', // Cyan 400
    backgroundColor: '#1e1b4b', // Indigo 950
    textColor: '#f472b6', // Pink 400
    titleFont: 'Orbitron',
    bodyFont: 'Poppins',
  },
  {
    name: 'Ruby Red',
    category: 'Elegant',
    primaryColor: '#e11d48', // Rose 600
    backgroundColor: '#171717', // Neutral 900
    textColor: '#e5e5e5', // Neutral 200
    titleFont: 'Playfair Display',
    bodyFont: 'Merriweather',
  },
  {
    name: 'Quantum',
    category: 'Futuristic',
    primaryColor: '#67e8f9', // Cyan 300
    backgroundColor: '#082f49', // Cyan 950
    textColor: '#e0f2fe', // Light blue
    titleFont: 'Orbitron',
    bodyFont: 'Inter',
  },
  {
    name: 'Fire and Ice',
    category: 'Bold',
    primaryColor: '#2563eb', // Blue 600
    backgroundColor: '#475569', // Slate 600
    textColor: '#f97316', // Orange 500
    titleFont: 'Oswald',
    bodyFont: 'Roboto',
  },
  {
    name: 'Graphene',
    category: 'Tech',
    primaryColor: '#84cc16', // Lime 500
    backgroundColor: '#18181b', // Zinc 900
    textColor: '#a1a1aa', // Zinc 400
    titleFont: 'Source Code Pro',
    bodyFont: 'Inter',
  },
  {
    name: 'Vibrant Night',
    category: 'Bold',
    primaryColor: '#eab308', // Yellow 500
    backgroundColor: '#1d2a3b',
    textColor: '#f0f9ff', // Sky 50
    titleFont: 'Oswald',
    bodyFont: 'Montserrat',
  },
  {
    name: 'Deep Forest',
    category: 'Nature',
    primaryColor: '#a3e635', // Lime 400
    backgroundColor: '#1a2e05',
    textColor: '#d4d4d4', // Neutral 300
    titleFont: 'Merriweather',
    bodyFont: 'Roboto Slab',
  },
  {
    name: 'Sleek Dark',
    category: 'Corporate',
    primaryColor: '#2dd4bf', // Teal 400
    backgroundColor: '#1f2937', // Gray 800
    textColor: '#d1d5db', // Gray 300
    titleFont: 'Poppins',
    bodyFont: 'Inter',
  },
  {
    name: 'Holonet',
    category: 'Futuristic',
    primaryColor: '#60a5fa', // Blue 400
    backgroundColor: '#0c0a09', // Stone 950
    textColor: '#bfdbfe', // Blue 200
    titleFont: 'Turret Road',
    bodyFont: 'Source Code Pro',
  },
  {
    name: 'Inferno',
    category: 'Bold',
    primaryColor: '#fef08a', // Yellow 200
    backgroundColor: '#7f1d1d', // Red 900
    textColor: '#fca5a5', // Red 300
    titleFont: 'Oswald',
    bodyFont: 'Montserrat',
  },
  // --- NEW THEMES ---
  // Category: Cyberpunk
  { name: 'Neon Blade', category: 'Cyberpunk', primaryColor: '#ff00ff', backgroundColor: '#0d0221', textColor: '#00f0ff', titleFont: 'Orbitron', bodyFont: 'Source Code Pro' },
  { name: 'Synthwave Sunset', category: 'Cyberpunk', primaryColor: '#f83a8b', backgroundColor: '#2a0b4d', textColor: '#fff568', titleFont: 'Turret Road', bodyFont: 'Montserrat' },
  { name: 'Glitch City', category: 'Cyberpunk', primaryColor: '#00ff00', backgroundColor: '#0a0a0a', textColor: '#f0f0f0', titleFont: 'Source Code Pro', bodyFont: 'Inter' },
  { name: 'Chrome Rebel', category: 'Cyberpunk', primaryColor: '#c0c0c0', backgroundColor: '#222222', textColor: '#00e5ff', titleFont: 'Montserrat', bodyFont: 'Roboto' },
  { name: 'Data Stream', category: 'Cyberpunk', primaryColor: '#39ff14', backgroundColor: '#000020', textColor: '#e0e0e0', titleFont: 'Source Code Pro', bodyFont: 'Source Code Pro' },
  
  // Category: Monochrome
  { name: 'Classic Noir', category: 'Monochrome', primaryColor: '#ffffff', backgroundColor: '#000000', textColor: '#e5e5e5', titleFont: 'Playfair Display', bodyFont: 'Lora' },
  { name: 'Charcoal Sketch', category: 'Monochrome', primaryColor: '#eeeeee', backgroundColor: '#343a40', textColor: '#f8f9fa', titleFont: 'Roboto Slab', bodyFont: 'Merriweather' },

  // Category: Vibrant
  { name: 'Electric Lime', category: 'Vibrant', primaryColor: '#ccff00', backgroundColor: '#1e1e1e', textColor: '#f0f0f0', titleFont: 'Montserrat', bodyFont: 'Inter' },
  { name: 'Hot Pink Flash', category: 'Vibrant', primaryColor: '#ff1493', backgroundColor: '#2c003e', textColor: '#f5f5f5', titleFont: 'Poppins', bodyFont: 'Lato' },
  { name: 'Solar Burst', category: 'Vibrant', primaryColor: '#ffd700', backgroundColor: '#330000', textColor: '#fff8e1', titleFont: 'Oswald', bodyFont: 'Roboto' },

  // Category: Abstract
  { name: 'Gradient Mesh', category: 'Abstract', primaryColor: '#8a2be2', backgroundColor: '#4682b4', textColor: '#ffffff', titleFont: 'Montserrat', bodyFont: 'Inter' },
  
  // Category: Luxury
  { name: 'Black & Gold', category: 'Luxury', primaryColor: '#d4af37', backgroundColor: '#000000', textColor: '#e5e5e5', titleFont: 'Playfair Display', bodyFont: 'Lora' },
  { name: 'Velvet Burgundy', category: 'Luxury', primaryColor: '#f0e68c', backgroundColor: '#800020', textColor: '#f5f5f5', titleFont: 'Merriweather', bodyFont: 'Lato' },
  { name: 'Sapphire Silk', category: 'Luxury', primaryColor: '#fafdff', backgroundColor: '#082567', textColor: '#d4e4ff', titleFont: 'Playfair Display', bodyFont: 'Raleway' },
  { name: 'Gatsby Gold', category: 'Luxury', primaryColor: '#ae9f71', backgroundColor: '#1f1f1f', textColor: '#e1e1e1', titleFont: 'Oswald', bodyFont: 'Merriweather' },

  // Category: Earthy
  { name: 'Olive Grove', category: 'Earthy', primaryColor: '#f5f5dc', backgroundColor: '#556b2f', textColor: '#f0fff0', titleFont: 'Merriweather', bodyFont: 'Lato' },
  { name: 'Redwood Bark', category: 'Earthy', primaryColor: '#fbe9e7', backgroundColor: '#795548', textColor: '#efebe9', titleFont: 'Merriweather', bodyFont: 'Roboto' },

  // Category: Educational
  { name: 'Chalkboard', category: 'Educational', primaryColor: '#ffffff', backgroundColor: '#3d3d3d', textColor: '#f0f0f0', titleFont: 'Source Code Pro', bodyFont: 'Lato' },

  // Category: Gaming
  { name: '8-Bit Legend', category: 'Gaming', primaryColor: '#ffcc00', backgroundColor: '#00008b', textColor: '#ffffff', titleFont: 'Turret Road', bodyFont: 'Source Code Pro' },
  { name: 'RPG Codex', category: 'Gaming', primaryColor: '#d2b48c', backgroundColor: '#3e2723', textColor: '#fff3e0', titleFont: 'Playfair Display', bodyFont: 'Lora' },
  { name: 'Sci-Fi HUD', category: 'Gaming', primaryColor: '#00f0ff', backgroundColor: '#0d0221', textColor: '#e0e0e0', titleFont: 'Orbitron', bodyFont: 'Inter' },
  { name: 'Stealth Ops', category: 'Gaming', primaryColor: '#81c784', backgroundColor: '#212121', textColor: '#bdbdbd', titleFont: 'Oswald', bodyFont: 'Roboto' },

  // Category: Sci-Fi
  { name: 'Starship Bridge', category: 'Sci-Fi', primaryColor: '#80d8ff', backgroundColor: '#001e36', textColor: '#e3f2fd', titleFont: 'Orbitron', bodyFont: 'Inter' },
  { name: 'Post-Apocalyptic', category: 'Sci-Fi', primaryColor: '#a1887f', backgroundColor: '#3e2723', textColor: '#d7ccc8', titleFont: 'Oswald', bodyFont: 'Roboto Slab' },
  { name: 'Space Opera', category: 'Sci-Fi', primaryColor: '#ffd54f', backgroundColor: '#1a237e', textColor: '#e8eaf6', titleFont: 'Playfair Display', bodyFont: 'Lato' },
  { name: 'Galactic Empire', category: 'Sci-Fi', primaryColor: '#f44336', backgroundColor: '#212121', textColor: '#f5f5f5', titleFont: 'Oswald', bodyFont: 'Inter' },
];