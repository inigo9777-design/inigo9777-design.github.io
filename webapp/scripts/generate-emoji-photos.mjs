// Script to generate emoji-styled placeholder images for recipes that failed auto-fetch from Wikimedia

import { join, dirname } from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const __dirname = dirname(fileURLToPath(import.meta.url));

const recipes = [
  { id: "lentejas-chorizo", title: "Lentejas con chorizo", color: "#8B4513" },      // Brown for lentils 🍲
  { id: "costilla-miel-mostaza", title: "Costilla de cerdo con miel y mostaza antigua", color: "#D2691E" },  // Orange-brown 🍖
  { id: "albondigas-vino-tinto", title: "Albóndigas en salsa de vino tinto", color: "#C84C60" }  // Reddish 🥘
];

console.log("🎨 Creating placeholder images for recipes without auto-fetched photos...\n");

// Create output directory
const imgDir = join(__dirname, "img", "recetas");
if (!fs.existsSync(imgDir)) {
  fs.mkdirSync(imgDir, { recursive: true });
}

for (let i = 0; i < recipes.length; i++) {
  const recipe = recipes[i];
  
  try {
    // Create canvas using Node's built-in http to simulate browser Canvas-like output via a small serverless approach
    // Alternative: Generate SVG which is native JS and doesn't need Canvas API
    
    const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400" viewBox="0 0 600 400">
  <!-- Background with warm cream color -->
  <rect width="600" height="400" fill="#FFF8F0"/>
  
  <!-- Decorative border -->
  <rect x="15" y="12" width="570" height="376"rx="12" fill="white" stroke="#E8E4E0" stroke-width="2"/>
  
  <!-- Title text -->
  <text x="40" y="55" font-family="Georgia, serif" font-size="32" fill="${recipe.color}" text-anchor="left" font-weight="bold">${recipe.title}</text>
  
  <!-- Decorative line -->
  <line x1="40" y1="68" x2="560" y2="68" stroke="${recipe.color}" stroke-width="3" opacity="0.3"/>
  
  <!-- Recipe info card styling -->
  <text x="50" y="95" font-family="Arial, sans-serif" font-size="14" fill="#666" opacity="0.7">Una receta deliciosa de ${recipe.title}</text>
  
  <!-- Food plate illustration (simple representation) -->
  <g transform="translate(240, 150)">
    <!-- Plate oval -->
    <ellipse cx="0" cy="20" rx="80" ry="50" fill="#E8E4E0"/>
    
    <!-- Recipe-specific decorations -->
    ${recipe.id === 'lentejas-chorizo' ? 
      '<g stroke="#8B4513" stroke-width="8" fill="#6B2E0F"><ellipse cx="-40" cy="70" rx="20" ry="12"/><path d="M -40 70 Q -10 90 20 70"/><path d="M 20 70 Q 50 60 70 80"/></g>' :
      recipe.id === 'costilla-miel-mostaza' ? 
        '<g fill="#D2691E"><path d="M -80 30 Q -40 -10 0 10 Q 40 -10 80 30 L 80 35 L -80 35 Z"/><circle cx="-20" cy="45" r="5" fill="#D68E40"/><circle cx="20" cy="45" r="5" fill="#D68E40"/></g>' :
        '<g fill="#C84C60"><path d="M -70 20 Q -30 0 0 20 Q 30 0 70 20 L 70 25 L -70 25 Z"/><circle cx="-15" cy="28" r="4" fill="#A64D60"/><circle cx="15" cy="28" r="4" fill="#A64D60"/></g>'}
    
    <!-- Steam lines -->
    <line x1="-30" y1="70" x2="-60" y2="${90 - (recipe.id === 'lentejas-chorizo' ? 5 : 8)}" stroke="#E8E4E0" stroke-width="2" opacity="0.5"/>
    <line x1="30" y1="70" x2="60" y2="${90 - (recipe.id === 'lentejas-chorizo' ? 5 : 8)}" stroke="#E8E4E0" stroke-width="2" opacity="0.5"/>
  </g>
  
  <!-- Footer -->
  <text x="300" y="375" font-family="Arial, sans-serif" font-size="12" fill="#999" text-anchor="middle">Mr Cheff - Recetas caseras</text>
</svg>`;

    const filepath = join(imgDir, `${recipe.id}.jpg`);
    // Save as SVG first (we'll note that in comments since .jpg extension expected by img.js)
    fs.writeFileSync(filepath + ".svg", svg);
    
    console.log(`✓ Created: ${recipe.id}.svg (${recipe.title})`);
  } catch (error) {
    console.error(`✗ Failed ${recipe.id}:`, error.message);
  }
}

console.log("\n✅ Generated placeholder images!");
console.log("Note: Files are actually SVG format. For JPEG conversion, use convert-svg-to-jpg or the web script will auto-fall back to emoji placeholders.");
