import { roomLimit, validateScenario } from './model';
import type { Scenario } from './model';
import { optimize, summarize } from './optimizer';
import type { Allocation } from './optimizer';
import type { AllocationSnapshot } from './release';

export function perturbScenario(source: Scenario, delta: number): Scenario {
  const errors = validateScenario(source);
  if (errors.length) throw new Error(errors.join(' '));
  if (!Number.isFinite(delta)) throw new Error('Enter a finite eACH adjustment.');
  const scenario: Scenario = {
    ...source,
    equipment: { ...source.equipment },
    rooms: source.rooms.map((room) => ({
      ...room,
      existingACH: room.existingACH === null ? null : room.existingACH + delta,
    })),
  };
  const invalid = scenario.rooms.filter(
    (room) => room.existingACH !== null && (room.existingACH < 0 || room.existingACH > 50),
  );
  if (invalid.length)
    throw new Error(
      `Adjustment rejected: ${invalid.map((room) => `${room.name} (${room.existingACH!.toFixed(2)} eACH)`).join(', ')} would fall outside the supported baseline range of 0–50. No values have been clamped or saved.`,
    );
  return scenario;
}

export function evaluateAllocation(scenario: Scenario, plan: Allocation): Allocation {
  const errors = validateScenario(scenario);
  if (errors.length) throw new Error(errors.join(' '));
  const counts = new Map(plan.rooms.map((row) => [row.room.id, row.units]));
  if (
    counts.size !== plan.rooms.length ||
    counts.size !== scenario.rooms.length ||
    scenario.rooms.some((room) => {
      const count = counts.get(room.id);
      return (
        count === undefined ||
        !Number.isInteger(count) ||
        count < 0 ||
        count > roomLimit(room, scenario.equipment) ||
        (room.existingACH === null && count !== 0)
      );
    })
  )
    throw new Error('The original allocation does not match the current classroom constraints.');
  const evaluated = summarize(scenario, counts);
  if (Math.round(evaluated.cost * 100) > Math.round(scenario.equipment.budget * 100))
    throw new Error('The allocation exceeds the equipment budget.');
  return evaluated;
}

export function analyzeSensitivity(source: Scenario, snapshot: AllocationSnapshot, delta: number) {
  if (snapshot.key !== JSON.stringify(source))
    throw new Error('Optimize the current inputs before exploring ventilation assumptions.');
  const scenario = perturbScenario(source, delta);
  const original = evaluateAllocation(source, snapshot.allocation);
  const fixed = evaluateAllocation(scenario, snapshot.allocation);
  const reoptimized = optimize(scenario);
  const rows = fixed.rooms.map((row, index) => ({
    original: original.rooms[index],
    fixed: row,
    reoptimized: reoptimized.rooms[index],
    changed: row.units !== reoptimized.rooms[index].units,
  }));
  const difference = fixed.afterStudents - original.afterStudents;
  const changed = rows.filter((row) => row.changed);
  const attainment =
    difference === 0
      ? 'The original plan places the same number of student seats in rooms meeting the target as its original estimate.'
      : `Under the selected assumptions, the original plan places ${Math.abs(difference)} ${difference < 0 ? 'fewer' : 'more'} student seats in rooms meeting the target compared with its original estimate.`;
  const summary = `${attainment} ${changed.length ? `${changed.length} classroom recommendations change after reoptimization.` : 'The recommended purifier counts remain unchanged under this selected scenario.'} Reoptimization places ${reoptimized.afterStudents} seats in rooms meeting the target.`;
  return { scenario, original, fixed, reoptimized, rows, summary };
}
