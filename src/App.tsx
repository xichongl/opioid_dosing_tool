import { useState, useMemo, useCallback } from 'react';
import {
  OpioidDrug, Route, Formulation, OpioidEntry, NewRegimen, NewRegimenEntry,
  RegimenRole, AgentResult,
  DRUG_ROUTES, FREQUENCY_PRESETS,
} from './types';
import { performConversion, getDrugWarnings } from './utils/conversions';
import './App.css';

let idCounter = 0;
const nextId = () => `entry-${++idCounter}`;

const DRUG_LABELS: Record<OpioidDrug, string> = {
  morphine: 'Morphine', hydromorphone: 'Hydromorphone (Dilaudid)',
  oxycodone: 'Oxycodone', hydrocodone: 'Hydrocodone',
  fentanyl: 'Fentanyl', codeine: 'Codeine',
  tramadol: 'Tramadol', methadone: 'Methadone',
  buprenorphine: 'Buprenorphine',
};

const ALL_DRUGS: { value: OpioidDrug; label: string }[] = Object.entries(DRUG_LABELS).map(
  ([key, label]) => ({ value: key as OpioidDrug, label })
);

const ROLE_OPTIONS: { value: RegimenRole; label: string; desc: string }[] = [
  { value: 'basal', label: 'Basal (ER/LA)', desc: 'Extended-release / long-acting background analgesia' },
  { value: 'bolus', label: 'Bolus (IR)', desc: 'Immediate-release for breakthrough or q4h scheduled' },
  { value: 'both', label: 'Both', desc: 'Single agent for all dosing' },
];

const PRESET_TEMPLATES = {
  single: [{ drug: 'morphine' as OpioidDrug, route: 'po' as Route, formulation: 'ER' as Formulation, role: 'both' as RegimenRole, allocationPct: 100 }],
  erPlusIr: [
    { drug: 'morphine' as OpioidDrug, route: 'po' as Route, formulation: 'ER' as Formulation, role: 'basal' as RegimenRole, allocationPct: 60 },
    { drug: 'morphine' as OpioidDrug, route: 'po' as Route, formulation: 'IR' as Formulation, role: 'bolus' as RegimenRole, allocationPct: 40 },
  ],
};

export default function App() {
  const [entries, setEntries] = useState<OpioidEntry[]>([makeEmptyEntry()]);
  const [newEntries, setNewEntries] = useState<NewRegimenEntry[]>([makeEmptyNewEntry()]);
  const [crossTolerance, setCrossTolerance] = useState(0.50);
  const [breakthroughPct, setBreakthroughPct] = useState(0.10);
  const [renalImpairment, setRenalImpairment] = useState(false);
  const [hepaticImpairment, setHepaticImpairment] = useState(false);

  const updateEntry = useCallback((id: string, patch: Partial<OpioidEntry>) => {
    setEntries(prev => prev.map(e => e.id === id ? { ...e, ...patch } : e));
  }, []);
  const removeEntry = useCallback((id: string) => {
    setEntries(prev => prev.length > 1 ? prev.filter(e => e.id !== id) : prev);
  }, []);
  const addEntry = useCallback(() => setEntries(prev => [...prev, makeEmptyEntry()]), []);

  const updateNewEntry = useCallback((id: string, patch: Partial<NewRegimenEntry>) => {
    setNewEntries(prev => {
      const updated = prev.map(e => e.id === id ? { ...e, ...patch } : e);
      return normalizeAllocations(updated);
    });
  }, []);
  const removeNewEntry = useCallback((id: string) => {
    setNewEntries(prev => {
      const filtered = prev.length > 1 ? prev.filter(e => e.id !== id) : prev;
      return normalizeAllocations(filtered);
    });
  }, []);
  const addNewEntry = useCallback(() => {
    setNewEntries(prev => {
      const pct = Math.floor(100 / (prev.length + 1));
      const rest = 100 - pct * prev.length;
      const withNew = [...prev.map((e, i) => ({ ...e, allocationPct: i < prev.length - 1 ? pct : rest - pct + e.allocationPct })), makeEmptyNewEntry()];
      return normalizeAllocations(withNew);
    });
  }, []);

  const applyPreset = useCallback((preset: 'single' | 'erPlusIr') => {
    const template = PRESET_TEMPLATES[preset];
    setNewEntries(template.map(t => ({
      id: nextId(),
      drug: t.drug, route: t.route, formulation: t.formulation,
      role: t.role, allocationPct: t.allocationPct,
    })));
  }, []);

  const result = useMemo(() => {
    if (entries.length === 0 || newEntries.length === 0) return null;
    const regimen: NewRegimen = { entries: newEntries, breakthroughPct };
    return performConversion(entries, regimen, crossTolerance);
  }, [entries, newEntries, crossTolerance, breakthroughPct]);

  const allWarnings = useMemo(() => {
    const ws: { drug: string; renal: string | null; hepatic: string | null }[] = [];
    for (const ne of newEntries) {
      ws.push({ drug: DRUG_LABELS[ne.drug], ...getDrugWarnings(ne.drug) });
    }
    return ws;
  }, [newEntries]);

  return (
    <div className="app">
      <header className="app-header">
        <h1><span className="header-icon">💊</span> Opioid Conversion Tool</h1>
        <p className="header-subtitle">
          Equianalgesic dosing for inpatient opioid rotation • Based on{' '}
          <a href="https://www.ncbi.nlm.nih.gov/books/NBK535402/" target="_blank" rel="noopener">StatPearls Opioid Equivalency</a>
          {' '}&amp;{' '}
          <a href="https://www.cdc.gov/mmwr/volumes/71/rr/rr7103a1.htm" target="_blank" rel="noopener">CDC 2022 Guideline</a>
        </p>
      </header>

      <div className="main-container">
        {/* LEFT COLUMN */}
        <section className="panel input-panel">
          <h2 className="panel-title">Current Opioid Regimen</h2>
          <p className="panel-desc">Enter all opioids the patient received in the past 24 hours (scheduled + PRN).</p>
          <div className="entries-list">
            {entries.map((entry, idx) => (
              <OpioidEntryRow key={entry.id} entry={entry} index={idx}
                onChange={(p) => updateEntry(entry.id, p)} onRemove={() => removeEntry(entry.id)} canRemove={entries.length > 1} />
            ))}
          </div>
          <button className="btn btn-outline btn-add" onClick={addEntry}>+ Add Another Opioid</button>

          {result && (
            <div className="ome-summary">
              <div className="ome-row"><span>Total 24h OME:</span><strong>{result.totalOME} mg</strong></div>
            </div>
          )}

          <hr className="divider" />
          <h2 className="panel-title">New Regimen (Multi-Agent)</h2>
          <p className="panel-desc">Build a combination regimen. Allocate the total daily OME across agents.</p>

          {/* Quick presets */}
          <div className="preset-buttons">
            <button className="btn btn-preset" onClick={() => applyPreset('single')}>Single Agent</button>
            <button className="btn btn-preset" onClick={() => applyPreset('erPlusIr')}>ER Basal + IR Bolus</button>
            <button className="btn btn-preset" onClick={addNewEntry}>+ Add Agent</button>
          </div>

          <div className="entries-list">
            {newEntries.map((ne, idx) => (
              <NewRegimenEntryRow key={ne.id} entry={ne} index={idx}
                totalAgents={newEntries.length}
                onChange={(p) => updateNewEntry(ne.id, p)}
                onRemove={() => removeNewEntry(ne.id)}
                canRemove={newEntries.length > 1} />
            ))}
          </div>

          {/* Allocation summary bar */}
          {newEntries.length > 1 && (
            <div className="allocation-bar">
              {newEntries.map(ne => (
                <div key={ne.id} className="allocation-segment" style={{ width: `${ne.allocationPct}%` }}
                  title={`${DRUG_LABELS[ne.drug]}: ${ne.allocationPct}%`}>
                  {ne.allocationPct}%
                </div>
              ))}
            </div>
          )}

          <hr className="divider" />
          <details className="settings-details">
            <summary>Conversion Settings</summary>
            <div className="settings-body">
              <div className="form-row">
                <label className="form-label">Cross-tolerance reduction: {(crossTolerance * 100).toFixed(0)}%</label>
                <input type="range" min="0" max="0.75" step="0.05" value={crossTolerance}
                  onChange={(e) => setCrossTolerance(parseFloat(e.target.value))} />
                <span className="range-hint">0% = same drug &nbsp;|&nbsp; 50% = standard incomplete cross-tolerance</span>
              </div>
              <div className="form-row">
                <label className="form-label">Breakthrough dose: {(breakthroughPct * 100).toFixed(0)}% of daily</label>
                <input type="range" min="0.05" max="0.25" step="0.05" value={breakthroughPct}
                  onChange={(e) => setBreakthroughPct(parseFloat(e.target.value))} />
                <span className="range-hint">Standard: 10-15% of total 24h dose q4h PRN</span>
              </div>
            </div>
          </details>

          <div className="impairment-toggles">
            <label className="toggle-label"><input type="checkbox" checked={renalImpairment} onChange={(e) => setRenalImpairment(e.target.checked)} /> Renal Impairment</label>
            <label className="toggle-label"><input type="checkbox" checked={hepaticImpairment} onChange={(e) => setHepaticImpairment(e.target.checked)} /> Hepatic Impairment</label>
          </div>
        </section>

        {/* RIGHT COLUMN */}
        <section className="panel results-panel">
          <h2 className="panel-title">Conversion Results</h2>
          {!result ? (
            <div className="placeholder-text">Enter current regimen and build a new multi-agent regimen to see calculated doses.</div>
          ) : (
            <ResultsView result={result} renalImpairment={renalImpairment} hepaticImpairment={hepaticImpairment} allWarnings={allWarnings} />
          )}
        </section>
      </div>

      <footer className="app-footer">
        <p><strong>Disclaimer:</strong> This tool provides estimates based on published equianalgesic tables. Individual patient factors significantly affect dosing. Always use clinical judgment.</p>
      </footer>
    </div>
  );
}

// ====================================================================
// RESULTS VIEW
// ====================================================================
function ResultsView({ result, renalImpairment, hepaticImpairment, allWarnings }: {
  result: import('./types').ConversionResult;
  renalImpairment: boolean; hepaticImpairment: boolean;
  allWarnings: { drug: string; renal: string | null; hepatic: string | null }[];
}) {
  return (
    <div className="results-content">
      {/* Per-agent results */}
      {result.agents.map((agent, i) => (
        <AgentResultCard key={i} agent={agent} index={i} totalAgents={result.agents.length} />
      ))}

      {/* Breakthrough */}
      <div className="result-card">
        <div className="result-card-header">
          Breakthrough (PRN) Dosing
          <span className="badge">{Math.round(result.breakthroughDosePercent)}% of daily</span>
        </div>
        <div className="result-card-body">
          <div className="dose-line"><span className="dose-value">{result.breakthroughDoseMg}</span><span className="dose-unit">{result.breakthroughUnit}</span></div>
          <div className="dose-freq">{result.breakthroughFrequency}</div>
        </div>
      </div>

      {/* PCA */}
      {result.pca && result.pca.enabled && (
        <div className="result-card result-card-pca">
          <div className="result-card-header">PCA Settings</div>
          <div className="result-card-body">
            <div className="pca-grid">
              <div className="pca-item"><span className="pca-label">Basal Rate</span><span className="pca-value">{result.pca.basalRate} mg/hr</span></div>
              <div className="pca-item"><span className="pca-label">Bolus Dose</span><span className="pca-value">{result.pca.bolusDose} mg</span></div>
              <div className="pca-item"><span className="pca-label">Lockout</span><span className="pca-value">{result.pca.lockoutMinutes} min</span></div>
              <div className="pca-item"><span className="pca-label">1-Hr Limit</span><span className="pca-value">{result.pca.oneHourLimit} mg</span></div>
              <div className="pca-item"><span className="pca-label">4-Hr Limit</span><span className="pca-value">{result.pca.fourHourLimit} mg</span></div>
            </div>
          </div>
        </div>
      )}

      {/* Conversion flow */}
      <div className="result-card result-card-ome">
        <div className="result-card-body">
          <div className="conversion-summary">
            <div className="conv-step"><span className="conv-num">{result.current24hDose} mg</span><span className="conv-label">Current 24h dose</span></div>
            <span className="conv-arrow">→</span>
            <div className="conv-step"><span className="conv-num">{result.totalOME} mg</span><span className="conv-label">OME</span></div>
            <span className="conv-arrow">→</span>
            <div className="conv-step">
              <span className="conv-num">{result.agents.length} agent{result.agents.length > 1 ? 's' : ''}</span>
              <span className="conv-label">New regimen</span>
            </div>
          </div>
        </div>
      </div>

      {/* Warnings */}
      {(result.warnings.length > 0 || renalImpairment || hepaticImpairment) && (
        <div className="warnings-panel">
          <h3 className="warnings-title">⚠ Clinical Considerations</h3>
          <ul className="warnings-list">
            {result.warnings.map((w, i) => <li key={`c-${i}`} className="warning-item">{w}</li>)}
            {allWarnings.map((aw, i) => (
              <>
                {renalImpairment && aw.renal && <li key={`r-${i}`} className="warning-item warning-renal">{aw.drug}: {aw.renal}</li>}
                {hepaticImpairment && aw.hepatic && <li key={`h-${i}`} className="warning-item warning-hepatic">{aw.drug}: {aw.hepatic}</li>}
              </>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// ====================================================================
// AGENT RESULT CARD
// ====================================================================
function AgentResultCard({ agent, index, totalAgents }: { agent: AgentResult; index: number; totalAgents: number }) {
  const roleBadge = agent.role === 'basal' ? 'Basal (ER)' : agent.role === 'bolus' ? 'Bolus (IR)' : 'Both';
  const roleClass = agent.role === 'basal' ? 'badge-basal' : agent.role === 'bolus' ? 'badge-bolus' : 'badge-both';
  const ctNote = agent.crossToleranceReduction > 0
    ? ` (${Math.round(agent.crossToleranceReduction * 100)}% cross-tolerance reduction)`
    : '';

  return (
    <div className="result-card agent-result-card">
      <div className="result-card-header">
        {totalAgents > 1 ? `Agent ${index + 1}: ${DRUG_LABELS[agent.drug]}` : DRUG_LABELS[agent.drug]}
        <span className={`badge ${roleClass}`}>{roleBadge}</span>
        <span className="badge">{agent.allocationPct}% OME</span>
      </div>
      <div className="result-card-body">
        <div className="agent-dose-main">
          <span className="result-number">{agent.final24hDose}</span>
          <span className="result-unit">{agent.doseUnit}</span>
          <span className="result-label">per 24 hours</span>
        </div>
        <div className="dose-detail">
          <div className="dose-line">
            <span className="dose-value-sm">{agent.scheduledDoseMg}</span>
            <span className="dose-unit-sm">{agent.scheduledUnit}</span>
          </div>
          <div className="dose-freq">{agent.scheduledFrequency}</div>
        </div>
        {ctNote && <div className="result-note">Raw: {agent.rawEquianalgesicDose} {agent.doseUnit}{ctNote}</div>}
      </div>
    </div>
  );
}

// ====================================================================
// NEW REGIMEN ENTRY ROW
// ====================================================================
function NewRegimenEntryRow({ entry, index, totalAgents, onChange, onRemove, canRemove }: {
  entry: NewRegimenEntry; index: number; totalAgents: number;
  onChange: (patch: Partial<NewRegimenEntry>) => void; onRemove: () => void; canRemove: boolean;
}) {
  const routes = DRUG_ROUTES[entry.drug] || [];
  const formulations = routes.find(r => r.route === entry.route)?.formulations || [];
  const showPCA = (entry.drug === 'morphine' || entry.drug === 'hydromorphone' || entry.drug === 'fentanyl') && !routes.find(r => r.route === 'pca');

  return (
    <div className="entry-card new-regimen-entry">
      <div className="entry-header">
        <span className="entry-number">Agent #{index + 1}</span>
        {canRemove && <button className="btn-remove" onClick={onRemove} title="Remove">✕</button>}
      </div>
      <div className="entry-body">
        <div className="form-row">
          <label>Drug</label>
          <select value={entry.drug} onChange={(e) => {
            const d = e.target.value as OpioidDrug;
            const r = DRUG_ROUTES[d];
            onChange({ drug: d, route: r[0].route, formulation: r[0].formulations[0].value });
          }}>{ALL_DRUGS.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}</select>
        </div>
        <div className="form-row">
          <label>Route</label>
          <select value={entry.route} onChange={(e) => {
            const r = e.target.value as Route;
            const f = DRUG_ROUTES[entry.drug].find(x => x.route === r)?.formulations[0]?.value || 'IR';
            onChange({ route: r, formulation: f });
          }}>
            {routes.map(r => <option key={r.route} value={r.route}>{r.label}</option>)}
            {showPCA && <option value="pca">PCA</option>}
          </select>
        </div>
        <div className="form-row">
          <label>Role</label>
          <select value={entry.role} onChange={(e) => onChange({ role: e.target.value as RegimenRole })}>
            {ROLE_OPTIONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
        </div>
        {(entry.role !== 'both' && formulations.length > 0 && entry.route !== 'pca') && (
          <div className="form-row">
            <label>Formulation</label>
            <select value={entry.formulation} onChange={(e) => onChange({ formulation: e.target.value as Formulation })}>
              {formulations.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
            </select>
          </div>
        )}
        <div className="form-row">
          <label>OME Allocation: {entry.allocationPct}%</label>
          <input type="range" min="1" max="99" value={entry.allocationPct}
            onChange={(e) => onChange({ allocationPct: parseInt(e.target.value) })} />
        </div>
      </div>
    </div>
  );
}

// ====================================================================
// CURRENT OPIOID ENTRY ROW (unchanged from original)
// ====================================================================
function OpioidEntryRow({ entry, index, onChange, onRemove, canRemove }: {
  entry: OpioidEntry; index: number;
  onChange: (patch: Partial<OpioidEntry>) => void; onRemove: () => void; canRemove: boolean;
}) {
  const routes = DRUG_ROUTES[entry.drug] || [];
  const formulations = routes.find(r => r.route === entry.route)?.formulations || [];
  const isTransdermal = entry.route === 'transdermal';
  const isContinuous = entry.frequency === 'continuous';

  return (
    <div className="entry-card">
      <div className="entry-header">
        <span className="entry-number">#{index + 1}</span>
        {canRemove && <button className="btn-remove" onClick={onRemove} title="Remove">✕</button>}
      </div>
      <div className="entry-body">
        <div className="form-row">
          <label>Drug</label>
          <select value={entry.drug} onChange={(e) => {
            const d = e.target.value as OpioidDrug;
            const r = DRUG_ROUTES[d];
            onChange({ drug: d, route: r[0].route, formulation: r[0].formulations[0].value });
          }}>{ALL_DRUGS.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}</select>
        </div>
        <div className="form-row">
          <label>Route</label>
          <select value={entry.route} onChange={(e) => {
            const r = e.target.value as Route;
            const f = DRUG_ROUTES[entry.drug].find(x => x.route === r)?.formulations[0]?.value || 'IR';
            onChange({ route: r, formulation: f });
          }}>{routes.map(r => <option key={r.route} value={r.route}>{r.label}</option>)}</select>
        </div>
        {formulations.length > 0 && (
          <div className="form-row">
            <label>Formulation</label>
            <select value={entry.formulation} onChange={(e) => onChange({ formulation: e.target.value as Formulation })}>
              {formulations.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
            </select>
          </div>
        )}
        <div className="form-row">
          <label>Dose</label>
          <div className="dose-input-group">
            <input type="number" className="dose-input" value={entry.dose || ''}
              onChange={(e) => onChange({ dose: parseFloat(e.target.value) || 0 })} min="0"
              step={isTransdermal ? '12' : '0.1'} placeholder={isTransdermal ? 'mcg/hr' : 'mg'} />
            <span className="dose-unit-label">{isTransdermal ? 'mcg/hr' : entry.doseUnit === 'mcg' ? 'mcg' : 'mg'}</span>
          </div>
        </div>
        {!isContinuous && (
          <div className="form-row">
            <label>Frequency</label>
            <select value={entry.frequency} onChange={(e) => {
              const p = FREQUENCY_PRESETS.find(f => f.value === e.target.value);
              onChange({ frequency: e.target.value, dosesPerDay: p?.dosesPerDay || 1 });
            }}>{FREQUENCY_PRESETS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}</select>
          </div>
        )}
        {isContinuous && (
          <div className="form-row"><label>Duration</label><span className="static-value">Continuous (24 hours)</span></div>
        )}
      </div>
    </div>
  );
}

// ====================================================================
// HELPERS
// ====================================================================
function normalizeAllocations(newEntries: NewRegimenEntry[]): NewRegimenEntry[] {
  if (newEntries.length === 0) return newEntries;
  const total = newEntries.reduce((s, e) => s + e.allocationPct, 0);
  if (total === 100) return newEntries;
  // Distribute remaining % proportionally, round to integers
  const entries = newEntries.map(e => ({ ...e }));
  const diff = 100 - total;
  // Add diff to the last entry to make sum = 100
  entries[entries.length - 1].allocationPct += diff;
  // Clamp
  for (const e of entries) {
    if (e.allocationPct < 1) e.allocationPct = 1;
    if (e.allocationPct > 99) e.allocationPct = 99;
  }
  return entries;
}

function makeEmptyEntry(): OpioidEntry {
  return { id: nextId(), drug: 'morphine', route: 'po', formulation: 'IR', dose: 0, doseUnit: 'mg', frequency: 'q4h', dosesPerDay: 6 };
}

function makeEmptyNewEntry(): NewRegimenEntry {
  return { id: nextId(), drug: 'morphine', route: 'po', formulation: 'ER', role: 'both', allocationPct: 100 };
}
