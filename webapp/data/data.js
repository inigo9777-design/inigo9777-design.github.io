/* data.js · Mr Cheff — datos estáticos de temporada */

const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
];

const TEMPORADA = [
  { nombre: "Naranja",     tipo: "fruta",  emoji: "🍊", meses: [1, 2, 3, 4] },
  { nombre: "Mandarina",   tipo: "fruta",  emoji: "🍊", meses: [11, 12, 1, 2, 3] },
  { nombre: "Limón",       tipo: "fruta",  emoji: "🍋", meses: [1, 2, 3, 4, 11, 12] },
  { nombre: "Kiwi",        tipo: "fruta",  emoji: "🥝", meses: [1, 2, 3, 4, 11, 12] },
  { nombre: "Pera",        tipo: "fruta",  emoji: "🍐", meses: [1, 2, 3, 9, 10, 11] },
  { nombre: "Plátano",     tipo: "fruta",  emoji: "🍌", meses: [1,2,3,4,5,6,7,8,9,10,11,12] },
  { nombre: "Cereza",      tipo: "fruta",  emoji: "🍒", meses: [5, 6, 7] },
  { nombre: "Fresa",       tipo: "fruta",  emoji: "🍓", meses: [4, 5, 6] },
  { nombre: "Albaricoque", tipo: "fruta",  emoji: "🍑", meses: [6, 7, 8] },
  { nombre: "Melocotón",   tipo: "fruta",  emoji: "🍑", meses: [6, 7, 8, 9] },
  { nombre: "Higo",        tipo: "fruta",  emoji: "🍈", meses: [7, 8, 9] },
  { nombre: "Sandía",      tipo: "fruta",  emoji: "🍉", meses: [6, 7, 8, 9] },
  { nombre: "Uva",         tipo: "fruta",  emoji: "🍇", meses: [8, 9, 10, 11] },
  { nombre: "Manzana",     tipo: "fruta",  emoji: "🍎", meses: [9, 10, 11, 12, 1, 2] },
  { nombre: "Piña",        tipo: "fruta",  emoji: "🍍", meses: [1, 2, 3, 4, 5, 11, 12] },
  { nombre: "Ciruela",     tipo: "fruta",  emoji: "🍑", meses: [7, 8, 9] },
  { nombre: "Ajo",         tipo: "verdura", emoji: "🧄", meses: [1, 2, 3, 11, 12] },
  { nombre: "Cebolla",     tipo: "verdura", emoji: "🧅", meses: [1, 2, 3, 10, 11, 12] },
  { nombre: "Remolacha",   tipo: "verdura", emoji: "🟣", meses: [2, 3, 4, 9, 10, 11] },
  { nombre: "Espinaca",    tipo: "verdura", emoji: "🥬", meses: [10, 11, 12, 1, 2, 3] },
  { nombre: "Echalote",    tipo: "verdura", emoji: "🧅", meses: [11, 12, 1, 2] },
  { nombre: "Brócoli",     tipo: "verdura", emoji: "🥦", meses: [10, 11, 12, 1, 2, 3] },
  { nombre: "Calabaza",    tipo: "verdura", emoji: "🎃", meses: [8, 9, 10, 11, 12] },
  { nombre: "Zanahoria",   tipo: "verdura", emoji: "🥕", meses: [9, 10, 11, 12, 1, 2] },
  { nombre: "Apio",        tipo: "verdura", emoji: "🌿", meses: [10, 11, 12, 1, 2] },
  { nombre: "Judía verde", tipo: "verdura", emoji: "🫛", meses: [4, 5, 6, 7, 8] },
  { nombre: "Tomate",      tipo: "verdura", emoji: "🍅", meses: [5, 6, 7, 8, 9] },
  { nombre: "Berenjena",   tipo: "verdura", emoji: "🍆", meses: [6, 7, 8, 9] },
  { nombre: "Pimiento",    tipo: "verdura", emoji: "🫑", meses: [5, 6, 7, 8, 9] },
  { nombre: "Lechuga",     tipo: "verdura", emoji: "🥬", meses: [4, 5, 6, 9, 10] },
  { nombre: "Espárrago",   tipo: "verdura", emoji: "🌱", meses: [3, 4, 5] },
  { nombre: "Puerro",      tipo: "verdura", emoji: "🌿", meses: [10, 11, 12, 1, 2] },
  { nombre: "Coliflor",    tipo: "verdura", emoji: "🥦", meses: [10, 11, 12, 1, 2, 3] },
  { nombre: "Pepino",      tipo: "verdura", emoji: "🥒", meses: [6, 7, 8, 9] },
  { nombre: "Maíz",        tipo: "verdura", emoji: "🌽", meses: [6, 7, 8] },
  { nombre: "Acelga",      tipo: "verdura", emoji: "🥬", meses: [3, 4, 5, 9, 10, 11] }
];

if (typeof window !== "undefined") {
  window.MR_CHEFF_DATA = { MESES, TEMPORADA };
}