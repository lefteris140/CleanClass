import { meetsTarget, requiredUnits, roomLimit, unitACH, validateScenario } from './model';
import type { Classroom, Scenario } from './model';
export interface RoomResult {
  room: Classroom;
  units: number;
  before: number | null;
  after: number | null;
  needed: number | null;
  reached: boolean;
  newlyReached: boolean;
}
export interface Allocation {
  rooms: RoomResult[];
  units: number;
  cost: number;
  remaining: number;
  beforeRooms: number;
  afterRooms: number;
  beforeStudents: number;
  afterStudents: number;
  newStudents: number;
  newRooms: number;
}
const cents = (amount: number) => Math.round(amount * 100);
export function summarize(s: Scenario, units: Map<string, number>): Allocation {
  const rooms = s.rooms.map((room) => {
    const count = units.get(room.id) ?? 0;
    const after =
      room.existingACH === null ? null : room.existingACH + count * unitACH(room, s.equipment);
    const reached = after !== null && meetsTarget(after, s.equipment.target);
    return {
      room,
      units: count,
      before: room.existingACH,
      after,
      needed: requiredUnits(room, s.equipment),
      reached,
      newlyReached:
        reached && room.existingACH !== null && !meetsTarget(room.existingACH, s.equipment.target),
    };
  });
  const before = rooms.filter(
    (r) => r.before !== null && meetsTarget(r.before, s.equipment.target),
  );
  const after = rooms.filter((r) => r.reached);
  const total = rooms.reduce((n, r) => n + r.units, 0);
  const cost = (total * cents(s.equipment.cost)) / 100;
  return {
    rooms,
    units: total,
    cost,
    remaining: (cents(s.equipment.budget) - total * cents(s.equipment.cost)) / 100,
    beforeRooms: before.length,
    afterRooms: after.length,
    beforeStudents: before.reduce((n, r) => n + r.room.students, 0),
    afterStudents: after.reduce((n, r) => n + r.room.students, 0),
    newStudents: rooms.filter((r) => r.newlyReached).reduce((n, r) => n + r.room.students, 0),
    newRooms: rooms.filter((r) => r.newlyReached).length,
  };
}
interface Choice {
  students: number;
  rooms: number;
  indices: number[];
}
function better(a: Choice, b: Choice): boolean {
  return a.students > b.students || (a.students === b.students && a.rooms > b.rooms);
}
function earlier(a: Choice, b: Choice): boolean {
  for (let i = 0; i < a.indices.length; i++) {
    if (a.indices[i] !== b.indices[i]) return a.indices[i] < b.indices[i];
  }
  return false;
}
/** Exact 0/1 knapsack: a room contributes occupancy only when its target is reached. */
export function optimize(s: Scenario): Allocation {
  const errors = validateScenario(s);
  if (errors.length) throw new Error(errors.join(' '));
  const candidates = s.rooms
    .map((room, index) => ({ room, index, needed: requiredUnits(room, s.equipment) }))
    .filter(
      (r): r is { room: Classroom; index: number; needed: number } =>
        r.needed !== null && r.needed > 0 && r.needed <= roomLimit(r.room, s.equipment),
    );
  const capacity = Math.min(
    Math.floor(cents(s.equipment.budget) / cents(s.equipment.cost)),
    candidates.reduce((n, r) => n + r.needed, 0),
  );
  const dp: (Choice | undefined)[] = Array(capacity + 1);
  dp[0] = { students: 0, rooms: 0, indices: [] };
  for (const c of candidates) {
    for (let units = capacity; units >= c.needed; units--) {
      const previous = dp[units - c.needed];
      if (!previous) continue;
      const next = {
        students: previous.students + c.room.students,
        rooms: previous.rooms + 1,
        indices: [...previous.indices, c.index],
      };
      const current = dp[units];
      if (
        !current ||
        better(next, current) ||
        (next.students === current.students &&
          next.rooms === current.rooms &&
          earlier(next, current))
      )
        dp[units] = next;
    }
  }
  let best: Choice = dp[0]!;
  // Ascending scan preserves the lower purchase cost on equal objectives.
  for (const choice of dp) if (choice && better(choice, best)) best = choice;
  const units = new Map<string, number>();
  for (const index of best.indices)
    units.set(s.rooms[index].id, requiredUnits(s.rooms[index], s.equipment)!);
  return summarize(s, units);
}
/** One unit per eligible room per pass, in table order; stop at target or cap. */
export function roundRobin(s: Scenario): Allocation {
  const errors = validateScenario(s);
  if (errors.length) throw new Error(errors.join(' '));
  let remaining = Math.floor(cents(s.equipment.budget) / cents(s.equipment.cost));
  const units = new Map<string, number>();
  const eligible = s.rooms.filter(
    (r) => r.existingACH !== null && !meetsTarget(r.existingACH, s.equipment.target),
  );
  while (remaining > 0) {
    let assigned = false;
    for (const room of eligible) {
      const current = units.get(room.id) ?? 0;
      if (!remaining) break;
      if (current < roomLimit(room, s.equipment) && current < requiredUnits(room, s.equipment)!) {
        units.set(room.id, current + 1);
        remaining--;
        assigned = true;
      }
    }
    if (!assigned) break;
  }
  return summarize(s, units);
}
