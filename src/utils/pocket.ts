import { PocketMove } from '../types';
import { LearnedWords, categoryEmoji, totalsByCategory } from './categories';
import { formatCurrency } from './format';

export interface ParsedExpense {
  concept: string;
  amount: number;
}

/** Números escritos con letras que suelen aparecer en los mensajes ("diez mil"). */
const WORD_NUMBERS: Record<string, number> = {
  un: 1, uno: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9,
  diez: 10, once: 11, doce: 12, trece: 13, catorce: 14, quince: 15, dieciseis: 16, dieciséis: 16,
  veinte: 20, veinticinco: 25, treinta: 30, cuarenta: 40, cincuenta: 50, sesenta: 60,
  setenta: 70, ochenta: 80, noventa: 90, cien: 100, ciento: 100, doscientos: 200, trescientos: 300, quinientos: 500,
};

const WORD_NUMBER_PATTERN = Object.keys(WORD_NUMBERS).sort((a, b) => b.length - a.length).join('|');

/**
 * Encuentra valores de plata: "10 mil", "10.000", "$10000", "10k", "2 lucas", "1,5 millones", "diez mil".
 * Grupos: 1 = número, 2 = número en letras, 3 = unidad (mil, k, lucas, millón...).
 */
const AMOUNT_REGEX = new RegExp(
  `(?:\\$\\s*)?(?:(\\d{1,3}(?:[.,]\\d{3})+|\\d+(?:[.,]\\d+)?)|\\b(${WORD_NUMBER_PATTERN})\\b)\\s*(mil\\b|k\\b|lucas?\\b|mill[oó]n(?:es)?\\b|palos?\\b)?`,
  'gi',
);

/** Palabras de relleno que se quitan para que quede solo "en qué" se gastó. */
const FILLER_WORDS = new Set([
  'amor', 'mi', 'mijo', 'mija', 'cielo', 'vida', 'bebe', 'bebé', 'gordo', 'gorda', 'hola', 'oye', 'mira',
  'gaste', 'gasté', 'gastamos', 'gastado', 'gasto', 'gastos', 'pague', 'pagué', 'pago', 'compre', 'compré', 'compramos',
  'se', 'me', 'nos', 'te', 'porque', 'por', 'que', 'en', 'de', 'del', 'un', 'una', 'unos', 'unas', 'el', 'la', 'los', 'las',
  'pesos', 'peso', 'y', 'para', 'fue', 'fueron', 'con', 'lo', 'hoy', 'ayer', 'tambien', 'también', 'otro', 'otra', 'ahi', 'ahí',
  'mil', 'k', 'luca', 'lucas', 'total', 'es', 'son', 'al', 'a', 'o',
]);

const toAmount = (digits: string | undefined, word: string | undefined, unit: string | undefined): number => {
  const u = (unit || '').toLowerCase();
  const multiplier = !u ? 1 : /^mill|^palo/.test(u) ? 1_000_000 : 1000;

  let base: number;
  if (word) {
    base = WORD_NUMBERS[word.toLowerCase()] ?? 0;
    // "un"/"una" solo cuentan si llevan unidad ("una luca"), no en "un desodorante".
    if (!u && base < 10) return 0;
  } else if (u) {
    // Con unidad, la coma o el punto son decimales: "1,5 millones", "2.5 mil".
    base = parseFloat((digits || '').replace(',', '.'));
  } else {
    // Sin unidad, los puntos o comas son de miles: "10.000".
    base = parseFloat((digits || '').replace(/[.,]/g, ''));
  }
  if (!base) return 0;

  let amount = base * multiplier;
  // "gasté 10 en jabón": en pesos colombianos nada cuesta menos de mil, se entiende como 10 mil.
  if (!u && amount < 1000) amount *= 1000;
  return Math.round(amount);
};

const cleanConcept = (text: string): string => {
  const words = text
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter(w => w && !FILLER_WORDS.has(w.toLowerCase()) && !/^\d+$/.test(w));
  const concept = words.join(' ').slice(0, 40).trim();
  return concept ? concept.charAt(0).toUpperCase() + concept.slice(1) : '';
};

/** Lee una frase y saca sus gastos. Sirve para "gasté 10 mil en jabón y 5 mil en pan" o "jabón 10 mil, pan 5 mil". */
const parsePiece = (piece: string): ParsedExpense[] => {
  const matches = [...piece.matchAll(AMOUNT_REGEX)]
    .map(m => ({ start: m.index!, end: m.index! + m[0].length, amount: toAmount(m[1], m[2], m[3]) }))
    .filter(m => m.amount > 0);
  if (matches.length === 0) return [];

  // ¿El concepto va antes del valor ("jabón 10 mil") o después ("10 mil en jabón")?
  const textBeforeFirst = cleanConcept(piece.slice(0, matches[0].start));
  const textAfterLast = cleanConcept(piece.slice(matches[matches.length - 1].end));
  const conceptGoesBefore = !!textBeforeFirst && !textAfterLast;

  return matches.map((m, i) => {
    const before = piece.slice(i === 0 ? 0 : matches[i - 1].end, m.start);
    const after = piece.slice(m.end, i === matches.length - 1 ? piece.length : matches[i + 1].start);
    const concept = conceptGoesBefore ? cleanConcept(before) || cleanConcept(after) : cleanConcept(after) || cleanConcept(before);
    return { concept: concept || 'Gasto', amount: m.amount };
  });
};

/**
 * Convierte un mensaje como "Amor, gasté 10 mil porque compré un desodorante. Gasté 30 mil en jabón"
 * en una lista de gastos: [{ Desodorante, 10.000 }, { Jabón, 30.000 }].
 */
export const parseExpensesMessage = (message: string): ParsedExpense[] =>
  message
    // Se separa por renglones, punto y coma, y puntos que terminan frase (no los de "10.000").
    .split(/\n|;|\.(?!\d)/)
    .flatMap(parsePiece);

const isSameMonth = (iso: string, now: Date) => {
  const d = new Date(iso);
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
};

export interface MonthTotals {
  income: number;
  spent: number;
  moves: PocketMove[];
}

/** Lo que entró y lo que se gastó en el mes actual. */
export const getMonthTotals = (moves: PocketMove[], now = new Date()): MonthTotals => {
  const monthMoves = moves.filter(m => isSameMonth(m.timestamp, now));
  return {
    income: monthMoves.filter(m => m.amount > 0).reduce((s, m) => s + m.amount, 0),
    spent: monthMoves.filter(m => m.amount < 0).reduce((s, m) => s - m.amount, 0),
    moves: monthMoves,
  };
};

export const monthName = (now = new Date()) => {
  const name = now.toLocaleDateString('es-CO', { month: 'long', year: 'numeric' }).replace(' de ', ' ');
  return name.charAt(0).toUpperCase() + name.slice(1);
};

/** Texto del mes listo para pegar en WhatsApp. */
export const pocketToWhatsappText = (moves: PocketMove[], learned: LearnedWords, now = new Date()): string => {
  const { income, spent, moves: monthMoves } = getMonthTotals(moves, now);
  const total = moves.reduce((s, m) => s + m.amount, 0);
  // La lista va de la más nueva a la más vieja: se voltea para que el mensaje quede en orden.
  const lines = [...monthMoves]
    .reverse()
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
    .map(m => {
      const day = new Date(m.timestamp).toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit' });
      return `${m.amount < 0 ? '🔴' : '🟢'} ${day} ${m.concept}: ${m.amount < 0 ? '-' : '+'}${formatCurrency(Math.abs(m.amount))}`;
    });

  const groups = totalsByCategory(monthMoves, learned).map(([name, value]) => `${categoryEmoji(name)} ${name}: ${formatCurrency(value)}`);

  return [
    `*Mi Bolsillo - ${monthName(now)}*`,
    `*Entró:* ${formatCurrency(income)}`,
    `*Gastado:* ${formatCurrency(spent)}`,
    `*Me queda:* ${formatCurrency(total)}`,
    ...(groups.length ? ['', '*Gastos por grupo:*', ...groups] : []),
    ...(lines.length ? ['', '*Movimientos:*', ...lines] : []),
  ].join('\n');
};
