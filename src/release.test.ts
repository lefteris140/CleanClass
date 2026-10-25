import { describe, expect, it } from 'vitest';
import { demoScenario } from './model';
import { optimize, roundRobin } from './optimizer';
import { allocationCsv, comparisonDescription } from './release';

function fixture() {
  const scenario = demoScenario();
  return { scenario, snapshot: { key: JSON.stringify(scenario), allocation: optimize(scenario) } };
}

describe('allocation CSV release export', () => {
  it('exports labeled dimensions, occupancy, actual full-precision results, target, and per-room cost', () => {
    const { scenario, snapshot } = fixture();
    const csv = allocationCsv(scenario, snapshot);
    expect(
      csv.startsWith('\uFEFF"Classroom name","Length (ft)","Width (ft)","Ceiling height (ft)"'),
    ).toBe(true);
    expect(csv).toContain(
      '"Student occupancy (seats)","Baseline effective ACH (h^-1)","Purifier units","Estimated final eACH (h^-1)","Selected target eACH (h^-1)","Modeled target attainment","Equipment purchase cost (USD)"',
    );
    expect(csv).toContain('"Room 101","30","25","10","28","2","2","6.8","5","Met","600.00"\r\n');
    const room102 = snapshot.allocation.rooms[1];
    expect(csv).toContain(`"${room102.after}"`);
    expect(csv).toContain('"Room 105","30","26","10","27","2.5","0","2.5","5","Not met","0.00"');
    expect(csv.endsWith('\r\n')).toBe(true);
    expect(csv.split('\r\n').length).toBe(scenario.rooms.length + 2);
  });

  it('escapes commas, quotes, line breaks, and Unicode names without losing them', () => {
    const scenario = demoScenario();
    scenario.rooms[0].name = 'Science, "北"\r\nLab';
    const snapshot = { key: JSON.stringify(scenario), allocation: optimize(scenario) };
    expect(allocationCsv(scenario, snapshot)).toContain('"Science, ""北""\r\nLab","30"');
  });

  it('keeps unknown estimates distinct from zero and does not claim attainment for them', () => {
    const scenario = demoScenario();
    scenario.rooms[0].existingACH = null;
    const snapshot = { key: JSON.stringify(scenario), allocation: optimize(scenario) };
    expect(allocationCsv(scenario, snapshot)).toContain(
      '"Room 101","30","25","10","28","Unknown","0","Unknown","5","Excluded: baseline unknown","0.00"',
    );
  });

  it('rejects stale snapshots after room, equipment, or budget changes', () => {
    for (const change of ['name', 'budget', 'cadr'] as const) {
      const { scenario, snapshot } = fixture();
      if (change === 'name') scenario.rooms[0].name = 'Renamed';
      else scenario.equipment[change] += 1;
      expect(() => allocationCsv(scenario, snapshot)).toThrow('Optimize the current valid inputs');
    }
  });

  it('rejects invalid current inputs even when their fingerprint matches', () => {
    const { scenario, snapshot } = fixture();
    scenario.equipment.cost = 0;
    snapshot.key = JSON.stringify(scenario);
    expect(() => allocationCsv(scenario, snapshot)).toThrow();
  });

  it('uses integer-cent purchase costs rather than floating point currency artifacts', () => {
    const scenario = demoScenario();
    scenario.equipment.cost = 0.29;
    const snapshot = { key: JSON.stringify(scenario), allocation: optimize(scenario) };
    expect(allocationCsv(scenario, snapshot)).toContain('"6.8","5","Met","0.58"');
  });

  it('protects formula-like room names when opened in spreadsheets', () => {
    for (const name of ['=1+1', '+1', '-1', '@SUM(A1)', '  =1', '\t=1']) {
      const scenario = demoScenario();
      scenario.rooms[0].name = name;
      const snapshot = { key: JSON.stringify(scenario), allocation: optimize(scenario) };
      expect(allocationCsv(scenario, snapshot)).toContain(`"'${name}","30"`);
    }
  });

  it('supports an empty but valid school as a header-only export', () => {
    const scenario = demoScenario();
    scenario.rooms = [];
    const snapshot = { key: JSON.stringify(scenario), allocation: optimize(scenario) };
    expect(allocationCsv(scenario, snapshot).split('\r\n').length).toBe(2);
  });
});

describe('comparison release language', () => {
  it('describes equal outcomes and equal spending without zero-difference claims', () => {
    const scenario = demoScenario();
    scenario.equipment.budget = 0;
    const text = comparisonDescription(optimize(scenario), roundRobin(scenario), 0);
    expect(text).toContain('the same number of student seats');
    expect(text).toContain('the same number of rooms');
    expect(text).toContain('the same equipment cost');
    expect(text).not.toMatch(/\$0 less|0 more|0 fewer|0 additional/);
    expect(text).toContain('not measured health outcomes');
  });
  it('reports positive seat differences and equal costs from the actual demo calculation', () => {
    const scenario = demoScenario();
    scenario.equipment.budget = 900;
    const text = comparisonDescription(optimize(scenario), roundRobin(scenario), 900);
    expect(text).toContain('46 more student seats');
    expect(text).toContain('2 more rooms');
    expect(text).toContain('the same equipment cost');
  });
  it('handles fewer rooms, lower cost, and cents without changing the seat objective', () => {
    const text = comparisonDescription(
      { afterStudents: 100, afterRooms: 2, cost: 599.99 },
      { afterStudents: 80, afterRooms: 3, cost: 600 },
      600,
    );
    expect(text).toContain('20 more student seats');
    expect(text).toContain('1 fewer room');
    expect(text).toContain('$0.01 less in equipment purchase cost');
    expect(text).toContain('Student seats are the primary objective');
  });
  it('handles higher cost without describing it as a saving', () => {
    expect(
      comparisonDescription(
        { afterStudents: 100, afterRooms: 3, cost: 600 },
        { afterStudents: 90, afterRooms: 3, cost: 300 },
        600,
      ),
    ).toContain('$300 more in equipment purchase cost');
  });
});
