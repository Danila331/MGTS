import demoHaiku from "./demo-haiku.json";
import { demoScenarios, scenarioForDemoRound } from "./demo-scenarios.mjs";

const departments = ['Технический блок', 'Коммерческий блок', 'Административный блок', 'HR-блок', 'IT'];
const clamp = value => Math.max(1, Math.min(5, value));

export function createDemoPopulation() {
  return Array.from({length: 50}, (_, index) => {
    const id = 'ДЕМО-' + String(index + 1).padStart(3, '0');
    const mentor = Array.from({length: 6}, (_, month) => Array.from({length: 6}, (_, metric) =>
      clamp(2 + ((index * 7 + metric * 3 + Math.floor(index / 5)) % 4) +
        (month >= 3 && (index + metric) % 3 === 0 ? 1 : 0))
    ));
    const intern = Array.from({length: 6}, (_, month) => Array.from({length: 7}, (_, metric) =>
      clamp(2 + ((index * 3 + metric * 5 + Math.floor(index / 7)) % 4) +
        (month >= 3 && (index + metric) % 4 === 0 ? 1 : 0))
    ));
    const scenarios = intern.map((_, period) => scenarioForDemoRound(intern, index, period));
    return {
      id, name: id, mentor, intern, texts: scenarios.map(key => demoScenarios[key]),
      ai: scenarios.map(key => demoHaiku.analyses[key]), department: departments[index % departments.length],
      startMonth: index % 5,
    };
  });
}
