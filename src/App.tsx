import { useEffect, useMemo, useRef, useState } from 'react';
import type { ChangeEvent, ReactNode } from 'react';
import {
  ArrowDownToLine,
  ArrowRight,
  ArrowUpRight,
  Check,
  ChevronRight,
  Copy,
  Plus,
  RotateCcw,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  demoScenario,
  MAX_ROOMS,
  parseScenario,
  roomLimit,
  validateScenario,
  volume,
} from './model';
import type { Classroom, Equipment, Scenario } from './model';
import { optimize, roundRobin } from './optimizer';
import type { Allocation } from './optimizer';
import { allocationCsv, comparisonDescription } from './release';
import EquipmentAnimation from './EquipmentAnimation';

const STORAGE_KEY = 'cleanclass.scenario.v1';
const money = (n: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: Number.isInteger(n) ? 0 : 2,
  }).format(n);
const decimal = (n: number | null) => (n === null ? 'Unknown' : n.toFixed(2));
const numeric = (n: number | null) => (n === null || !Number.isFinite(n) ? '' : n);
const numberFrom = (event: ChangeEvent<HTMLInputElement>) =>
  event.target.value === '' ? NaN : Number(event.target.value);
type Page = 'overview' | 'classrooms' | 'equipment' | 'scenarios' | 'method';
const navigation = [
  { id: 'overview', label: 'Overview' },
  { id: 'classrooms', label: 'Classroom planner' },
  { id: 'equipment', label: 'Equipment settings' },
  { id: 'scenarios', label: 'Scenario comparison' },
  { id: 'method', label: 'How it works' },
] as const;
function initialState(): { scenario: Scenario; notice: string; persistence: boolean } {
  try {
    const persistence = localStorage.getItem(STORAGE_KEY + '.remember') !== 'false';
    const saved = persistence ? localStorage.getItem(STORAGE_KEY) : null;
    return { scenario: saved ? parseScenario(saved) : demoScenario(), notice: '', persistence };
  } catch {
    return {
      scenario: demoScenario(),
      notice: 'Saved data could not be loaded. The demonstration scenario is ready instead.',
      persistence: false,
    };
  }
}
function Empty({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="empty">
      <h3>{title}</h3>
      <p>{children}</p>
    </div>
  );
}
function InputField({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  );
}
function AllocationTable({ allocation, target }: { allocation: Allocation; target: number }) {
  return (
    <div
      className="table-scroll"
      role="region"
      aria-label="Classroom allocation table"
      tabIndex={0}
    >
      <table className="results-table">
        <caption className="sr-only">
          Recommended air purifier allocation, target {target} eACH
        </caption>
        <thead>
          <tr>
            <th>Classroom</th>
            <th>Students</th>
            <th>Units</th>
            <th>Before eACH</th>
            <th>After eACH</th>
            <th>Target status</th>
          </tr>
        </thead>
        <tbody>
          {allocation.rooms.map((r) => (
            <tr key={r.room.id}>
              <td>
                <strong>{r.room.name}</strong>
                <small>{volume(r.room).toLocaleString()} ft³</small>
              </td>
              <td>{r.room.students}</td>
              <td>
                <span className={`unit-pill ${r.units ? 'allocated' : ''}`}>{r.units}</span>
              </td>
              <td>{decimal(r.before)}</td>
              <td className="after-cell">
                <strong>{decimal(r.after)}</strong>
              </td>
              <td>
                <span
                  className={`status ${r.reached ? 'success' : r.before === null ? 'neutral' : 'pending'}`}
                >
                  {r.reached ? <Check size={13} /> : <span className="status-dot" />}
                  {r.before === null
                    ? 'Estimate needed'
                    : r.newlyReached
                      ? 'Target reached'
                      : r.reached
                        ? 'Already at target'
                        : 'Below target'}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
function Explanation({ allocation, scenario }: { allocation: Allocation; scenario: Scenario }) {
  const selected = allocation.rooms.filter((r) => r.newlyReached);
  const excluded = allocation.rooms.filter((r) => r.before === null);
  const blocked = allocation.rooms.filter(
    (r) => r.needed !== null && r.needed > roomLimit(r.room, scenario.equipment),
  );
  const unselected = allocation.rooms.filter(
    (r) => !r.reached && r.before !== null && r.needed! <= roomLimit(r.room, scenario.equipment),
  );
  return (
    <div className="explanation">
      <div>
        <h3>Why this allocation?</h3>
        <p>
          {selected.length ? (
            <>
              The optimizer assigns {allocation.units} units to {selected.length} classrooms, moving{' '}
              <strong>{allocation.newStudents} student seats</strong> into rooms estimated to meet{' '}
              {scenario.equipment.target} eACH.{' '}
              {selected
                .slice(0, 2)
                .map(
                  (r) =>
                    `${r.room.name} needs ${r.needed} unit${r.needed === 1 ? '' : 's'} for ${r.room.students} seats`,
                )
                .join('; ')}
              .
              {unselected.length > 0 &&
                ` ${unselected[0].room.name} needs ${unselected[0].needed} units for ${unselected[0].room.students} seats and was not selected under this budget. This combination maximizes total student seats reaching the target.`}
            </>
          ) : (
            <>
              No additional classrooms can reach the target with this budget and these room limits.
              Try a larger budget, a higher CADR, or review your room limits.
            </>
          )}
          {blocked.length > 0 &&
            ` ${blocked.length} room${blocked.length === 1 ? ' needs' : 's need'} more units than the allowed limit.`}
          {excluded.length > 0 &&
            ` ${excluded.length} room${excluded.length === 1 ? ' is' : 's are'} excluded because baseline ACH is unknown.`}{' '}
          Unspent budget is retained when another full classroom target cannot be achieved.
        </p>
      </div>
    </div>
  );
}

export default function App() {
  const [initial] = useState(initialState);
  const [scenario, setScenario] = useState<Scenario>(initial.scenario);
  const [page, setPage] = useState<Page>('overview');
  const [notice, setNotice] = useState(initial.notice);
  const [persistence, setPersistence] = useState(initial.persistence);
  const [saved, setSaved] = useState(false);
  const [result, setResult] = useState<{ key: string; allocation: Allocation }>(() => ({
    key: JSON.stringify(initial.scenario),
    allocation: optimize(initial.scenario),
  }));
  const [busy, setBusy] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [compareBudget, setCompareBudget] = useState(initial.scenario.equipment.budget);
  const fileInput = useRef<HTMLInputElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const errors = useMemo(() => validateScenario(scenario), [scenario]);
  const valid = errors.length === 0;
  const key = JSON.stringify(scenario);
  const current = result.key === key && valid;
  const allocation = current ? result.allocation : null;
  const unknown = scenario.rooms.filter((r) => r.existingACH === null).length;
  const baseline = useMemo(
    () =>
      valid ? roundRobin({ ...scenario, equipment: { ...scenario.equipment, budget: 0 } }) : null,
    [scenario, valid],
  );
  const occupancy = scenario.rooms.reduce(
    (n, r) => n + (Number.isFinite(r.students) ? r.students : 0),
    0,
  );
  useEffect(() => {
    if (!persistence || !valid) {
      setSaved(false);
      return;
    }
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(scenario));
      setSaved(true);
    } catch {
      setSaved(false);
      setNotice('Browser storage is unavailable. Export JSON to keep a copy of your plan.');
    }
  }, [scenario, persistence, valid]);
  useEffect(() => {
    if (confirmReset) document.getElementById('cancel-reset')?.focus();
  }, [confirmReset]);
  function navigate(next: Page) {
    setPage(next);
    requestAnimationFrame(() => heading.current?.focus());
  }
  function updateEquipment(field: keyof Equipment, value: number) {
    setScenario((s) => ({ ...s, equipment: { ...s.equipment, [field]: value } }));
  }
  function updateRoom(id: string, field: keyof Classroom, value: string | number | null) {
    setScenario((s) => ({
      ...s,
      rooms: s.rooms.map((r) => (r.id === id ? { ...r, [field]: value } : r)),
    }));
  }
  function addRoom(source?: Classroom) {
    if (scenario.rooms.length >= MAX_ROOMS) return;
    const room: Classroom = source
      ? { ...source, id: crypto.randomUUID(), name: `${source.name.slice(0, 53)} (copy)` }
      : {
          id: crypto.randomUUID(),
          name: `Room ${scenario.rooms.length + 1}`,
          length: 30,
          width: 25,
          height: 10,
          students: 25,
          existingACH: null,
          maxUnits: null,
        };
    setScenario((s) => ({ ...s, rooms: [...s.rooms, room] }));
    setNotice(
      source
        ? 'Classroom duplicated. Review its measurements and occupancy.'
        : 'Classroom added. Enter a baseline ACH estimate to include it in optimization.',
    );
  }
  function runOptimization() {
    if (!valid || busy) return;
    setBusy(true);
    // Yield one frame so the calculation state is visible and announced.
    window.setTimeout(() => {
      try {
        const a = optimize(scenario);
        setResult({ key, allocation: a });
        setNotice(
          `Allocation ready: ${a.newRooms} additional classrooms and ${a.newStudents} student seats reach the selected target.`,
        );
        navigate('overview');
      } catch (error) {
        setNotice(error instanceof Error ? error.message : 'Unable to calculate this scenario.');
      } finally {
        setBusy(false);
      }
    }, 100);
  }
  function exportScenario() {
    if (!valid) return;
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(scenario, null, 2)], { type: 'application/json' }),
    );
    const a = document.createElement('a');
    a.href = url;
    a.download = 'cleanclass-scenario.json';
    a.click();
    URL.revokeObjectURL(url);
    setNotice('Scenario exported. The JSON file includes classrooms and equipment settings.');
  }
  function exportAllocation() {
    if (!current || busy) return;
    try {
      const csv = allocationCsv(scenario, result);
      const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = 'cleanclass-allocation.csv';
      a.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      setNotice('Allocation CSV exported from the current optimized plan.');
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Unable to export this allocation.');
    }
  }
  async function importScenario(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (file.size > 1000000) {
      setNotice('Import failed: use a scenario file smaller than 1 MB.');
      return;
    }
    try {
      const imported = parseScenario(await file.text());
      setScenario(imported);
      setCompareBudget(imported.equipment.budget);
      setNotice('Scenario imported. Select Optimize Allocation to calculate your new plan.');
    } catch (error) {
      setNotice(
        `Import failed: ${error instanceof Error ? error.message : 'Could not read the file.'}`,
      );
    }
  }
  const chartData =
    allocation?.rooms
      .filter((r) => r.before !== null)
      .map((r) => ({
        name: r.room.name,
        'Before allocation': Number(r.before!.toFixed(2)),
        'After allocation': Number(r.after!.toFixed(2)),
      })) ?? [];
  const compare = useMemo(() => {
    if (!valid) return null;
    const s = { ...scenario, equipment: { ...scenario.equipment, budget: compareBudget } };
    return { optimized: optimize(s), naive: roundRobin(s) };
  }, [scenario, compareBudget, valid]);
  const sliderMax = valid
    ? Math.min(
        1000000,
        Math.max(3000, scenario.equipment.budget * 2, scenario.equipment.cost * 10, compareBudget),
      )
    : 10000;
  const curve = useMemo(() => {
    if (!valid || page !== 'scenarios') return [];
    return Array.from({ length: 21 }, (_, i) => {
      const budget = Math.round(((sliderMax * i) / 20) * 100) / 100;
      const s = { ...scenario, equipment: { ...scenario.equipment, budget } };
      return {
        budget,
        Optimized: optimize(s).afterStudents,
        'Round robin': roundRobin(s).afterStudents,
      };
    });
  }, [scenario, valid, sliderMax, page]);

  return (
    <div className="app-shell">
      <a href="#main-content" className="skip-link">
        Skip to content
      </a>
      <aside className="sidebar">
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            navigate('overview');
          }}
          aria-label="CleanClass overview"
        >
          <span>
            CleanClass<span className="brand-sub">Classroom planning</span>
          </span>
        </a>
        <nav aria-label="Main navigation">
          {navigation.map((item) => (
            <button
              key={item.id}
              onClick={() => navigate(item.id)}
              className={`nav-item ${page === item.id ? 'active' : ''}`}
              aria-current={page === item.id ? 'page' : undefined}
            >
              <span>{item.label}</span>
            </button>
          ))}
        </nav>
        <label className="mobile-section">
          <span>Section</span>
          <select value={page} onChange={(e) => navigate(e.target.value as Page)}>
            {navigation.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        <div className="sidebar-bottom">
          <div className="purpose-note">
            <h3>Understand the recommendation</h3>
            <p>Review the calculation, assumptions, and scientific references.</p>
            <button onClick={() => navigate('method')}>
              Read the methodology <ArrowUpRight size={14} />
            </button>
          </div>
          <div className="local-note">
            <span>
              Stored locally<small>Calculations run in your browser</small>
            </span>
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            CleanClass <ChevronRight size={14} />
            <strong>School air plan</strong>
          </div>
          <div className="topbar-right">
            <span className="save-state">
              <span className={`status-dot ${saved ? 'green' : ''}`} />
              {saved ? 'Saved on this device' : persistence ? 'Unsaved changes' : 'Session only'}
            </span>
          </div>
        </header>
        <main id="main-content">
          <div className={`page-heading${page === 'overview' ? ' overview-heading' : ''}`}>
            <div>
              <h1 ref={heading} tabIndex={-1}>
                {page === 'overview'
                  ? 'Classroom air allocation'
                  : navigation.find((n) => n.id === page)?.label}
              </h1>
              <p>
                {page === 'overview'
                  ? 'Allocate your equipment budget across classrooms and compare estimated clean-air improvements.'
                  : page === 'classrooms'
                    ? 'Enter room dimensions, occupancy, and estimated existing ventilation.'
                    : page === 'equipment'
                      ? 'Set the equipment, budget, and clean-air target for your school.'
                      : page === 'scenarios'
                        ? 'Compare optimized and round-robin allocations at different budgets.'
                        : 'Review the calculation, assumptions, and sources behind your plan.'}
              </p>
            </div>
            <div className="heading-actions">
              <input
                ref={fileInput}
                type="file"
                tabIndex={-1}
                accept=".json,application/json"
                onChange={importScenario}
                className="sr-only"
                aria-label="Import scenario JSON"
              />
              <button className="button secondary" onClick={() => fileInput.current?.click()}>
                <Upload size={16} />
                Import
              </button>
              <button className="button secondary" onClick={exportScenario} disabled={!valid}>
                <ArrowDownToLine size={16} />
                Export JSON
              </button>
              <button
                className="button secondary"
                onClick={exportAllocation}
                disabled={!current || busy}
                title={
                  current
                    ? 'Download the current optimized classroom allocation'
                    : 'Optimize the current valid inputs before exporting'
                }
              >
                <ArrowDownToLine size={16} />
                Export allocation CSV
              </button>
            </div>
            {page === 'overview' && <EquipmentAnimation />}
          </div>
          {notice && (
            <div className="notice" role="status">
              <span>{notice}</span>
              <button aria-label="Dismiss notification" onClick={() => setNotice('')}>
                <X size={17} />
              </button>
            </div>
          )}
          {!valid && (
            <div className="validation" role="alert">
              <strong>A few inputs need attention</strong>
              <ul>
                {errors.slice(0, 8).map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
              {errors.length > 8 && (
                <p>And {errors.length - 8} more. Review your classroom inputs.</p>
              )}
              <p>
                Correct these in the classroom planner or equipment settings to calculate or export.
              </p>
            </div>
          )}

          {page === 'overview' && (
            <>
              <section className="plan-facts" aria-label="School summary">
                <dl>
                  <div>
                    <dt>Classrooms</dt>
                    <dd>{scenario.rooms.length}</dd>
                  </div>
                  <div>
                    <dt>Student seats</dt>
                    <dd>{occupancy.toLocaleString()}</dd>
                  </div>
                  <div>
                    <dt>Equipment budget</dt>
                    <dd>
                      {Number.isFinite(scenario.equipment.budget)
                        ? money(scenario.equipment.budget)
                        : 'Unavailable'}
                    </dd>
                  </div>
                  <div>
                    <dt>Selected target</dt>
                    <dd>
                      {Number.isFinite(scenario.equipment.target)
                        ? scenario.equipment.target + ' eACH'
                        : 'Unavailable'}
                    </dd>
                  </div>
                </dl>
                {unknown > 0 && (
                  <p>{unknown} classroom(s) excluded until baseline ACH is estimated.</p>
                )}
              </section>
              <section className="allocation-report" aria-label="Allocation summary">
                <div className="report-heading">
                  <h2>Recommended allocation</h2>
                  <button
                    className="button primary"
                    onClick={runOptimization}
                    disabled={!valid || busy || !scenario.rooms.length}
                  >
                    {busy ? 'Calculating…' : 'Optimize Allocation'}
                    {!busy && <ArrowRight size={17} />}
                  </button>
                </div>
                <p className="calculation-state">
                  {current
                    ? JSON.stringify([scenario.rooms, scenario.equipment]) ===
                      JSON.stringify([demoScenario().rooms, demoScenario().equipment])
                      ? 'Calculated from demonstration inputs.'
                      : 'Calculated from the current inputs.'
                    : 'Inputs changed. Run optimization to refresh the recommendation.'}
                </p>
                <div className="report-body">
                  <div className="report-explanation">
                    {allocation ? (
                      <>
                        <p className="allocation-outcome">
                          <strong>{allocation.newStudents} additional student seats</strong> in
                          classrooms estimated to meet {scenario.equipment.target} eACH.
                        </p>
                        <p>
                          Purchase {allocation.units} purifiers for {money(allocation.cost)}.
                          Equipment cost excludes operation and maintenance.
                        </p>
                      </>
                    ) : (
                      <p className="allocation-outcome">
                        Run optimization to calculate a recommendation for these classrooms.
                      </p>
                    )}
                    <button className="text-button" onClick={() => navigate('equipment')}>
                      Review equipment settings <ArrowRight size={14} />
                    </button>
                  </div>
                  <div
                    className="report-comparison"
                    role="region"
                    aria-label="Before and after target attainment"
                    tabIndex={0}
                  >
                    <table>
                      <caption className="sr-only">
                        Estimated target attainment before and after allocation
                      </caption>
                      <thead>
                        <tr>
                          <th scope="col">At selected target</th>
                          <th scope="col">Before</th>
                          <th scope="col">After</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <th scope="row">Classrooms</th>
                          <td>
                            {baseline ? baseline.beforeRooms : 'Unavailable'} /{' '}
                            {scenario.rooms.length}
                          </td>
                          <td>
                            {allocation
                              ? allocation.afterRooms + ' / ' + scenario.rooms.length
                              : 'Recalculate'}
                          </td>
                        </tr>
                        <tr>
                          <th scope="row">Student seats</th>
                          <td>{baseline ? baseline.beforeStudents : 'Unavailable'}</td>
                          <td>{allocation ? allocation.afterStudents : 'Recalculate'}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </section>
              <section className="panel chart-panel">
                <div className="panel-heading">
                  <div>
                    <h2>Clean-air estimates by classroom</h2>
                    <p>Estimated equivalent air changes per hour (eACH)</p>
                  </div>
                  <span className="badge">
                    Target <strong>{numeric(scenario.equipment.target)} eACH</strong>
                  </span>
                </div>
                {allocation && chartData.length ? (
                  <>
                    <div
                      className="chart-wrap"
                      role="img"
                      tabIndex={0}
                      aria-label="Before and after eACH by classroom. Exact values are available in the allocation table below."
                    >
                      <div
                        className="bar-chart-canvas"
                        style={{ minWidth: Math.max(570, chartData.length * 70) }}
                      >
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart
                            data={chartData}
                            margin={{ top: 20, right: 25, bottom: 10, left: -20 }}
                            barGap={5}
                          >
                            <CartesianGrid vertical={false} stroke="#e8ecea" />
                            <XAxis
                              dataKey="name"
                              axisLine={false}
                              tickLine={false}
                              tick={{ fill: '#526460', fontSize: 12 }}
                              interval={0}
                              angle={chartData.length > 8 ? -25 : 0}
                              height={chartData.length > 8 ? 65 : 35}
                            />
                            <YAxis
                              axisLine={false}
                              tickLine={false}
                              tick={{ fill: '#526460', fontSize: 12 }}
                            />
                            <Tooltip
                              cursor={{ fill: '#f3f7f5' }}
                              formatter={(value) => `${value} eACH`}
                              contentStyle={{
                                borderRadius: 2,
                                border: '1px solid #dfe7e2',
                                fontSize: 12,
                              }}
                            />
                            <Legend
                              iconType="square"
                              iconSize={10}
                              itemSorter={(item) => (item.value === 'Before allocation' ? 0 : 1)}
                              wrapperStyle={{ fontSize: 12, paddingTop: 16 }}
                            />
                            <ReferenceLine
                              y={scenario.equipment.target}
                              stroke="#9b7336"
                              strokeDasharray="5 5"
                            />
                            <Bar
                              dataKey="Before allocation"
                              fill="#8296a2"
                              radius={[0, 0, 0, 0]}
                              maxBarSize={32}
                              isAnimationActive={false}
                            />
                            <Bar
                              dataKey="After allocation"
                              fill="#176b5b"
                              radius={[0, 0, 0, 0]}
                              maxBarSize={32}
                              isAnimationActive={false}
                            />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                    <p className="chart-note scroll-hint">
                      Scroll sideways to view all classrooms. Exact values are in the allocation
                      table below.
                    </p>
                    {unknown > 0 && (
                      <p className="chart-note">
                        {unknown} classroom(s) with unknown baseline ACH are excluded from this
                        chart and calculation.
                      </p>
                    )}
                  </>
                ) : (
                  <Empty
                    title={
                      scenario.rooms.length
                        ? 'Recalculate your allocation'
                        : 'Add your first classroom'
                    }
                  >
                    {scenario.rooms.length
                      ? 'Review your inputs, then select Optimize Allocation to see estimated clean-air changes.'
                      : 'Open the classroom planner to add rooms, or load the demonstration scenario.'}
                  </Empty>
                )}
                <div className="panel-foot">
                  <span>
                    <span className="dash-line" />
                    Dashed line indicates your selected target
                  </span>
                  <button className="text-button" onClick={() => navigate('method')}>
                    How eACH is calculated <ArrowUpRight size={14} />
                  </button>
                </div>
              </section>
              {allocation && (
                <>
                  <div className="allocation-heading">
                    <div>
                      <h2>Classroom assignments</h2>
                      <p>
                        Equipment assigned to maximize student seats in rooms meeting the target.
                      </p>
                    </div>
                    <span className="status success">
                      <Check size={14} />
                      Calculated from your inputs
                    </span>
                  </div>
                  <section className="panel">
                    <div className="allocation-stats">
                      <div>
                        <span>Units to purchase</span>
                        <strong>
                          {allocation.units}
                          <small>purifiers</small>
                        </strong>
                      </div>
                      <div>
                        <span>Equipment cost</span>
                        <strong>{money(allocation.cost)}</strong>
                      </div>
                      <div>
                        <span>Budget remaining</span>
                        <strong>{money(allocation.remaining)}</strong>
                      </div>
                      <div>
                        <span>New rooms at target</span>
                        <strong>
                          +{allocation.newRooms}
                          <small>classrooms</small>
                        </strong>
                      </div>
                    </div>
                    {allocation.rooms.length > 0 && (
                      <AllocationTable allocation={allocation} target={scenario.equipment.target} />
                    )}
                  </section>
                  <Explanation allocation={allocation} scenario={scenario} />
                </>
              )}
              <button className="comparison-link" onClick={() => navigate('scenarios')}>
                <span>
                  <strong>Compare another budget</strong> Compare optimized and round-robin
                  allocations.
                </span>
                <ArrowRight size={18} />
              </button>
            </>
          )}

          {page === 'classrooms' && (
            <>
              <section className="info-strip">
                <p>
                  <strong>Baseline ventilation.</strong> Enter existing effective ACH from your
                  school’s facilities team or an assessment. Leave it blank if unknown; that room
                  will be excluded from numerical optimization.
                </p>
              </section>
              <section className="panel">
                <div className="panel-heading">
                  <div>
                    <h2>
                      Your classrooms <span className="count-badge">{scenario.rooms.length}</span>
                    </h2>
                    <p>Dimensions in feet. Occupancy is a planning estimate of student seats.</p>
                  </div>
                  <button
                    className="button primary"
                    onClick={() => addRoom()}
                    disabled={scenario.rooms.length >= MAX_ROOMS}
                  >
                    <Plus size={16} />
                    Add classroom
                  </button>
                </div>
                {scenario.rooms.length ? (
                  <div
                    className="table-scroll"
                    role="region"
                    aria-label="Editable classroom inputs"
                    tabIndex={0}
                  >
                    <table className="editor-table">
                      <caption className="sr-only">
                        Editable classroom measurements and baseline ventilation
                      </caption>
                      <thead>
                        <tr>
                          <th>Classroom</th>
                          <th>Length (ft)</th>
                          <th>Width (ft)</th>
                          <th>Height (ft)</th>
                          <th>Students</th>
                          <th>Baseline ACH</th>
                          <th>
                            Max units <small>optional</small>
                          </th>
                          <th>Volume (ft³)</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {scenario.rooms.map((r, index) => (
                          <tr key={r.id}>
                            <td>
                              <input
                                className="room-name"
                                aria-label={`Classroom ${index + 1} name`}
                                value={r.name}
                                maxLength={60}
                                onChange={(e) => updateRoom(r.id, 'name', e.target.value)}
                              />
                              <small className="room-id" title={r.id}>
                                ID: {r.id.slice(0, 12)}
                              </small>
                            </td>
                            {(['length', 'width', 'height', 'students'] as const).map((field) => (
                              <td key={field}>
                                <input
                                  type="number"
                                  aria-label={`${r.name} ${field}`}
                                  value={numeric(r[field])}
                                  min={field === 'students' ? 0 : 1}
                                  max={field === 'height' ? 100 : 500}
                                  step={field === 'students' ? 1 : 'any'}
                                  onChange={(e) => updateRoom(r.id, field, numberFrom(e))}
                                />
                              </td>
                            ))}
                            <td>
                              <input
                                type="number"
                                aria-label={`${r.name} baseline ACH`}
                                value={numeric(r.existingACH)}
                                min={0}
                                max={50}
                                step="any"
                                placeholder="Unknown"
                                onChange={(e) =>
                                  updateRoom(
                                    r.id,
                                    'existingACH',
                                    e.target.value === '' ? null : Number(e.target.value),
                                  )
                                }
                              />
                              {r.existingACH === null && (
                                <small className="unknown-label">Excluded until estimated</small>
                              )}
                            </td>
                            <td>
                              <input
                                type="number"
                                aria-label={`${r.name} maximum units`}
                                value={numeric(r.maxUnits)}
                                min={0}
                                max={20}
                                step={1}
                                placeholder={`Use ${numeric(scenario.equipment.maxUnits)}`}
                                onChange={(e) =>
                                  updateRoom(
                                    r.id,
                                    'maxUnits',
                                    e.target.value === '' ? null : Number(e.target.value),
                                  )
                                }
                              />
                            </td>
                            <td className="volume-cell">
                              {Number.isFinite(volume(r))
                                ? volume(r).toLocaleString()
                                : 'Unavailable'}
                            </td>
                            <td>
                              <div className="row-actions">
                                <button
                                  className="icon-button"
                                  aria-label={`Duplicate ${r.name}`}
                                  title="Duplicate classroom"
                                  onClick={() => addRoom(r)}
                                  disabled={scenario.rooms.length >= MAX_ROOMS}
                                >
                                  <Copy size={16} />
                                </button>
                                <button
                                  className="icon-button danger"
                                  aria-label={`Delete ${r.name}`}
                                  title="Delete classroom"
                                  onClick={() => {
                                    setScenario((s) => ({
                                      ...s,
                                      rooms: s.rooms.filter((room) => room.id !== r.id),
                                    }));
                                    setNotice(`${r.name || 'Classroom'} removed.`);
                                  }}
                                >
                                  <Trash2 size={16} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <Empty title="A fresh start for your school">
                    Add a classroom above, or load the demonstration below to explore a complete
                    plan.
                  </Empty>
                )}
                <div className="panel-foot">
                  <span>
                    {scenario.rooms.length} / {MAX_ROOMS} classrooms · {unknown} excluded without
                    baseline estimates
                  </span>
                  <button className="text-button" onClick={() => setConfirmReset(true)}>
                    <RotateCcw size={14} />
                    Reset to demonstration
                  </button>
                </div>
              </section>
              <div className="bottom-action">
                <p>Ready to plan? Your equipment settings apply to every classroom.</p>
                <button
                  className="button primary"
                  onClick={runOptimization}
                  disabled={!valid || busy || !scenario.rooms.length}
                >
                  {busy ? 'Calculating…' : 'Optimize Allocation'}
                  <ArrowRight size={16} />
                </button>
              </div>
            </>
          )}

          {page === 'equipment' && (
            <div className="settings-grid">
              <section className="panel">
                <div className="panel-heading">
                  <div>
                    <h2>Equipment & budget</h2>
                    <p>One configurable, generic purifier model</p>
                  </div>
                </div>
                <div className="settings-form">
                  <div className="form-grid">
                    <InputField
                      label="Equipment cost per unit (USD)"
                      hint="Purchase price only; excludes energy, filters, and maintenance."
                    >
                      <input
                        type="number"
                        min="0.01"
                        max="1000000"
                        step="0.01"
                        value={numeric(scenario.equipment.cost)}
                        onChange={(e) => updateEquipment('cost', numberFrom(e))}
                      />
                    </InputField>
                    <InputField
                      label="Particle CADR (cfm)"
                      hint="Clean air delivery rate at the intended operating speed."
                    >
                      <input
                        type="number"
                        min="1"
                        max="10000"
                        step="any"
                        value={numeric(scenario.equipment.cadr)}
                        onChange={(e) => updateEquipment('cadr', numberFrom(e))}
                      />
                    </InputField>
                    <InputField
                      label="Maximum units per classroom"
                      hint="Room-specific limits can lower this school-wide cap."
                    >
                      <input
                        type="number"
                        min="0"
                        max="20"
                        step="1"
                        value={numeric(scenario.equipment.maxUnits)}
                        onChange={(e) => updateEquipment('maxUnits', numberFrom(e))}
                      />
                    </InputField>
                    <InputField
                      label="Total equipment budget (USD)"
                      hint="Only whole units within this budget can be purchased."
                    >
                      <input
                        type="number"
                        min="0"
                        max="1000000"
                        step="0.01"
                        value={numeric(scenario.equipment.budget)}
                        onChange={(e) => updateEquipment('budget', numberFrom(e))}
                      />
                    </InputField>
                  </div>
                  <div className="target-field">
                    <InputField
                      label="Target equivalent air changes per hour (eACH)"
                      hint="Default: 5 eACH. This is a user-selected planning target, not a compliance or safety certification."
                    >
                      <input
                        type="number"
                        min="0.1"
                        max="50"
                        step="any"
                        value={numeric(scenario.equipment.target)}
                        onChange={(e) => updateEquipment('target', numberFrom(e))}
                      />
                    </InputField>
                  </div>
                  <button
                    className="button primary"
                    onClick={runOptimization}
                    disabled={!valid || busy || !scenario.rooms.length}
                  >
                    {busy ? 'Calculating…' : 'Optimize Allocation'}
                    <ArrowRight size={16} />
                  </button>
                </div>
              </section>
              <aside>
                <div className="assumption-card">
                  <h2>Example equipment</h2>
                  <p>
                    The demonstration uses a generic $300 purifier with a particle CADR of 300 cfm.
                    It does not represent a verified commercial product.
                  </p>
                  <hr />
                  <h3>Selecting a CADR estimate</h3>
                  <p>
                    Use CADR at the speed your classroom can tolerate. Placement, mixing, noise,
                    filter condition, and actual performance affect delivered clean air.
                  </p>
                  <button className="text-button" onClick={() => navigate('method')}>
                    Read the assumptions <ArrowUpRight size={14} />
                  </button>
                </div>
                <section className="panel persistence-card">
                  <h3>Save this plan on your device</h3>
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={persistence}
                      onChange={(e) => {
                        setPersistence(e.target.checked);
                        try {
                          localStorage.setItem(STORAGE_KEY + '.remember', String(e.target.checked));
                        } catch {
                          /* Storage may be disabled. */
                        }
                        if (!e.target.checked) {
                          try {
                            localStorage.removeItem(STORAGE_KEY);
                          } catch {
                            /* Storage may be disabled. */
                          }
                        }
                      }}
                    />
                    Remember inputs in this browser
                  </label>
                  <p>
                    Disable local saving on shared devices. Export JSON to keep a portable copy.
                  </p>
                </section>
              </aside>
            </div>
          )}

          {page === 'scenarios' && (
            <>
              <section className="panel budget-panel">
                <div className="panel-heading">
                  <div>
                    <h2>Compare allocations by budget</h2>
                    <p>Move the slider to calculate a new allocation for both strategies.</p>
                  </div>
                  <span className="badge">Exploration · current plan unchanged</span>
                </div>
                <div className="budget-control">
                  <div>
                    <label htmlFor="comparison-budget">Comparison budget</label>
                    <strong>{money(compareBudget)}</strong>
                  </div>
                  <input
                    id="comparison-budget"
                    type="range"
                    min={0}
                    max={sliderMax}
                    step={0.01}
                    value={compareBudget}
                    disabled={!valid}
                    onChange={(e) => setCompareBudget(Number(e.target.value))}
                  />
                  <div className="range-labels">
                    <span>$0</span>
                    <span>{money(sliderMax)}</span>
                  </div>
                  <div className="budget-actions">
                    <label>
                      Exact budget (USD)
                      <input
                        type="number"
                        aria-label="Exact comparison budget in USD"
                        min={0}
                        max={1000000}
                        step="0.01"
                        value={compareBudget}
                        onChange={(e) => {
                          const value = Number(e.target.value);
                          if (Number.isFinite(value) && value >= 0 && value <= 1000000)
                            setCompareBudget(Math.round(value * 100) / 100);
                        }}
                      />
                    </label>
                    <button
                      className="button secondary"
                      disabled={!valid}
                      onClick={() => {
                        updateEquipment('budget', compareBudget);
                        setNotice(
                          'Comparison budget applied to your plan. Optimize Allocation to update the overview.',
                        );
                      }}
                    >
                      Use this budget <ArrowRight size={15} />
                    </button>
                  </div>
                </div>
              </section>
              {compare && (
                <>
                  <div className="comparison-grid">
                    <section className="panel strategy-card optimized">
                      <div className="strategy-title">
                        <div>
                          <h2>Optimized allocation</h2>
                        </div>
                      </div>
                      <div className="big-number">
                        {compare.optimized.afterStudents}
                        <span>student seats at target</span>
                      </div>
                      <dl>
                        <div>
                          <dt>Rooms meeting target</dt>
                          <dd>
                            {compare.optimized.afterRooms} / {scenario.rooms.length}
                          </dd>
                        </div>
                        <div>
                          <dt>Units purchased</dt>
                          <dd>{compare.optimized.units}</dd>
                        </div>
                        <div>
                          <dt>Equipment cost</dt>
                          <dd>{money(compare.optimized.cost)}</dd>
                        </div>
                        <div>
                          <dt>Budget remaining</dt>
                          <dd>{money(compare.optimized.remaining)}</dd>
                        </div>
                      </dl>
                    </section>
                    <section className="panel strategy-card">
                      <div className="strategy-title">
                        <div>
                          <h2>Round-robin allocation</h2>
                        </div>
                      </div>
                      <div className="big-number">
                        {compare.naive.afterStudents}
                        <span>student seats at target</span>
                      </div>
                      <dl>
                        <div>
                          <dt>Rooms meeting target</dt>
                          <dd>
                            {compare.naive.afterRooms} / {scenario.rooms.length}
                          </dd>
                        </div>
                        <div>
                          <dt>Units purchased</dt>
                          <dd>{compare.naive.units}</dd>
                        </div>
                        <div>
                          <dt>Equipment cost</dt>
                          <dd>{money(compare.naive.cost)}</dd>
                        </div>
                        <div>
                          <dt>Budget remaining</dt>
                          <dd>{money(compare.naive.remaining)}</dd>
                        </div>
                      </dl>
                    </section>
                  </div>
                  <div className="comparison-insight">
                    <p>{comparisonDescription(compare.optimized, compare.naive, compareBudget)}</p>
                  </div>
                  <section className="panel">
                    <div className="panel-heading">
                      <div>
                        <h2>Target attainment across budgets</h2>
                        <p>Student seats in rooms meeting the target, across 21 sampled budgets</p>
                      </div>
                    </div>
                    <div
                      className="chart-wrap"
                      role="img"
                      aria-label="Sampled comparison of student seats meeting the target across budgets. Exact results for the selected budget are shown in the strategy cards above."
                    >
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart
                          data={curve}
                          margin={{ top: 15, right: 25, left: -10, bottom: 15 }}
                        >
                          <CartesianGrid vertical={false} stroke="#edf0ef" />
                          <XAxis
                            dataKey="budget"
                            type="number"
                            domain={[0, sliderMax]}
                            tickFormatter={(n) => money(Number(n))}
                            tick={{ fill: '#526460', fontSize: 12 }}
                            axisLine={false}
                            tickLine={false}
                          />
                          <YAxis
                            tick={{ fill: '#526460', fontSize: 12 }}
                            axisLine={false}
                            tickLine={false}
                          />
                          <Tooltip
                            labelFormatter={(n) => money(Number(n))}
                            contentStyle={{
                              borderRadius: 2,
                              border: '1px solid #dfe7e2',
                              fontSize: 12,
                            }}
                          />
                          <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
                          <ReferenceLine x={compareBudget} stroke="#8eaaa1" strokeDasharray="4 4" />
                          <Line
                            type="stepAfter"
                            dataKey="Optimized"
                            stroke="#218575"
                            strokeWidth={3}
                            dot={false}
                            isAnimationActive={false}
                          />
                          <Line
                            type="stepAfter"
                            dataKey="Round robin"
                            stroke="#728a82"
                            strokeWidth={2}
                            strokeDasharray="5 4"
                            dot={false}
                            isAnimationActive={false}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                    <p className="chart-note">
                      Sampled budgets show the general pattern; intervening changes may not appear.
                      The slider and cards calculate the exact selected budget.
                    </p>
                  </section>
                  <section className="panel">
                    <div className="panel-heading">
                      <div>
                        <h2>Allocation at {money(compareBudget)}</h2>
                        <p>Optimized recommendation at the comparison budget</p>
                      </div>
                    </div>
                    <AllocationTable
                      allocation={compare.optimized}
                      target={scenario.equipment.target}
                    />
                  </section>
                </>
              )}
              <section className="info-strip">
                <p>
                  <strong>Round-robin method.</strong> Round robin assigns one unit per pass in
                  classroom table order, skipping rooms with unknown baseline ACH or those already
                  at target. It stops assigning to a room at its target or limit. Both strategies
                  use identical budgets, CADR, unit cost, room limits, and formulas.
                </p>
              </section>
            </>
          )}

          {page === 'method' && (
            <div className="method-grid">
              <section className="panel method-main">
                <h2>How the estimate is calculated</h2>
                <p>
                  CleanClass estimates how portable particle filtration adds to a room’s existing
                  effective clean-air rate. It then chooses the combination of rooms that brings the
                  greatest student occupancy to your selected target.
                </p>
                <div className="formula">
                  <span>Room volume (ft³)</span>
                  <strong>length × width × ceiling height</strong>
                </div>
                <div className="formula">
                  <span>Added eACH per purifier (h⁻¹)</span>
                  <strong>CADR (ft³/min) × 60 ÷ volume (ft³)</strong>
                </div>
                <div className="formula">
                  <span>Estimated eACH after allocation</span>
                  <strong>baseline effective ACH + units × added eACH</strong>
                </div>
                <h3>What the optimizer maximizes</h3>
                <p>
                  Each classroom needs a whole number of units to reach the target. The optimizer
                  uses an exact 0/1 knapsack algorithm to select classrooms within the budget. A
                  room contributes its occupancy only when it reaches the target. Rooms already
                  meeting the target remain counted and need no equipment.
                </p>
                <p>
                  Ties favor more classrooms, then lower purchase cost, then the earlier classroom
                  order. Extra units that do not bring another classroom to the target are not
                  purchased. Lower occupancy rooms may be left below target; this is a transparent
                  planning tradeoff, not a measure of their importance.
                </p>
                <h3>A worked example</h3>
                <p>
                  A 30 × 25 × 10 ft room has a volume of 7,500 ft³. A generic 300 cfm purifier adds
                  300 × 60 ÷ 7,500 = <strong>2.4 eACH</strong>. At a baseline of 2 ACH and a target
                  of 5 eACH, one unit gives 4.4 eACH; two give 6.8 eACH. The room therefore needs
                  two units.
                </p>
                <h3>Inputs and exclusions</h3>
                <p>
                  Unknown baseline ventilation is never assumed to be zero. Those rooms remain
                  visible, but are excluded from target counts and allocation. Zero is accepted only
                  when explicitly entered. The effective room limit is the smaller of its optional
                  cap and the school-wide cap. Currency is calculated in integer cents to avoid
                  overspending.
                </p>
                <h3>What these estimates can and cannot tell you</h3>
                <p>
                  The model assumes well-mixed air, constant performance, and additive clean-air
                  delivery. Existing effective ACH should account for applicable outdoor air and
                  existing particle filtration without double counting the new equipment. CADR
                  measures particle removal; it does not establish removal of gases or all
                  pollutants.
                </p>
                <p>
                  Real performance varies with device placement, room mixing, operating speed,
                  filter condition, and maintenance. Costs cover equipment purchases only, excluding
                  electricity, replacement filters, installation, and maintenance. Student occupancy
                  counts seats in a scenario, not distinct people across a school day.
                </p>
                <h3>Scientific references</h3>
                <p>
                  <a
                    className="scientific-link"
                    href="https://www.cdc.gov/niosh/ventilation/prevention/aim-for-5.html"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    CDC / NIOSH: How Much Ventilation Is Enough?
                  </a>{' '}
                  supports the editable 5 ACH planning target, adding ventilation ACH and
                  particle-filtration eACH, and the airflow × 60 ÷ room-volume calculation. CDC
                  describes 5 ACH as a rough guide, not a guarantee of safe air.
                </p>
                <p>
                  <a
                    className="scientific-link"
                    href="https://www.epa.gov/indoor-air-quality-iaq/guide-air-cleaners-home"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    EPA: Guide to Air Cleaners in the Home
                  </a>{' '}
                  supports using particle CADR with room size and ceiling height, accounting for
                  operating speed and filter maintenance, and distinguishing particle filtration
                  from gas removal. This residential guide informs general filtration assumptions;
                  it is not a classroom design standard.
                </p>
                <p>
                  Neither agency endorses CleanClass or validates its optimizer. Well-mixed air and
                  constant device performance are simplifying model assumptions; the app does not
                  predict infections or measured health outcomes.
                </p>
                <div className="method-disclaimer">
                  <p>
                    CleanClass is a planning and educational application. It is not a sensor,
                    clinical instrument, code-compliance assessment, or guarantee of protection from
                    disease. Validate estimates and placement with qualified facilities
                    professionals.
                  </p>
                </div>
              </section>
              <aside>
                <div className="assumption-card">
                  <h2>Calculation assumptions</h2>
                  <p>
                    Every recommendation is calculated locally from your classroom inputs. No
                    external APIs, accounts, or background data collection.
                  </p>
                  <button className="button secondary" onClick={() => navigate('classrooms')}>
                    Review your classrooms <ArrowRight size={15} />
                  </button>
                </div>
                <section className="panel persistence-card">
                  <h3>About the demonstration</h3>
                  <p>
                    All demonstration classrooms, occupancies, ventilation values, and equipment
                    prices are illustrative inputs. Results are calculated by the same optimizer
                    used for your own scenarios.
                  </p>
                  <button className="text-button" onClick={() => setConfirmReset(true)}>
                    <RotateCcw size={14} />
                    Load demonstration
                  </button>
                </section>
              </aside>
            </div>
          )}
          <footer>
            <span>
              <strong>CleanClass</strong>
              <span>Classroom air planning</span>
            </span>
            <span>
              Planning estimates; performance varies in practice.
              <button onClick={() => navigate('method')}>
                Read the methodology <ArrowUpRight size={13} />
              </button>
            </span>
          </footer>
        </main>
      </div>
      {confirmReset && (
        <div
          className="modal-backdrop"
          onClick={(e) => {
            if (e.target === e.currentTarget) setConfirmReset(false);
          }}
        >
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="reset-title"
            onKeyDown={(e) => {
              if (e.key === 'Escape') setConfirmReset(false);
              if (e.key === 'Tab') {
                const buttons = e.currentTarget.querySelectorAll('button');
                if (e.shiftKey && document.activeElement === buttons[0]) {
                  e.preventDefault();
                  buttons[buttons.length - 1].focus();
                } else if (!e.shiftKey && document.activeElement === buttons[buttons.length - 1]) {
                  e.preventDefault();
                  buttons[0].focus();
                }
              }
            }}
          >
            <h2 id="reset-title">Load the demonstration scenario?</h2>
            <p>
              This replaces your current classrooms and equipment settings. Export JSON first if you
              want to keep a copy.
            </p>
            <div className="modal-actions">
              <button
                id="cancel-reset"
                className="button secondary"
                onClick={() => setConfirmReset(false)}
              >
                Keep my plan
              </button>
              <button
                className="button primary"
                onClick={() => {
                  const demo = demoScenario();
                  setScenario(demo);
                  setResult({ key: JSON.stringify(demo), allocation: optimize(demo) });
                  setCompareBudget(demo.equipment.budget);
                  setConfirmReset(false);
                  setNotice('Demonstration loaded and optimized using its example inputs.');
                }}
              >
                Load demonstration
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
