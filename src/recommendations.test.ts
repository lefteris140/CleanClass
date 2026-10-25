import { expect, it } from 'vitest';
import { demoScenario } from './model';
import { optimize } from './optimizer';
import { recommendationExplanation } from './recommendations';

it('explains actual baseline, added eACH, units, attainment and student seats', () => {
  const s = demoScenario();
  const plan = optimize(s);
  const text = recommendationExplanation(plan.rooms[0], s.equipment);
  expect(text).toContain('Baseline 2.00 eACH');
  expect(text).toContain('2 recommended units add 4.80 eACH');
  expect(text).toContain('6.80 eACH for 28 student seats');
  expect(text).toContain('Meets the 5 eACH target');
  expect(text).toContain('2 units are needed');
});
it('distinguishes every zero-unit case without inventing a cause for global selection', () => {
  const s = demoScenario();
  s.rooms[6].maxUnits = 0;
  s.rooms[7].existingACH = null;
  const plan = optimize(s);
  expect(recommendationExplanation(plan.rooms[5], s.equipment)).toContain(
    'Already meets the target',
  );
  expect(recommendationExplanation(plan.rooms[6], s.equipment)).toContain(
    'exceeding this room’s effective limit of 0',
  );
  expect(recommendationExplanation(plan.rooms[7], s.equipment)).toContain(
    'Baseline ventilation is unknown',
  );
  expect(recommendationExplanation(plan.rooms[4], s.equipment)).toContain(
    'not selected in the combination',
  );
  expect(recommendationExplanation(plan.rooms[4], s.equipment)).toContain(
    'partial improvements are not purchased',
  );
});
