import { describe, expect, it } from 'vitest';
import { demoScenario, parseScenario, requiredUnits, unitACH, validateScenario } from './model';
import type { Classroom, Scenario } from './model';
import { optimize, roundRobin } from './optimizer';

function room(
  id: string,
  students: number,
  needed: number,
  maxUnits: number | null = null,
): Classroom {
  // At 300 CADR, a 6,000 ft³ room gains exactly 3 eACH per unit.
  return {
    id,
    name: id,
    length: 30,
    width: 20,
    height: 10,
    students,
    existingACH: 12 - needed * 3,
    maxUnits,
  };
}
function scenario(rooms: Classroom[], budget = 600): Scenario {
  return {
    version: 1,
    rooms,
    equipment: { cost: 300, cadr: 300, maxUnits: 4, budget, target: 12 },
  };
}
describe('clean-air calculations', () => {
  it('uses correct cubic feet, minutes-to-hours conversion, and whole-unit rounding', () => {
    const demo = demoScenario();
    expect(unitACH(demo.rooms[0], demo.equipment)).toBe(2.4);
    expect(requiredUnits(demo.rooms[0], demo.equipment)).toBe(2);
    expect(requiredUnits(demo.rooms[5], demo.equipment)).toBe(0);
  });
  it('does not round a near-but-below-target result into attainment', () => {
    const s = scenario([room('A', 20, 1)], 0);
    s.rooms[0].existingACH = 11.9999;
    expect(optimize(s).afterRooms).toBe(0);
    expect(requiredUnits(s.rooms[0], s.equipment)).toBe(1);
  });
});
describe('exact allocation', () => {
  it('finds a combination that beats the largest single classroom', () => {
    const result = optimize(scenario([room('A', 35, 2), room('B', 23, 1), room('C', 22, 1)]));
    expect(result.newStudents).toBe(45);
    expect(result.rooms.map((r) => r.units)).toEqual([0, 1, 1]);
    expect(result.cost).toBe(600);
  });
  it('handles unknown baselines, already-met targets, zero budget, and an empty school', () => {
    const rooms = [room('unknown', 30, 1), room('met', 20, 0)];
    rooms[0].existingACH = null;
    const a = optimize(scenario(rooms, 0));
    expect(a.afterStudents).toBe(20);
    expect(a.rooms[0].after).toBeNull();
    expect(a.units).toBe(0);
    expect(optimize(scenario([])).afterRooms).toBe(0);
  });
  it('honors both limits, including explicit zero, and never buys partial units', () => {
    const s = scenario(
      [room('blocked', 40, 2, 1), room('zero', 50, 1, 0), room('eligible', 20, 1)],
      599.99,
    );
    s.equipment.maxUnits = 1;
    const a = optimize(s);
    expect(a.rooms.map((r) => r.units)).toEqual([0, 0, 1]);
    expect(a.remaining).toBe(299.99);
  });
  it('calculates cents precisely at budget boundaries', () => {
    const s = scenario([room('A', 10, 1), room('B', 20, 1)]);
    s.equipment.cost = 0.1;
    s.equipment.budget = 0.3;
    const a = optimize(s);
    expect(a.units).toBe(2);
    expect(a.cost).toBe(0.2);
    expect(a.remaining).toBe(0.1);
    s.equipment.budget = 0.19;
    expect(optimize(s).units).toBe(1);
  });
  it('breaks equal-student ties by rooms, then cost, then table order', () => {
    const a = optimize(scenario([room('A', 40, 2), room('B', 20, 1), room('C', 20, 1)]));
    expect(a.newRooms).toBe(2);
    const b = optimize(scenario([room('expensive', 20, 2), room('cheap', 20, 1)]));
    expect(b.units).toBe(1);
    const c = optimize(scenario([room('first', 20, 1), room('second', 20, 1)], 300));
    expect(c.rooms.map((r) => r.units)).toEqual([1, 0]);
    const d = optimize(
      scenario([room('A', 40, 3), room('B', 30, 2), room('C', 30, 2), room('D', 20, 1)], 1200),
    );
    expect(d.rooms.map((r) => r.units)).toEqual([3, 0, 0, 1]);
  });
  it('matches exhaustive search on many deterministic generated schools', () => {
    let seed = 17;
    const rand = () => {
      seed = (seed * 16807) % 2147483647;
      return seed / 2147483647;
    };
    for (let trial = 0; trial < 100; trial++) {
      const rooms = Array.from({ length: 8 }, (_, i) =>
        room(`room-${i}`, Math.floor(rand() * 45), 1 + Math.floor(rand() * 4)),
      );
      const capacity = Math.floor(rand() * 15);
      const s = scenario(rooms, capacity * 300);
      let best = { students: 0, rooms: 0, units: 0 };
      for (let mask = 0; mask < 256; mask++) {
        let students = 0,
          count = 0,
          units = 0;
        rooms.forEach((r, i) => {
          if (mask & (1 << i)) {
            students += r.students;
            count++;
            units += requiredUnits(r, s.equipment)!;
          }
        });
        if (
          units <= capacity &&
          (students > best.students ||
            (students === best.students &&
              (count > best.rooms || (count === best.rooms && units < best.units))))
        )
          best = { students, rooms: count, units };
      }
      const a = optimize(s);
      expect({ students: a.newStudents, rooms: a.newRooms, units: a.units }).toEqual(best);
      expect(a.cost).toBeLessThanOrEqual(s.equipment.budget);
      expect(a.afterStudents).toBeGreaterThanOrEqual(roundRobin(s).afterStudents);
    }
  });
});
describe('round-robin comparison', () => {
  it('assigns one unit per pass in table order and stops at target', () => {
    const s = scenario([room('A', 35, 2), room('B', 23, 1), room('C', 22, 1)], 1200);
    const result = roundRobin(s);
    expect(result.rooms.map((r) => r.units)).toEqual([2, 1, 1]);
    expect(result.units).toBe(4);
  });
  it('skips unknown and already-met rooms and respects caps', () => {
    const s = scenario([room('A', 35, 2, 1), room('B', 23, 0), room('C', 22, 1)], 1200);
    s.rooms[2].existingACH = null;
    expect(roundRobin(s).rooms.map((r) => r.units)).toEqual([1, 0, 0]);
  });
});
describe('scenario validation and portability', () => {
  it('round-trips an exported scenario without data loss', () => {
    const s = demoScenario();
    s.rooms[0].existingACH = null;
    expect(parseScenario(JSON.stringify(s))).toEqual(s);
  });
  it('rejects malformed data, duplicate IDs, invalid dimensions, currency, and missing estimates', () => {
    for (const text of [
      'null',
      '{}',
      '{"version":2}',
      '{"version":1,"rooms":[null],"equipment":{}}',
      'not json',
    ])
      expect(() => parseScenario(text)).toThrow();
    const s = demoScenario();
    s.rooms[1].id = s.rooms[0].id;
    s.rooms[0].length = -1;
    expect(validateScenario(s).length).toBe(2);
    expect(() => optimize(s)).toThrow();
    const invalid = demoScenario();
    invalid.equipment.cost = 0;
    expect(() => parseScenario(JSON.stringify(invalid))).toThrow();
    invalid.equipment.cost = 300.001;
    expect(validateScenario(invalid).length).toBe(1);
    const missing = JSON.parse(JSON.stringify(demoScenario()));
    delete missing.rooms[0].existingACH;
    expect(() => parseScenario(JSON.stringify(missing))).toThrow();
  });
  it('accepts explicit zero baseline and rejects nonfinite inputs', () => {
    const s = demoScenario();
    s.rooms[0].existingACH = 0;
    expect(validateScenario(s)).toEqual([]);
    s.equipment.budget = Infinity;
    expect(validateScenario(s).length).toBe(1);
  });
});
