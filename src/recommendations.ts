import { roomLimit, unitACH } from './model';
import type { Equipment } from './model';
import type { RoomResult } from './optimizer';

export function recommendationExplanation(row: RoomResult, equipment: Equipment): string {
  const seats = `${row.room.students} student seats`;
  if (row.before === null)
    return `${seats}. Baseline ventilation is unknown, so estimated final eACH and the units needed cannot be calculated. No units are recommended until an estimate is supplied.`;
  const estimate = `Baseline ${row.before.toFixed(2)} eACH; ${row.units} recommended units add ${(row.units * unitACH(row.room, equipment)).toFixed(2)} eACH, giving ${row.after!.toFixed(2)} eACH for ${seats}. ${row.reached ? 'Meets' : 'Does not meet'} the ${equipment.target} eACH target.`;
  if (row.units)
    return `${estimate} ${row.needed} units are needed to reach the target under these assumptions.`;
  if (row.needed === 0) return `${estimate} Already meets the target without additional units.`;
  if (row.needed! > roomLimit(row.room, equipment))
    return `${estimate} Reaching the target requires ${row.needed} units, exceeding this room’s effective limit of ${roomLimit(row.room, equipment)}.`;
  return `${estimate} Reaching the target requires ${row.needed} units. This room was not selected in the combination maximizing student seats at target under the current budget and room limits; partial improvements are not purchased by this objective.`;
}
