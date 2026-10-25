import { useMemo, useState } from 'react';
import type { Scenario } from './model';
import { validateScenario } from './model';
import type { AllocationSnapshot } from './release';
import { analyzeSensitivity } from './sensitivity';

const ach = (value: number | null) => (value === null ? 'Unknown' : value.toFixed(2));
const money = (value: number) =>
  value.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
const status = (reached: boolean, after: number | null) =>
  after === null ? 'Unknown' : reached ? 'Meets target' : 'Below target';

export default function SensitivityPanel({
  scenario,
  snapshot,
  onOptimize,
}: {
  scenario: Scenario;
  snapshot: AllocationSnapshot;
  onOptimize: () => void;
}) {
  const [draft, setDraft] = useState('0');
  const outcome = useMemo(() => {
    try {
      if (!draft.trim()) throw new Error('Enter an eACH adjustment.');
      return { result: analyzeSensitivity(scenario, snapshot, Number(draft)), error: '' };
    } catch (error) {
      return { result: null, error: error instanceof Error ? error.message : 'Review the inputs.' };
    }
  }, [scenario, snapshot, draft]);
  const result = outcome.result;
  const stale = snapshot.key !== JSON.stringify(scenario);
  return (
    <section className="panel sensitivity-panel" aria-labelledby="sensitivity-heading">
      <div className="panel-heading">
        <div>
          <h2 id="sensitivity-heading">Test ventilation assumptions</h2>
          <p>
            Explore how a hypothetical change in baseline ventilation affects the main recommended
            allocation.
          </p>
        </div>
      </div>
      <p>
        This applies the same adjustment to every known baseline effective ACH. Unknown estimates
        stay unknown. These are user-selected scenarios, not confidence intervals or measured error
        ranges.
      </p>
      <div className="sensitivity-controls">
        <label className="field">
          <span>Baseline eACH adjustment</span>
          <input
            type="number"
            step="any"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            aria-describedby="sensitivity-hint sensitivity-error"
          />
        </label>
        <label className="field sensitivity-slider">
          <span>Illustrative adjustment: −2 to +2 eACH</span>
          <input
            type="range"
            min="-2"
            max="2"
            step="0.1"
            value={Number.isFinite(Number(draft)) ? Math.max(-2, Math.min(2, Number(draft))) : 0}
            aria-label="Illustrative baseline adjustment"
            onChange={(event) => setDraft(event.target.value)}
          />
        </label>
        <button className="button" onClick={() => setDraft('0')}>
          Restore original assumptions
        </button>
      </div>
      <p id="sensitivity-hint" className="chart-note">
        The number field accepts larger changes within the supported baseline range. Classroom
        records are never changed. Budget: {money(scenario.equipment.budget)}; target:{' '}
        {scenario.equipment.target} eACH. The separate comparison budget below does not affect this
        analysis.
      </p>
      <div id="sensitivity-error" role="status">
        {outcome.error && <p className="sensitivity-error">{outcome.error}</p>}
      </div>
      {stale && (
        <button
          className="button"
          disabled={validateScenario(scenario).length > 0}
          onClick={onOptimize}
        >
          Recalculate main plan
        </button>
      )}
      {result && (
        <>
          <p className="sensitivity-summary" role="status">
            {result.summary}
          </p>
          <div className="table-scroll" role="region" aria-label="Sensitivity summary" tabIndex={0}>
            <table className="sensitivity-summary-table">
              <caption>
                Modeled results at {Number(draft) > 0 ? '+' : ''}
                {Number(draft)} eACH adjustment
              </caption>
              <thead>
                <tr>
                  <th>Measure</th>
                  <th>Original plan, original assumptions</th>
                  <th>Original plan, changed assumptions</th>
                  <th>Reoptimized plan, changed assumptions</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <th scope="row">Student seats at target</th>
                  {[result.original, result.fixed, result.reoptimized].map((plan, i) => (
                    <td key={i}>{plan.afterStudents}</td>
                  ))}
                </tr>
                <tr>
                  <th scope="row">Classrooms at target</th>
                  {[result.original, result.fixed, result.reoptimized].map((plan, i) => (
                    <td key={i}>{plan.afterRooms}</td>
                  ))}
                </tr>
                <tr>
                  <th scope="row">Equipment purchase cost</th>
                  {[result.original, result.fixed, result.reoptimized].map((plan, i) => (
                    <td key={i}>{money(plan.cost)}</td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
          <h3>Classroom recommendations</h3>
          <p>
            {result.rows.filter((row) => row.changed).length} changed;{' '}
            {result.rows.filter((row) => !row.changed).length} unchanged. Target statuses below
            compare each plan using the changed assumptions.
          </p>
          <div
            className="table-scroll"
            role="region"
            aria-label="Sensitivity classroom comparison"
            tabIndex={0}
          >
            <table className="sensitivity-room-table">
              <caption className="sr-only">
                Original and reoptimized purifier counts and target attainment
              </caption>
              <thead>
                <tr>
                  <th>Classroom</th>
                  <th>Original units</th>
                  <th>Reoptimized units</th>
                  <th>Original plan eACH</th>
                  <th>Reoptimized eACH</th>
                  <th>Target attainment</th>
                </tr>
              </thead>
              <tbody>
                {result.rows.map(({ original, fixed, reoptimized, changed }) => (
                  <tr key={fixed.room.id} className={changed ? 'recommendation-changed' : ''}>
                    <th scope="row">
                      {fixed.room.name}
                      <small>
                        Baseline: {ach(original.before)} → {ach(fixed.before)} eACH
                      </small>
                      <span className="change-label">
                        {changed ? 'Changed allocation' : 'Same allocation'}
                      </span>
                    </th>
                    <td>{original.units}</td>
                    <td>
                      <strong>{reoptimized.units}</strong>
                    </td>
                    <td>{ach(fixed.after)}</td>
                    <td>{ach(reoptimized.after)}</td>
                    <td>
                      <span>Original plan: {status(fixed.reached, fixed.after)}</span>
                      <small>Reoptimized: {status(reoptimized.reached, reoptimized.after)}</small>
                      <small>
                        {fixed.after === null
                          ? 'Target attainment remains unknown.'
                          : original.reached !== fixed.reached
                            ? 'Original plan attainment changes from its initial estimate.'
                            : 'Original plan attainment unchanged.'}
                      </small>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {result.rows.some((row) => row.changed) && (
            <div className="sensitivity-reasons">
              <h3>Why recommendations differ</h3>
              {result.rows
                .filter((row) => row.changed)
                .map(({ original, fixed, reoptimized }) => (
                  <p key={fixed.room.id}>
                    <strong>{fixed.room.name}:</strong> {original.units} → {reoptimized.units}{' '}
                    assigned units. Units needed to reach target: {original.needed ?? 'unknown'} →{' '}
                    {fixed.needed ?? 'unknown'}. The optimizer selects the combination maximizing
                    student seats reaching target within the unchanged budget and room limits, then
                    applies its room-count and cost tie-breaks.
                  </p>
                ))}
            </div>
          )}
          <p className="chart-note">
            All figures are modeled estimates. This exploration tests assumptions; it does not
            validate measured ventilation, predict health outcomes, or guarantee safety.
          </p>
        </>
      )}
    </section>
  );
}
