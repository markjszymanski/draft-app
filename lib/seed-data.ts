import type { Gender, Position } from './supabase/types';

const MALE_FIRST_NAMES = [
  'Ryan', 'Jake', 'Mike', 'Connor', 'Tyler', 'Brandon', 'Kyle', 'Dylan',
  'Evan', 'Cody', 'Nolan', 'Marcus', 'Sean', 'Liam', 'Owen',
  'Carter', 'Logan', 'Hunter', 'Mason', 'Aiden', 'Lucas', 'Noah', 'Ethan',
  'Trevor', 'Blake', 'Chase', 'Devin', 'Drew', 'Eli', 'Finn', 'Gage',
  'Hayden', 'Ian', 'Jared', 'Kevin', 'Landon', 'Max', 'Nathan', 'Parker',
  'Reid', 'Scott', 'Travis', 'Vince', 'Wyatt', 'Zach', 'Austin',
  'Ben', 'Cole', 'Derek', 'Eric', 'Frank', 'Grant', 'Henry', 'Isaac',
  'Jack', 'Kai', 'Luke', 'Matt', 'Nick', 'Oscar', 'Pete', 'Rory',
];

const FEMALE_FIRST_NAMES = [
  'Sarah', 'Emily', 'Megan', 'Hannah', 'Rachel', 'Jess', 'Alexis', 'Brooke',
  'Chloe', 'Danielle', 'Erin', 'Faith', 'Grace', 'Holly', 'Ivy', 'Jenna',
  'Kayla', 'Lauren', 'Maddie', 'Natalie', 'Olivia', 'Paige', 'Riley', 'Sophie',
  'Taylor', 'Vanessa', 'Whitney', 'Zoe', 'Ashley', 'Bella', 'Cassie', 'Devyn',
  'Ellie', 'Fiona', 'Gabby', 'Heather', 'Jordan', 'Kate', 'Leah', 'Mia',
  'Quinn', 'Sam', 'Tessa', 'Sydney',
];

const LAST_NAMES = [
  'McKenzie', 'Thompson', 'Sullivan', 'Brennan', 'Callahan', 'Doyle',
  'Flanagan', 'Gallagher', 'Hayes', 'Kelly', 'Lynch', 'Murphy', 'O\'Brien',
  'Quinn', 'Ryan', 'Walsh', 'Anderson', 'Bauer', 'Clark', 'Davis',
  'Edwards', 'Fischer', 'Graham', 'Hunter', 'Jensen', 'Kowalski', 'Larson',
  'Miller', 'Nelson', 'Olsen', 'Parker', 'Reid', 'Stewart', 'Turner',
  'Wallace', 'Young', 'Bergeron', 'Comeau', 'Dubois', 'Fontaine',
  'Gagnon', 'Lavoie', 'Martel', 'Poirier', 'Roy', 'Tremblay',
  'MacDonald', 'McGrath', 'O\'Neill', 'Sheridan', 'Tierney', 'Whelan',
  'Bennett', 'Carter', 'Dunn', 'Ellis', 'Foster', 'Grant', 'Harris',
  'Irwin', 'Jacobs', 'King', 'Lowe', 'Mitchell',
];

export type SeedPlayer = {
  first_name: string;
  last_name: string;
  position: Position;
  gender: Gender;
  point_value: number;
};

function randomFrom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function uniqueName(
  used: Set<string>,
  gender: Gender,
): { first: string; last: string } {
  const pool = gender === 'F' ? FEMALE_FIRST_NAMES : MALE_FIRST_NAMES;
  for (let i = 0; i < 200; i++) {
    const first = randomFrom(pool);
    const last = randomFrom(LAST_NAMES);
    const key = `${first} ${last}`;
    if (!used.has(key)) {
      used.add(key);
      return { first, last };
    }
  }
  const first = randomFrom(pool);
  const last = randomFrom(LAST_NAMES) + ' ' + Math.floor(Math.random() * 99);
  used.add(`${first} ${last}`);
  return { first, last };
}

// Skewed distribution: few elite (1200-1400), many mid (400-900), some low (100-300)
function rollPointValue(): number {
  const r = Math.random();
  let raw: number;
  if (r < 0.08) raw = 1200 + Math.random() * 200;      // ~8% elite
  else if (r < 0.30) raw = 800 + Math.random() * 400;  // ~22% strong
  else if (r < 0.75) raw = 400 + Math.random() * 400;  // ~45% mid
  else raw = 100 + Math.random() * 300;                // ~25% low
  // Round to nearest 25 for tidiness
  return Math.round(raw / 25) * 25;
}

export function generatePlayerPool(opts?: {
  goalies?: number;
  defense?: number;
  forwards?: number;
  fd?: number;
  femaleRatio?: number; // 0–1, applied across positions
}): SeedPlayer[] {
  const goalies = opts?.goalies ?? 10;
  const defense = opts?.defense ?? 45;
  const forwards = opts?.forwards ?? 65;
  const fd = opts?.fd ?? 0;
  const femaleRatio = opts?.femaleRatio ?? 0.3;

  const used = new Set<string>();
  const players: SeedPlayer[] = [];

  const gen = (count: number, position: Position) => {
    const femaleCount = Math.round(count * femaleRatio);
    for (let i = 0; i < count; i++) {
      const gender: Gender = i < femaleCount ? 'F' : 'M';
      const { first, last } = uniqueName(used, gender);
      players.push({
        first_name: first,
        last_name: last,
        position,
        gender,
        point_value: rollPointValue(),
      });
    }
  };

  gen(goalies, 'G');
  gen(defense, 'D');
  gen(forwards, 'F');
  gen(fd, 'FD');

  return players;
}
