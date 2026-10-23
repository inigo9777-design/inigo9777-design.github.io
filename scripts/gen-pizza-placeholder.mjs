import { writeFile } from 'fs/promises';

const pizzaRecipe = {
  id: 'pizza-jamon-queso',
  title: 'Pizza jamón y queso casera',
  emoji: '🍕'
};

const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400" viewBox="0 0 600 400">
  <rect width="600" height="400" fill="#FFF8F0"/>
  <rect x="25" y="15" width="550" height="370" rx="28" fill="none" stroke="#FF6B35" stroke-width="3.5" opacity="0.9"/>
  
  <text x="50%" y="14%" font-family="Arial, sans-serif" font-size="92px" dominant-baseline="middle">${pizzaRecipe.emoji}</text>
  
  <text x="50%" y="31%" font-family="Georgia, serif" font-size="36px" font-weight="bold" 
         fill="#D2691E" text-anchor="middle">${pizzaRecipe.title}</text>
  
  <text x="50%" y="37%" font-family="Arial, sans-serif" font-size="12px" fill="#9CA3AF" font-style="italic" 
         text-anchor="middle">Una receta deliciosa del catálogo italiano</text>
  
  <!-- Pizza plate illustration -->
  <g transform="translate(75, 425) rotate(-16)">
    <ellipse cx="0" cy="0" rx="135" ry="75" fill="#E8DCC5"/>
  </g>
  <circle cx="75" cy="480" r="12" fill="#FF6B35" opacity="0.6"/>
</svg>`;

await writeFile('/Users/iburgos/Desktop/IA LOCAL/Mr Cheff/webapp/img/recetas/pizza-jamon-queso.jpg', Buffer.from(svg, 'utf8'));
console.log('✓ Generated placeholder image for Pizza jamón y queso casera');
