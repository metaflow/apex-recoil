import { getAttr, setAttr } from "./storage";
import { today } from "./utils";

const statsDataVersion = 2;
export let stats: TrialStats[] = [];

export function percentile(values: number[], p: number) {
  const xx = values.map(x => x);
  if (xx.length === 0 || p < 0) return NaN;
  if (p > 1) p = 1;
  xx.sort((a, b) => a - b);
  const i = (xx.length - 1) * p;
  if ((i | 0) === i) return xx[i];
  var int_part = i | 0;
  var f = i - int_part;
  return (1 - f) * xx[int_part] + f * xx[Math.min(int_part + 1, xx.length - 1)];
}

export interface TrialSetup {
  weapon: string;
  mag: string;
  hint: string;
}

// [day (2021-04-30 is represented as 20210430), count, median, best].
type DayResults = [number, number, number, number];

interface TrialStats {
  v: number;
  setup: TrialSetup;
  dayResults: DayResults[];
  bestAllTime: number;
  today: number;
  todayResults: number[];
};

export function loadStats() {
  JSON.parse(getAttr('stats')).forEach((t: any) => {
      const s = t['setup'];
      if (s === undefined) return;
      const version = t['v'];
      if (version == null) {
          // Initial unversioned storage.
          if (s['barrel'] != null && s['barrel'] != '0') return;
          if (s['stock'] != null && s['stock'] != '0') return;
          const setup: TrialSetup = {
              weapon: s['weapon'] || '',
              mag: s['mag'] || '0',
              hint: s['hint'] || 'true',
          };
          const st: TrialStats = {
              v: statsDataVersion,
              setup,
              today: 20210423,
              dayResults: t['days'].map((d: number, i: number) => {
                  const z: DayResults = [
                      (Math.floor(d / 100) + 1) * 100 + d % 100 + 1,
                      0,
                      t['medianByDay'][i],
                      t['bestByDay'][i],
                  ];
                  return z;
              }),
              todayResults: t['todayResults'] || [],
              bestAllTime: t.bestAllTime,
          }
          stats.push(st);
      } else if (version == 1) {
          // Delete entries that have only "path visible" set.
          if (s['hint'] == 'true' && s['pacer'] == 'false') return;
          t['v'] = 2;
          delete(s['pacer']);
          stats.push(t);
      } else {
          stats.push(t);
      }
  });
  stats.forEach(s => touchStat(s));
}

function touchStat(s: TrialStats) {
  const t = today();
  if (s.today == t) return;
  if (s.todayResults.length > 0) {
      const r: DayResults = [
          s.today,
          s.todayResults.length,
          percentile(s.todayResults, 0.5),
          percentile(s.todayResults, 1)
      ];
      s.dayResults.push(r);
  }
  s.todayResults = [];
  s.today = t;
}

export function distanceScore(x: number, h: number) {
  // Reasoning:
  // 1. Small errors should not decrease the score a lot.
  // 2. Big errors should decrease the score almost to 0. In game it's
  //    a binary value that suddenly drops drops "hit" to "no hit" but
  //    that would not be useful for training.
  // Graph: https://www.desmos.com/calculator/j7vjbzvuly.
  return Math.exp(-.0004 / h * Math.pow(x, 2));
}

export function statsForSetup(c: TrialSetup): TrialStats | undefined {
  return stats.find(x => {
      try {
          return x.setup.weapon == c.weapon &&
              x.setup.mag == c.mag &&
              x.setup.hint == c.hint;
      } catch {
          return false;
      }
  });
}

export function addStat(v: number, setup: TrialSetup): TrialStats {
  let s = statsForSetup(setup);
  const t = today();
  if (s === undefined) {
      s = {
          v: statsDataVersion,
          setup,
          bestAllTime: 0,
          today: t,
          todayResults: [],
          dayResults: [],
      };
      stats.push(s);
  }
  if (s === undefined) throw new Error('no stat');
  touchStat(s);
  s.todayResults.push(v);
  s.bestAllTime = Math.max(s.bestAllTime, v);
  setAttr('stats', JSON.stringify(stats));
  return s;
}
