export interface Classroom {
  id: string;
  name: string;
  length: number;
  width: number;
  height: number;
  students: number;
  existingACH: number | null;
  maxUnits: number | null;
}
export interface Equipment {
  cost: number;
  cadr: number;
  maxUnits: number;
  budget: number;
  target: number;
}
export interface Scenario {
  version: 1;
  rooms: Classroom[];
  equipment: Equipment;
}
export const MAX_ROOMS = 100;
export const volume = (room: Classroom) => room.length * room.width * room.height;
export const unitACH = (room: Classroom, equipment: Equipment) =>
  (equipment.cadr * 60) / volume(room);
export const roomLimit = (room: Classroom, equipment: Equipment) =>
  Math.min(room.maxUnits ?? equipment.maxUnits, equipment.maxUnits);
export const meetsTarget = (ach: number, target: number) => ach >= target - 1e-9;
export function requiredUnits(room: Classroom, equipment: Equipment): number | null {
  if (room.existingACH === null) return null;
  return Math.max(
    0,
    Math.ceil((equipment.target - room.existingACH - 1e-9) / unitACH(room, equipment)),
  );
}
const numberIn = (value: unknown, min: number, max: number, integer = false): value is number =>
  typeof value === 'number' &&
  Number.isFinite(value) &&
  value >= min &&
  value <= max &&
  (!integer || Number.isInteger(value));
export function validateScenario(scenario: Scenario): string[] {
  const errors: string[] = [];
  const e = scenario.equipment;
  if (!numberIn(e.cost, 0.01, 1000000) || Math.abs(e.cost * 100 - Math.round(e.cost * 100)) > 1e-6)
    errors.push('Unit cost must be $0.01–$1,000,000, with at most two decimal places.');
  if (!numberIn(e.cadr, 1, 10000)) errors.push('CADR must be between 1 and 10,000 cfm.');
  if (!numberIn(e.maxUnits, 0, 20, true))
    errors.push('The classroom unit limit must be a whole number from 0 to 20.');
  if (
    !numberIn(e.budget, 0, 1000000) ||
    Math.abs(e.budget * 100 - Math.round(e.budget * 100)) > 1e-6
  )
    errors.push('Budget must be $0–$1,000,000, with at most two decimal places.');
  if (!numberIn(e.target, 0.1, 50)) errors.push('The eACH target must be between 0.1 and 50.');
  if (scenario.rooms.length > MAX_ROOMS) errors.push(`Use at most ${MAX_ROOMS} classrooms.`);
  const ids = new Set<string>();
  scenario.rooms.forEach((r, i) => {
    const label = `Classroom ${i + 1}`;
    if (typeof r.id !== 'string' || !r.id.trim() || r.id.length > 100 || ids.has(r.id))
      errors.push(`${label}: a unique ID is required.`);
    ids.add(r.id);
    if (typeof r.name !== 'string' || !r.name.trim() || r.name.length > 60)
      errors.push(`${label}: enter a room name of 1–60 characters.`);
    if (!numberIn(r.length, 1, 500) || !numberIn(r.width, 1, 500) || !numberIn(r.height, 1, 100))
      errors.push(`${label}: length and width must be 1–500 ft; height must be 1–100 ft.`);
    if (!numberIn(r.students, 0, 500, true))
      errors.push(`${label}: occupancy must be a whole number from 0 to 500.`);
    if (r.existingACH !== null && !numberIn(r.existingACH, 0, 50))
      errors.push(`${label}: enter baseline ACH from 0 to 50, or leave it unknown.`);
    if (r.maxUnits !== null && !numberIn(r.maxUnits, 0, 20, true))
      errors.push(`${label}: the unit limit must be 0–20, or blank to use the equipment limit.`);
  });
  return errors;
}
export function parseScenario(text: string): Scenario {
  const value: unknown = JSON.parse(text);
  if (!value || typeof value !== 'object')
    throw new Error('Choose a CleanClass scenario JSON file.');
  const s = value as Scenario;
  if (
    s.version !== 1 ||
    !Array.isArray(s.rooms) ||
    !s.equipment ||
    typeof s.equipment !== 'object' ||
    s.rooms.some((r) => !r || typeof r !== 'object')
  )
    throw new Error(
      'Unsupported scenario format. Expected version 1, classrooms, and equipment settings.',
    );
  const errors = validateScenario(s);
  if (errors.length) throw new Error(errors.slice(0, 3).join(' '));
  // Rebuild known fields so imported files cannot add arbitrary persisted data.
  return {
    version: 1,
    rooms: s.rooms.map((r) => ({
      id: r.id,
      name: r.name,
      length: r.length,
      width: r.width,
      height: r.height,
      students: r.students,
      existingACH: r.existingACH,
      maxUnits: r.maxUnits,
    })),
    equipment: {
      cost: s.equipment.cost,
      cadr: s.equipment.cadr,
      maxUnits: s.equipment.maxUnits,
      budget: s.equipment.budget,
      target: s.equipment.target,
    },
  };
}
export function demoScenario(): Scenario {
  return {
    version: 1,
    equipment: { cost: 300, cadr: 300, maxUnits: 4, budget: 1800, target: 5 },
    rooms: [
      {
        id: 'room-101',
        name: 'Room 101',
        length: 30,
        width: 25,
        height: 10,
        students: 28,
        existingACH: 2,
        maxUnits: null,
      },
      {
        id: 'room-102',
        name: 'Room 102',
        length: 28,
        width: 24,
        height: 10,
        students: 26,
        existingACH: 3,
        maxUnits: null,
      },
      {
        id: 'room-103',
        name: 'Room 103',
        length: 32,
        width: 28,
        height: 10,
        students: 30,
        existingACH: 1.5,
        maxUnits: null,
      },
      {
        id: 'room-104',
        name: 'Room 104',
        length: 25,
        width: 24,
        height: 10,
        students: 24,
        existingACH: 4,
        maxUnits: null,
      },
      {
        id: 'room-105',
        name: 'Room 105',
        length: 30,
        width: 26,
        height: 10,
        students: 27,
        existingACH: 2.5,
        maxUnits: null,
      },
      {
        id: 'room-106',
        name: 'Room 106',
        length: 28,
        width: 25,
        height: 10,
        students: 25,
        existingACH: 5.2,
        maxUnits: null,
      },
      {
        id: 'room-107',
        name: 'Science lab',
        length: 40,
        width: 30,
        height: 12,
        students: 32,
        existingACH: 1.8,
        maxUnits: null,
      },
      {
        id: 'room-108',
        name: 'Art studio',
        length: 32,
        width: 25,
        height: 10,
        students: 22,
        existingACH: 3.2,
        maxUnits: null,
      },
    ],
  };
}
