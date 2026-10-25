import { useState } from 'react';
import { demoScenario } from './model';
import type { Scenario } from './model';
import type { Allocation } from './optimizer';
import EquipmentAnimation from './EquipmentAnimation';

const money = (n: number) =>
  n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 });
const ach = (n: number | null | undefined) =>
  n === null ? 'Unknown' : n === undefined || !Number.isFinite(n) ? 'Pending' : n.toFixed(2);

export default function OverviewHero({
  scenario,
  allocation,
  baseline,
  naive,
  busy,
  valid,
  onOptimize,
  onEquipment,
  onSensitivity,
}: {
  scenario: Scenario;
  allocation: Allocation | null;
  baseline: Allocation | null;
  naive: Allocation | null;
  busy: boolean;
  valid: boolean;
  onOptimize: () => void;
  onEquipment: () => void;
  onSensitivity: () => void;
}) {
  const demo = demoScenario();
  const isDemo =
    JSON.stringify([scenario.rooms, scenario.equipment]) ===
    JSON.stringify([demo.rooms, demo.equipment]);
  const [roomId, setRoomId] = useState('');
  const room = scenario.rooms.find((r) => r.id === roomId) ?? scenario.rooms[0];
  const result = allocation?.rooms.find((r) => r.room.id === room?.id);
  const seats = scenario.rooms.reduce(
    (n, r) => n + (Number.isFinite(r.students) ? r.students : 0),
    0,
  );
  return (
    <section className="overview-hero" aria-label="Allocation summary">
      <div className="hero-room">
        <label className="room-selector">
          View classroom
          <select
            value={room?.id ?? ''}
            disabled={!scenario.rooms.length}
            onChange={(e) => setRoomId(e.target.value)}
          >
            {!scenario.rooms.length && <option value="">No classrooms</option>}
            {scenario.rooms.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name || 'Unnamed classroom'}
              </option>
            ))}
          </select>
        </label>
        <EquipmentAnimation />
        <dl className="room-readout">
          <div>
            <dt>Recommended units</dt>
            <dd>{result ? result.units : 'Pending'}</dd>
          </div>
          <div>
            <dt>Estimated eACH</dt>
            <dd>
              {room ? ach(room.existingACH) : 'Unknown'} → {result ? ach(result.after) : 'Pending'}
            </dd>
          </div>
        </dl>
        <p className="room-caption">
          Schematic layout; figures use the selected classroom. The illustration is not a measured
          airflow simulation.
        </p>
      </div>
      <div className="hero-results">
        <h2>Recommended allocation</h2>
        {isDemo && <p className="demo-context">Fictional demonstration school</p>}
        {allocation ? (
          <>
            <p className="hero-seat-total">
              <strong>{allocation.afterStudents}</strong> / {seats} student seats at target
            </p>
            <p>
              {allocation.newStudents} additional seats in {allocation.newRooms} additional
              classrooms estimated to meet {scenario.equipment.target} eACH.
            </p>
            <div
              className="hero-target-table"
              role="region"
              aria-label="Allocation strategy comparison"
              tabIndex={0}
            >
              <table>
                <caption className="sr-only">Modeled target attainment by strategy</caption>
                <thead>
                  <tr>
                    <th>At target</th>
                    <th>Before</th>
                    <th>Round robin</th>
                    <th>Optimized</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <th scope="row">Student seats</th>
                    <td>{baseline?.beforeStudents}</td>
                    <td>{naive?.afterStudents}</td>
                    <td>{allocation.afterStudents}</td>
                  </tr>
                  <tr>
                    <th scope="row">Classrooms</th>
                    <td>{baseline?.beforeRooms}</td>
                    <td>{naive?.afterRooms}</td>
                    <td>{allocation.afterRooms}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="hero-spending">
              <strong>
                {allocation.units} purifiers · {money(allocation.cost)}
              </strong>
              <span>{money(allocation.remaining)} budget remaining. Purchase costs only.</span>
            </p>
          </>
        ) : (
          <p className="hero-pending">
            Run optimization for the current valid inputs to see a recommendation. Previous
            estimates are hidden after edits.
          </p>
        )}
        <button
          className="button primary"
          onClick={onOptimize}
          disabled={!valid || busy || !scenario.rooms.length}
        >
          {busy ? 'Calculating…' : 'Optimize Allocation'}
        </button>
        <div className="hero-links">
          <button className="text-button" onClick={onEquipment}>
            Equipment settings
          </button>
          <button className="text-button" onClick={onSensitivity}>
            Test ventilation assumptions
          </button>
        </div>
        <p className="hero-limit">
          Modeled planning estimates. Target attainment does not guarantee safety.
        </p>
      </div>
    </section>
  );
}
