import { PocketMove } from '../types';

/** Palabras que la app ya aprendió: "masmelo" → "Chatarra". */
export type LearnedWords = Record<string, string>;

export const OTHER_CATEGORY = 'Otros';

/** Grupos que trae la app, con su emoji. Los grupos que crees tú usan 🏷️. */
export const DEFAULT_CATEGORIES: { name: string; emoji: string }[] = [
  { name: 'Comida', emoji: '🍽️' },
  { name: 'Mercado', emoji: '🛒' },
  { name: 'Chatarra', emoji: '🍟' },
  { name: 'Aseo', emoji: '🧼' },
  { name: 'Hogar', emoji: '🏠' },
  { name: 'Transporte', emoji: '🚌' },
  { name: 'Salud', emoji: '💊' },
  { name: OTHER_CATEGORY, emoji: '📦' },
];

export const categoryEmoji = (name: string) => DEFAULT_CATEGORIES.find(c => c.name === name)?.emoji ?? '🏷️';

/**
 * El "diccionario": cada grupo con sus palabras, escritas en singular, en minúscula y sin tildes.
 * Para agregar una palabra que siempre deba ir a un grupo, se pone aquí.
 */
const DICTIONARY: Record<string, string[]> = {
  Comida: [
    'arepa', 'pan', 'huevo', 'arroz', 'leche', 'carne', 'pollo', 'queso', 'almuerzo', 'desayuno', 'comida', 'cena',
    'fruta', 'verdura', 'papa', 'platano', 'yuca', 'frijol', 'lenteja', 'garbanzo', 'pasta', 'espagueti', 'aceite',
    'azucar', 'sal', 'cafe', 'chocolate', 'panela', 'mantequilla', 'salchicha', 'jamon', 'pescado', 'tomate', 'cebolla',
    'banano', 'mango', 'naranja', 'limon', 'aguacate', 'yogur', 'yogurt', 'avena', 'harina', 'atun', 'sardina',
    'mortadela', 'cerdo', 'res', 'chorizo', 'empanada', 'tamal', 'sopa', 'caldo', 'jugo', 'mazorca', 'zanahoria',
    'ajo', 'cilantro', 'maracuya', 'guayaba', 'pina', 'papaya', 'manzana', 'uva', 'fresa', 'mora', 'lulo', 'tomate',
    'costilla', 'higado', 'chicharron', 'arveja', 'maiz', 'bocadillo', 'galleta', 'cuajada', 'kumis', 'gallina',
  ],
  Mercado: ['mercado', 'supermercado', 'surtido', 'd1', 'ara', 'exito', 'olimpica', 'surtimax', 'isimo', 'justo'],
  Chatarra: [
    'gaseosa', 'coca', 'cocacola', 'postobon', 'pepsi', 'papita', 'dulce', 'helado', 'chocolatina', 'perro',
    'hamburguesa', 'pizza', 'salchipapa', 'chito', 'dorito', 'golosina', 'mecato', 'gomita', 'chicle', 'bombom',
    'ponque', 'chupeta', 'bonbonbum', 'chocorramo', 'gala', 'brownie', 'mani', 'snack', 'pony', 'malta', 'colombiana',
  ],
  Aseo: [
    'jabon', 'desodorante', 'shampoo', 'champu', 'champoo', 'papel', 'higienico', 'crema', 'cepillo', 'detergente',
    'fab', 'suavizante', 'cloro', 'limpido', 'varsol', 'toalla', 'panal', 'rastrillo', 'axion', 'lavaloza',
    'esponja', 'ambientador', 'talco', 'colgate', 'protector', 'enjuague', 'acondicionador', 'escoba', 'trapero',
    'blanqueador', 'limpiador', 'servilleta', 'panito', 'seda', 'afeitadora', 'gel', 'tinte',
  ],
  Hogar: [
    'luz', 'agua', 'gas', 'arriendo', 'internet', 'recibo', 'servicio', 'factura', 'energia', 'telefono', 'plan',
    'recarga', 'television', 'cable', 'olla', 'plato', 'bombillo', 'pila', 'vela', 'cobija', 'sabana', 'almohada',
  ],
  Transporte: ['gasolina', 'bus', 'taxi', 'parqueadero', 'peaje', 'uber', 'buseta', 'pasaje', 'mototaxi', 'didi', 'indriver', 'transporte'],
  Salud: [
    'droga', 'drogueria', 'medicamento', 'medicina', 'pastilla', 'acetaminofen', 'ibuprofeno', 'medico', 'cita',
    'consulta', 'farmacia', 'vitamina', 'dolex', 'remedio', 'eps', 'odontologo', 'jarabe', 'curita', 'alcohol',
    'tapabocas', 'examen', 'laboratorio', 'suero', 'noxpirin', 'advil', 'buscapina', 'sevedol',
  ],
};

/** Minúsculas y sin tildes: "Jabón" → "jabon". */
const normalize = (text: string) =>
  text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9ñ\s]/g, ' ');

/** Formas posibles en singular: "arepas" → arepa, "jabones" → jabon / jabone. */
const singulars = (word: string) => {
  const forms = [word];
  if (word.length > 3 && word.endsWith('s')) forms.push(word.slice(0, -1));
  if (word.length > 4 && word.endsWith('es')) forms.push(word.slice(0, -2));
  return forms;
};

const WORD_TO_CATEGORY: Record<string, string> = Object.fromEntries(
  Object.entries(DICTIONARY).flatMap(([category, words]) => words.map(w => [w, category])),
);

const wordsOf = (concept: string) => normalize(concept).split(/\s+/).filter(Boolean);

/** La clave con la que se recuerda un nombre: "Papel higiénicos" → "papel higienico". */
export const learnKey = (concept: string) => wordsOf(concept).map(w => singulars(w)[1] ?? w).join(' ');

/** Busca el grupo de un gasto: primero lo que la app aprendió de ti, luego el diccionario. */
export const categorize = (concept: string, learned: LearnedWords): string => {
  const key = learnKey(concept);
  if (learned[key]) return learned[key];
  for (const raw of wordsOf(concept)) {
    for (const word of singulars(raw)) {
      if (learned[word]) return learned[word];
      if (WORD_TO_CATEGORY[word]) return WORD_TO_CATEGORY[word];
    }
  }
  return OTHER_CATEGORY;
};

/** El grupo de un movimiento: el que elegiste a mano, o el que adivina la app. Los ingresos no tienen grupo. */
export const moveCategory = (move: PocketMove, learned: LearnedWords): string | null => {
  if (move.amount >= 0) return null;
  return move.category || categorize(move.concept, learned);
};

/** Suma de los gastos por grupo, de mayor a menor. */
export const totalsByCategory = (moves: PocketMove[], learned: LearnedWords) => {
  const totals: Record<string, number> = {};
  for (const move of moves) {
    const category = moveCategory(move, learned);
    if (category) totals[category] = (totals[category] || 0) - move.amount;
  }
  return Object.entries(totals).sort((a, b) => b[1] - a[1]);
};
