export function createDemoPopulation(): {
  id: string;
  name: string;
  mentor: number[][];
  intern: number[][];
  texts: { intern: string[]; mentor: string[] }[];
  ai: { topic: string; answer: { s: { status: string; quotes: string[] } } }[];
  department: string;
  startMonth: number;
}[];
