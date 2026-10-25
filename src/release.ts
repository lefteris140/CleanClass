import { validateScenario } from './model';
import type { Scenario } from './model';
import type { Allocation } from './optimizer';

export interface AllocationSnapshot {
  key: string;
  allocation: Allocation;
}

function csvCell(value: string | number): string {
  let text = String(value);
  // Preserve text as text when opened in spreadsheet applications.
  if (typeof value === 'string' && /^[\s]*[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

/** Export the cached calculation only when it still matches valid current inputs. */
export function allocationCsv(scenario: Scenario, snapshot: AllocationSnapshot): string {
  if (validateScenario(scenario).length || snapshot.key !== JSON.stringify(scenario)) {
    throw new Error('Optimize the current valid inputs before exporting an allocation.');
  }
  const rows: (string | number)[][] = [
    [
      'Classroom name',
      'Length (ft)',
      'Width (ft)',
      'Ceiling height (ft)',
      'Student occupancy (seats)',
      'Baseline effective ACH (h^-1)',
      'Purifier units',
      'Estimated final eACH (h^-1)',
      'Selected target eACH (h^-1)',
      'Modeled target attainment',
      'Equipment purchase cost (USD)',
    ],
  ];
  for (const r of snapshot.allocation.rooms) {
    rows.push([
      r.room.name,
      r.room.length,
      r.room.width,
      r.room.height,
      r.room.students,
      r.before ?? 'Unknown',
      r.units,
      r.after ?? 'Unknown',
      scenario.equipment.target,
      r.before === null ? 'Excluded: baseline unknown' : r.reached ? 'Met' : 'Not met',
      ((r.units * Math.round(scenario.equipment.cost * 100)) / 100).toFixed(2),
    ]);
  }
  // BOM preserves Unicode room names in Excel; quoted fields and CRLF follow CSV conventions.
  return '\uFEFF' + rows.map((row) => row.map(csvCell).join(',')).join('\r\n') + '\r\n';
}

export function comparisonDescription(
  optimized: Pick<Allocation, 'afterStudents' | 'afterRooms' | 'cost'>,
  baseline: Pick<Allocation, 'afterStudents' | 'afterRooms' | 'cost'>,
  budget: number,
): string {
  const money = (n: number) =>
    new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: Number.isInteger(n) ? 0 : 2,
    }).format(n);
  const seats = optimized.afterStudents - baseline.afterStudents;
  const rooms = optimized.afterRooms - baseline.afterRooms;
  const costCents = Math.round(optimized.cost * 100) - Math.round(baseline.cost * 100);
  const seatText =
    seats === 0
      ? 'the same number of student seats'
      : `${Math.abs(seats)} ${seats > 0 ? 'more' : 'fewer'} student seat${Math.abs(seats) === 1 ? '' : 's'}`;
  const roomText =
    rooms === 0
      ? 'the same number of rooms'
      : `${Math.abs(rooms)} ${rooms > 0 ? 'more' : 'fewer'} room${Math.abs(rooms) === 1 ? '' : 's'}`;
  const costText =
    costCents === 0
      ? 'the same equipment cost'
      : `${money(Math.abs(costCents) / 100)} ${costCents > 0 ? 'more' : 'less'} in equipment purchase cost`;
  return `At ${money(budget)}, compared with round robin, optimization yields ${seatText} in rooms estimated to meet the selected target, ${roomText} at that target, and ${costText}. Student seats are the primary objective; room count may differ. These are modeled target-attainment estimates, not measured health outcomes.`;
}
