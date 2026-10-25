import { describe, expect, it } from 'vitest';
import { demoScenario, roomLimit, validateScenario } from './model';
import type { Scenario } from './model';
import { optimize } from './optimizer';
import { analyzeSensitivity, evaluateAllocation, perturbScenario } from './sensitivity';

function example(): Scenario {
  return {
    version: 1,
    equipment: { cost: 100, cadr: 300, maxUnits: 2, budget: 100, target: 5 },
    rooms: [
      {
        id: 'a',
        name: 'A',
        length: 30,
        width: 20,
        height: 10,
        students: 30,
        existingACH: 2,
        maxUnits: 1,
      },
      {
        id: 'b',
        name: 'B',
        length: 30,
        width: 20,
        height: 10,
        students: 20,
        existingACH: 4,
        maxUnits: null,
      },
    ],
  };
}
function snapshot(scenario: Scenario) {
  return { key: JSON.stringify(scenario), allocation: optimize(scenario) };
}

describe('ventilation sensitivity', () => {
  it('zero adjustment reproduces inputs and allocation exactly in an independent copy', () => {
    const s = example();
    const result = analyzeSensitivity(s, snapshot(s), 0);
    expect(result.scenario).toEqual(s);
    expect(result.scenario).not.toBe(s);
    expect(result.scenario.rooms[0]).not.toBe(s.rooms[0]);
    expect(result.scenario.equipment).not.toBe(s.equipment);
    expect(result.fixed).toEqual(result.original);
    expect(result.reoptimized).toEqual(result.original);
    expect(result.rows.every((row) => !row.changed)).toBe(true);
    expect(result.summary).toContain('same number');
    expect(result.summary).toContain('counts remain unchanged');
  });
  it('increases every known baseline while preserving unknown values', () => {
    const s = example();
    s.rooms[1].existingACH = null;
    const result = analyzeSensitivity(s, snapshot(s), 0.5);
    expect(result.scenario.rooms.map((room) => room.existingACH)).toEqual([2.5, null]);
    expect(result.fixed.rooms[1].after).toBeNull();
    expect(result.reoptimized.rooms[1].units).toBe(0);
    expect(result.fixed.rooms[0].after).toBe(5.5);
  });
  it('rejects negative and upper-bound violations without silently clamping', () => {
    const s = example();
    expect(() => perturbScenario(s, -2.1)).toThrow(/A.*0–50/);
    expect(() => perturbScenario(s, 47)).toThrow(/B.*0–50/);
    expect(perturbScenario(s, -2).rooms[0].existingACH).toBe(0);
    expect(perturbScenario(s, 46).rooms[1].existingACH).toBe(50);
    expect(s.rooms[0].existingACH).toBe(2);
  });
  it('never mutates stored inputs, equipment, or the cached recommendation', () => {
    const s = example();
    const plan = snapshot(s);
    const before = JSON.stringify({ s, plan });
    s.rooms.forEach(Object.freeze);
    Object.freeze(s.rooms);
    Object.freeze(s.equipment);
    Object.freeze(s);
    analyzeSensitivity(s, plan, -0.5);
    expect(JSON.stringify({ s, plan })).toBe(before);
  });
  it('independently evaluates a fixed plan and a different optimum at lower ventilation', () => {
    const s = example();
    const result = analyzeSensitivity(s, snapshot(s), -0.5);
    expect(result.original.rooms.map((row) => row.units)).toEqual([1, 0]);
    expect(result.original.afterStudents).toBe(30);
    expect(result.fixed.rooms.map((row) => row.after)).toEqual([4.5, 3.5]);
    expect(result.fixed.afterStudents).toBe(0);
    expect(result.fixed.afterRooms).toBe(0);
    expect(result.reoptimized.rooms.map((row) => row.units)).toEqual([0, 1]);
    expect(result.reoptimized.rooms.map((row) => row.after)).toEqual([1.5, 6.5]);
    expect(result.reoptimized.afterStudents).toBe(20);
    expect(result.reoptimized.afterRooms).toBe(1);
    expect(result.fixed.cost).toBe(100);
    expect(result.reoptimized.cost).toBe(100);
    expect(result.rows.map((row) => row.changed)).toEqual([true, true]);
    expect(result.summary).toContain('30 fewer');
  });
  it('preserves all equipment constraints, dimensions, occupancy and room limits', () => {
    const s = example();
    const changed = perturbScenario(s, 0.5);
    expect(changed.equipment).toEqual(s.equipment);
    changed.rooms.forEach((room, i) =>
      expect({ ...room, existingACH: s.rooms[i].existingACH }).toEqual(s.rooms[i]),
    );
  });
  it('keeps the demo results and remains feasible and deterministic across tested adjustments', () => {
    const s = demoScenario();
    const plan = snapshot(s);
    expect(plan.allocation.afterStudents).toBe(133);
    expect(plan.allocation.newStudents).toBe(108);
    expect(plan.allocation.units).toBe(6);
    for (const delta of [-1.5, -0.5, 0, 0.5, 2, 10]) {
      const result = analyzeSensitivity(s, plan, delta);
      expect(result).toEqual(analyzeSensitivity(s, plan, delta));
      expect(validateScenario(result.scenario)).toEqual([]);
      for (const allocation of [result.fixed, result.reoptimized]) {
        expect(allocation.cost).toBeLessThanOrEqual(s.equipment.budget);
        allocation.rooms.forEach((row) => {
          expect(Number.isInteger(row.units)).toBe(true);
          expect(row.units).toBeGreaterThanOrEqual(0);
          expect(row.units).toBeLessThanOrEqual(roomLimit(row.room, s.equipment));
        });
      }
    }
  });
  it('invalidates stale plans on classroom edits and recalculates using the changed inputs', () => {
    const s = example();
    const plan = snapshot(s);
    s.rooms[0].existingACH = 1;
    expect(() => analyzeSensitivity(s, plan, 0)).toThrow(/Optimize the current inputs/);
    const result = analyzeSensitivity(s, snapshot(s), 0);
    expect(result.reoptimized.afterStudents).toBe(20);
    expect(result.rows[0].original.before).toBe(1);
  });
  it('rejects invalid sources, non-finite adjustments and infeasible fixed plans', () => {
    const s = example();
    expect(() => perturbScenario(s, NaN)).toThrow(/finite/);
    expect(() => perturbScenario(s, Infinity)).toThrow(/finite/);
    const plan = optimize(s);
    plan.rooms[0].units = 2;
    expect(() => evaluateAllocation(s, plan)).toThrow(/constraints/);
    plan.rooms[0].units = 1;
    plan.rooms[1].units = 1;
    expect(() => evaluateAllocation(s, plan)).toThrow(/budget/);
    plan.rooms[1].units = -1;
    expect(() => evaluateAllocation(s, plan)).toThrow(/constraints/);
    s.equipment.budget = -1;
    expect(() =>
      analyzeSensitivity(s, { key: JSON.stringify(s), allocation: optimize(example()) }, 0),
    ).toThrow(/Budget/);
  });
  it('handles empty schools and all unknown baselines without invented values', () => {
    const s = example();
    s.rooms.forEach((room) => (room.existingACH = null));
    expect(analyzeSensitivity(s, snapshot(s), -100).reoptimized.afterStudents).toBe(0);
    s.rooms = [];
    expect(analyzeSensitivity(s, snapshot(s), 0).rows).toEqual([]);
  });
});
