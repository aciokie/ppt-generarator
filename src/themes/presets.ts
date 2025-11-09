import { Theme } from '../types';

export const THEME_PRESETS: Theme[] = [
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
    name: 'Minimalist Light',
    category: 'Minimal',
    primaryColor: '#1f2937', // Gray 800
    backgroundColor: '#f9fafb', // Gray 50
    textColor: '#374151', // Gray 700
    titleFont: 'Inter',
    bodyFont: 'Inter',
  },
  {
    name: 'Executive Blue',
    category: 'Corporate',
    primaryColor: '#2563eb', // Blue 600
    backgroundColor: '#ffffff', // White
    textColor: '#1f2937', // Gray 800
    titleFont: 'Poppins',
    bodyFont: 'Inter',
  },
  {
    name: 'Forest Canopy',
    category: 'Creative',
    primaryColor: '#16a34a', // Green 600
    backgroundColor: '#f9fafb', // Gray 50
    textColor: '#44403c', // Stone 700
    titleFont: 'Roboto Slab',
    bodyFont: 'Roboto',
  },
  {
    name: 'Classic Manuscript',
    category: 'Academic',
    primaryColor: '#785949', // Muted brown (WCAG AA compliant)
    backgroundColor: '#f5eeda', // Creamy paper
    textColor: '#4a443f', // Dark brown
    titleFont: 'Playfair Display',
    bodyFont: 'Lora',
  },
  {
    name: 'Academic Slate',
    category: 'Academic',
    primaryColor: '#b91c1c', // Red 700
    backgroundColor: '#e5e7eb', // Gray 200
    textColor: '#1f2937', // Gray 800
    titleFont: 'Lora',
    bodyFont: 'Lato',
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
    name: 'Autumn Gold',
    category: 'Nature',
    primaryColor: '#d97706', // Amber 600
    backgroundColor: '#fffbeb', // Yellow 50
    textColor: '#422006', // Brown
    titleFont: 'Merriweather',
    bodyFont: 'Roboto Slab',
  },
  {
    name: 'Emerald Isle',
    category: 'Nature',
    primaryColor: '#059669', // Emerald 600
    backgroundColor: '#f0fdf4', // Green 50
    textColor: '#064e3b', // Emerald 900
    titleFont: 'Lora',
    bodyFont: 'Lato',
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
    name: 'Desert Sunset',
    category: 'Nature',
    primaryColor: '#dc2626', // Red 600
    backgroundColor: '#fef3c7', // Amber 100
    textColor: '#7c2d12', // Orange 900
    titleFont: 'Oswald',
    bodyFont: 'Open Sans',
  },
  {
    name: 'Arctic Dawn',
    category: 'Minimal',
    primaryColor: '#0e7490', // Cyan 700
    backgroundColor: '#ecfeff', // Cyan 50
    textColor: '#1e3a8a', // Indigo 900
    titleFont: 'Raleway',
    bodyFont: 'Lato',
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
    name: 'Startup Pitch',
    category: 'Corporate',
    primaryColor: '#0ea5e9', // Sky 500
    backgroundColor: '#f8fafc', // Slate 50
    textColor: '#020617', // Slate 950
    titleFont: 'Poppins',
    bodyFont: 'Inter',
  },
  {
    name: 'Literary Journal',
    category: 'Academic',
    primaryColor: '#57534e', // Stone 600
    backgroundColor: '#fafaf9', // Stone 50
    textColor: '#1c1917', // Stone 900
    titleFont: 'Playfair Display',
    bodyFont: 'Lora',
  },
  {
    name: 'Coral Reef',
    category: 'Creative',
    primaryColor: '#f43f5e', // Rose 500
    backgroundColor: '#f0f9ff', // Sky 50
    textColor: '#0c4a6e', // Sky 900
    titleFont: 'Lato',
    bodyFont: 'Open Sans',
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
    name: 'Sandstone',
    category: 'Minimal',
    primaryColor: '#ca8a04', // Yellow 600
    backgroundColor: '#fefce8', // Yellow 50
    textColor: '#713f12', // Yellow 900
    titleFont: 'Raleway',
    bodyFont: 'Inter',
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
    name: 'Cherry Blossom',
    category: 'Nature',
    primaryColor: '#db2777', // Pink 600
    backgroundColor: '#fdf2f8', // Pink 50
    textColor: '#831843', // Pink 900
    titleFont: 'Lora',
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
    name: 'Industrial',
    category: 'Corporate',
    primaryColor: '#78716c', // Stone 500
    backgroundColor: '#e7e5e4', // Stone 200
    textColor: '#292524', // Stone 800
    titleFont: 'Oswald',
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
    name: 'Orchid',
    category: 'Elegant',
    primaryColor: '#d946ef', // Fuchsia 500
    backgroundColor: '#faf5ff', // Purple 50
    textColor: '#581c87', // Purple 900
    titleFont: 'Playfair Display',
    bodyFont: 'Merriweather',
  },
  {
    name: 'Clay Pot',
    category: 'Minimal',
    primaryColor: '#e11d48', // Rose 600
    backgroundColor: '#fee2e2', // Red 100
    textColor: '#7f1d1d', // Red 900
    titleFont: 'Roboto Slab',
    bodyFont: 'Roboto',
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
    name: 'Mustard & Gray',
    category: 'Corporate',
    primaryColor: '#eab308', // Yellow 500
    backgroundColor: '#f1f5f9', // Slate 100
    textColor: '#1e293b', // Slate 800
    titleFont: 'Oswald',
    bodyFont: 'Lato',
  },
  {
    name: 'Cotton Candy',
    category: 'Creative',
    primaryColor: '#a855f7', // Purple 500
    backgroundColor: '#f0f9ff', // Sky 50
    textColor: '#0369a1', // Sky 700
    titleFont: 'Poppins',
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
    name: 'Golden State',
    category: 'Bold',
    primaryColor: '#0284c7', // Sky 600
    backgroundColor: '#facc15', // Yellow 400
    textColor: '#083344', // Cyan 950
    titleFont: 'Poppins',
    bodyFont: 'Montserrat',
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
    name: 'Sagebrush',
    category: 'Minimal',
    primaryColor: '#52525b', // Zinc 600
    backgroundColor: '#f4f4f5', // Zinc 100
    textColor: '#27272a', // Zinc 800
    titleFont: 'Raleway',
    bodyFont: 'Open Sans',
  },
  {
    name: 'Tangerine',
    category: 'Bold',
    primaryColor: '#ea580c', // Orange 600
    backgroundColor: '#ffedd5', // Orange 100
    textColor: '#7c2d12', // Orange 900
    titleFont: 'Oswald',
    bodyFont: 'Inter',
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
    name: 'Vintage Newspaper',
    category: 'Retro',
    primaryColor: '#1c1917', // Stone 900
    backgroundColor: '#e7e5e4', // Stone 200
    textColor: '#292524', // Stone 800
    titleFont: 'Playfair Display',
    bodyFont: 'Merriweather',
  },
  {
    name: 'Strawberry Fields',
    category: 'Creative',
    primaryColor: '#be123c', // Rose 700
    backgroundColor: '#fef2f2', // Red 50
    textColor: '#5b21b6', // Violet 800
    titleFont: 'Lora',
    bodyFont: 'Inter',
  },
  {
    name: 'Azure Corporate',
    category: 'Corporate',
    primaryColor: '#0ea5e9', // Sky 500
    backgroundColor: '#f8fafc', // Slate 50
    textColor: '#0f172a', // Slate 900
    titleFont: 'Roboto',
    bodyFont: 'Roboto',
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
    name: 'Slate Minimal',
    category: 'Minimal',
    primaryColor: '#475569', // Slate 600
    backgroundColor: '#f1f5f9', // Slate 100
    textColor: '#0f172a', // Slate 900
    titleFont: 'Inter',
    bodyFont: 'Inter',
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
    name: 'Goldenrod',
    category: 'Nature',
    primaryColor: '#a16207', // Yellow 800
    backgroundColor: '#fef9c3', // Yellow 100
    textColor: '#422006', // Brown
    titleFont: 'Merriweather',
    bodyFont: 'Lora',
  },
  {
    name: 'Ocean Mist',
    category: 'Minimal',
    primaryColor: '#06b6d4', // Cyan 500
    backgroundColor: '#f0f9ff', // Sky 50
    textColor: '#075985', // Sky 800
    titleFont: 'Raleway',
    bodyFont: 'Lato',
  },
  {
    name: 'Burnt Sienna',
    category: 'Elegant',
    primaryColor: '#c2410c', // Orange 700
    backgroundColor: '#fdf2f8', // Pink 50
    textColor: '#57534e', // Stone 600
    titleFont: 'Roboto Slab',
    bodyFont: 'Open Sans',
  },
  {
    name: 'Lavender Latte',
    category: 'Creative',
    primaryColor: '#9333ea', // Purple 600
    backgroundColor: '#f5f3ff', // Violet 50
    textColor: '#4c1d95', // Violet 900
    titleFont: 'Poppins',
    bodyFont: 'Inter',
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
    name: 'Zen Garden',
    category: 'Minimal',
    primaryColor: '#65a30d', // Lime 600
    backgroundColor: '#fafaf9', // Stone 50
    textColor: '#3f3f46', // Zinc 700
    titleFont: 'Raleway',
    bodyFont: 'Inter',
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
    name: 'Sahara',
    category: 'Nature',
    primaryColor: '#b45309', // Amber 700
    backgroundColor: '#fff7ed', // Orange 50
    textColor: '#78350f', // Amber 900
    titleFont: 'Oswald',
    bodyFont: 'Roboto',
  },
  {
    name: 'Periwinkle',
    category: 'Creative',
    primaryColor: '#818cf8', // Indigo 400
    backgroundColor: '#eef2ff', // Indigo 50
    textColor: '#312e81', // Indigo 900
    titleFont: 'Lato',
    bodyFont: 'Open Sans',
  },
  {
    name: 'Veridian',
    category: 'Corporate',
    primaryColor: '#047857', // Emerald 700
    backgroundColor: '#ecfdf5', // Emerald 50
    textColor: '#064e3b', // Emerald 900
    titleFont: 'Montserrat',
    bodyFont: 'Lato',
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
    name: 'Peach Cream',
    category: 'Minimal',
    primaryColor: '#fb923c', // Orange 400
    backgroundColor: '#fff7ed', // Orange 50
    textColor: '#7c2d12', // Orange 900
    titleFont: 'Lora',
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
    name: 'Old Money',
    category: 'Elegant',
    primaryColor: '#064e3b', // Emerald 900
    backgroundColor: '#f1f5f9', // Slate 100
    textColor: '#1e293b', // Slate 800
    titleFont: 'Playfair Display',
    bodyFont: 'Merriweather',
  },
  {
    name: 'Pop Art',
    category: 'Retro',
    primaryColor: '#f43f5e', // Rose 500
    backgroundColor: '#fef08a', // Yellow 200
    textColor: '#0ea5e9', // Sky 500
    titleFont: 'Poppins',
    bodyFont: 'Montserrat',
  },
  {
    name: 'Redwood',
    category: 'Nature',
    primaryColor: '#991b1b', // Red 800
    backgroundColor: '#fef2f2', // Red 50
    textColor: '#451a03', // Brown
    titleFont: 'Roboto Slab',
    bodyFont: 'Lora',
  },
  {
    name: 'Skyline',
    category: 'Corporate',
    primaryColor: '#64748b', // Slate 500
    backgroundColor: '#ffffff', // White
    textColor: '#0f172a', // Slate 900
    titleFont: 'Montserrat',
    bodyFont: 'Inter',
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
    name: 'Spearmint',
    category: 'Minimal',
    primaryColor: '#10b981', // Emerald 500
    backgroundColor: '#f0fdf4', // Green 50
    textColor: '#047857', // Emerald 700
    titleFont: 'Raleway',
    bodyFont: 'Roboto',
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
    name: 'Rose Gold',
    category: 'Elegant',
    primaryColor: '#9f1239', // Rose 800
    backgroundColor: '#fff1f2', // Rose 50
    textColor: '#fde68a', // Amber 200
    titleFont: 'Playfair Display',
    bodyFont: 'Lato',
  },
  {
    name: 'Comic Book',
    category: 'Retro',
    primaryColor: '#ef4444', // Red 500
    backgroundColor: '#fef9c3', // Yellow 100
    textColor: '#1e3a8a', // Indigo 900
    titleFont: 'Oswald',
    bodyFont: 'Inter',
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
    name: 'Linen',
    category: 'Minimal',
    primaryColor: '#78716c', // Stone 500
    backgroundColor: '#f5f5f4', // Stone 100
    textColor: '#3f3f46', // Zinc 700
    titleFont: 'Lora',
    bodyFont: 'Open Sans',
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
  {
    name: 'Regal',
    category: 'Elegant',
    primaryColor: '#4c1d95', // Violet 900
    backgroundColor: '#f5f3ff', // Violet 50
    textColor: '#f59e0b', // Amber 500
    titleFont: 'Playfair Display',
    bodyFont: 'Merriweather',
  },
  {
    name: 'Miami Vice',
    category: 'Retro',
    primaryColor: '#f900b3', // Magenta
    backgroundColor: '#00f2ff', // Cyan
    textColor: '#000000', // Black
    titleFont: 'Orbitron',
    bodyFont: 'Poppins',
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
  { name: 'Modern Grayscale', category: 'Monochrome', primaryColor: '#333333', backgroundColor: '#f5f5f5', textColor: '#111111', titleFont: 'Inter', bodyFont: 'Inter' },
  { name: 'Charcoal Sketch', category: 'Monochrome', primaryColor: '#eeeeee', backgroundColor: '#343a40', textColor: '#f8f9fa', titleFont: 'Roboto Slab', bodyFont: 'Merriweather' },
  { name: 'Silver Lining', category: 'Monochrome', primaryColor: '#1a1a1a', backgroundColor: '#e0e0e0', textColor: '#2c2c2c', titleFont: 'Raleway', bodyFont: 'Lato' },
  { name: 'Inkwell', category: 'Monochrome', primaryColor: '#000000', backgroundColor: '#ffffff', textColor: '#333333', titleFont: 'Merriweather', bodyFont: 'Lora' },

  // Category: Pastel
  { name: 'Mint Sorbet', category: 'Pastel', primaryColor: '#98ff98', backgroundColor: '#f0fff0', textColor: '#4f7942', titleFont: 'Poppins', bodyFont: 'Lato' },
  { name: 'Peach Dream', category: 'Pastel', primaryColor: '#ffcba4', backgroundColor: '#fff5ee', textColor: '#8b4513', titleFont: 'Lora', bodyFont: 'Open Sans' },
  { name: 'Lavender Sky', category: 'Pastel', primaryColor: '#e6e6fa', backgroundColor: '#f8f8ff', textColor: '#483d8b', titleFont: 'Raleway', bodyFont: 'Inter' },
  { name: 'Baby Blue', category: 'Pastel', primaryColor: '#89cff0', backgroundColor: '#f0f8ff', textColor: '#1e90ff', titleFont: 'Montserrat', bodyFont: 'Roboto' },
  { name: 'Soft Coral', category: 'Pastel', primaryColor: '#f08080', backgroundColor: '#fff0f5', textColor: '#a52a2a', titleFont: 'Playfair Display', bodyFont: 'Merriweather' },

  // Category: Vibrant
  { name: 'Electric Lime', category: 'Vibrant', primaryColor: '#ccff00', backgroundColor: '#1e1e1e', textColor: '#f0f0f0', titleFont: 'Montserrat', bodyFont: 'Inter' },
  { name: 'Hot Pink Flash', category: 'Vibrant', primaryColor: '#ff1493', backgroundColor: '#2c003e', textColor: '#f5f5f5', titleFont: 'Poppins', bodyFont: 'Lato' },
  { name: 'Solar Burst', category: 'Vibrant', primaryColor: '#ffd700', backgroundColor: '#330000', textColor: '#fff8e1', titleFont: 'Oswald', bodyFont: 'Roboto' },
  { name: 'Azure Pop', category: 'Vibrant', primaryColor: '#007fff', backgroundColor: '#f0f8ff', textColor: '#003366', titleFont: 'Raleway', bodyFont: 'Open Sans' },
  { name: 'Tangerine Twist', category: 'Vibrant', primaryColor: '#f28500', backgroundColor: '#ffffff', textColor: '#333333', titleFont: 'Poppins', bodyFont: 'Inter' },

  // Category: Abstract
  { name: 'Ink Splash', category: 'Abstract', primaryColor: '#4a4a4a', backgroundColor: '#ffffff', textColor: '#1a1a1a', titleFont: 'Playfair Display', bodyFont: 'Lato' },
  { name: 'Gradient Mesh', category: 'Abstract', primaryColor: '#8a2be2', backgroundColor: '#4682b4', textColor: '#ffffff', titleFont: 'Montserrat', bodyFont: 'Inter' },
  { name: 'Geometric Forms', category: 'Abstract', primaryColor: '#ff6347', backgroundColor: '#f0f0f0', textColor: '#2f4f4f', titleFont: 'Raleway', bodyFont: 'Roboto' },
  { name: 'Brush Strokes', category: 'Abstract', primaryColor: '#deb887', backgroundColor: '#f5f5dc', textColor: '#8b4513', titleFont: 'Lora', bodyFont: 'Merriweather' },
  { name: 'Bauhaus Blocks', category: 'Abstract', primaryColor: '#ffd700', backgroundColor: '#ffffff', textColor: '#000080', titleFont: 'Oswald', bodyFont: 'Inter' },
  
  // Category: Luxury
  { name: 'Black & Gold', category: 'Luxury', primaryColor: '#d4af37', backgroundColor: '#000000', textColor: '#e5e5e5', titleFont: 'Playfair Display', bodyFont: 'Lora' },
  { name: 'Velvet Burgundy', category: 'Luxury', primaryColor: '#f0e68c', backgroundColor: '#800020', textColor: '#f5f5f5', titleFont: 'Merriweather', bodyFont: 'Lato' },
  { name: 'Sapphire Silk', category: 'Luxury', primaryColor: '#fafdff', backgroundColor: '#082567', textColor: '#d4e4ff', titleFont: 'Playfair Display', bodyFont: 'Raleway' },
  { name: 'Rose Gold Glam', category: 'Luxury', primaryColor: '#b76e79', backgroundColor: '#faf0e6', textColor: '#5d4037', titleFont: 'Lora', bodyFont: 'Inter' },
  { name: 'Gatsby Gold', category: 'Luxury', primaryColor: '#ae9f71', backgroundColor: '#1f1f1f', textColor: '#e1e1e1', titleFont: 'Oswald', bodyFont: 'Merriweather' },

  // Category: Earthy
  { name: 'Terracotta', category: 'Earthy', primaryColor: '#e2725b', backgroundColor: '#fdf5e6', textColor: '#5d4037', titleFont: 'Roboto Slab', bodyFont: 'Lora' },
  { name: 'Olive Grove', category: 'Earthy', primaryColor: '#f5f5dc', backgroundColor: '#556b2f', textColor: '#f0fff0', titleFont: 'Merriweather', bodyFont: 'Lato' },
  { name: 'Canyon Sunset', category: 'Earthy', primaryColor: '#ff7043', backgroundColor: '#fff3e0', textColor: '#4e342e', titleFont: 'Oswald', bodyFont: 'Merriweather' },
  { name: 'River Stone', category: 'Earthy', primaryColor: '#b0c4de', backgroundColor: '#f5f5f5', textColor: '#465058', titleFont: 'Lato', bodyFont: 'Inter' },
  { name: 'Redwood Bark', category: 'Earthy', primaryColor: '#fbe9e7', backgroundColor: '#795548', textColor: '#efebe9', titleFont: 'Merriweather', bodyFont: 'Roboto' },

  // Category: Educational
  { name: 'Chalkboard', category: 'Educational', primaryColor: '#ffffff', backgroundColor: '#3d3d3d', textColor: '#f0f0f0', titleFont: 'Source Code Pro', bodyFont: 'Lato' },
  { name: 'Notebook Paper', category: 'Educational', primaryColor: '#0000ff', backgroundColor: '#f7f7f7', textColor: '#333333', titleFont: 'Merriweather', bodyFont: 'Lora' },
  { name: 'Science Lab', category: 'Educational', primaryColor: '#00acc1', backgroundColor: '#eceff1', textColor: '#263238', titleFont: 'Roboto', bodyFont: 'Roboto' },
  { name: 'History Book', category: 'Educational', primaryColor: '#795548', backgroundColor: '#efebe9', textColor: '#3e2723', titleFont: 'Playfair Display', bodyFont: 'Lora' },
  { name: 'University Crimson', category: 'Educational', primaryColor: '#c62828', backgroundColor: '#f5f5f5', textColor: '#212121', titleFont: 'Oswald', bodyFont: 'Lato' },

  // Category: Gaming
  { name: '8-Bit Legend', category: 'Gaming', primaryColor: '#ffcc00', backgroundColor: '#00008b', textColor: '#ffffff', titleFont: 'Turret Road', bodyFont: 'Source Code Pro' },
  { name: 'RPG Codex', category: 'Gaming', primaryColor: '#d2b48c', backgroundColor: '#3e2723', textColor: '#fff3e0', titleFont: 'Playfair Display', bodyFont: 'Lora' },
  { name: 'Sci-Fi HUD', category: 'Gaming', primaryColor: '#00f0ff', backgroundColor: '#0d0221', textColor: '#e0e0e0', titleFont: 'Orbitron', bodyFont: 'Inter' },
  { name: 'Stealth Ops', category: 'Gaming', primaryColor: '#81c784', backgroundColor: '#212121', textColor: '#bdbdbd', titleFont: 'Oswald', bodyFont: 'Roboto' },
  { name: 'Aperture Labs', category: 'Gaming', primaryColor: '#f97316', backgroundColor: '#f3f4f6', textColor: '#1f2937', titleFont: 'Roboto', bodyFont: 'Inter' },

  // Category: Sci-Fi
  { name: 'Starship Bridge', category: 'Sci-Fi', primaryColor: '#80d8ff', backgroundColor: '#001e36', textColor: '#e3f2fd', titleFont: 'Orbitron', bodyFont: 'Inter' },
  { name: 'Alien Planet', category: 'Sci-Fi', primaryColor: '#7c4dff', backgroundColor: '#f3e5f5', textColor: '#311b92', titleFont: 'Turret Road', bodyFont: 'Montserrat' },
  { name: 'Post-Apocalyptic', category: 'Sci-Fi', primaryColor: '#a1887f', backgroundColor: '#3e2723', textColor: '#d7ccc8', titleFont: 'Oswald', bodyFont: 'Roboto Slab' },
  { name: 'Space Opera', category: 'Sci-Fi', primaryColor: '#ffd54f', backgroundColor: '#1a237e', textColor: '#e8eaf6', titleFont: 'Playfair Display', bodyFont: 'Lato' },
  { name: 'Galactic Empire', category: 'Sci-Fi', primaryColor: '#f44336', backgroundColor: '#212121', textColor: '#f5f5f5', titleFont: 'Oswald', bodyFont: 'Inter' },
];
