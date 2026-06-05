import { useState, useMemo, useCallback } from 'react';
import {
  OpioidDrug, Route, Formulation, OpioidEntry, NewRegimen,
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

export default function App() {
  const [entries, setEntries] = useState<OpioidEntry[]>([makeEmptyEntry()]);
  const [newDrug, setNewDrug] = useState<OpioidDrug>('morphine');
  const [newRoute, setNewRoute] = useState<Route>('po');
  const [newFormulation, setNewFormulation] = useState<Formulation>('IR');
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

  const handleNewDrugChange = useCallback((drug: OpioidDrug) => {
    setNewDrug(drug);
    const routes = DRUG_ROUTES[drug];
    if (routes.length > 0) { setNewRoute(routes[0].route); setNewFormulation(routes[0].formulations[0].value); }
  }, []);
  const handleNewRouteChange = useCallback((route: Route) => {
    setNewRoute(route);
    const info = DRUG_ROUTES[newDrug].find(r => r.route === route);
    if (info && info.formulations.length > 0) setNewFormulation(info.formulations[0].value);
  }, [newDrug]);

  const result = useMemo(() => {
    if (entries.length === 0) return null;
    return performConversion(entries, { drug: newDrug, route: newRoute, formulation: newFormulation }, crossTolerance, breakthroughPct);
  }, [entries, newDrug, newRoute, newFormulation, crossTolerance, breakthroughPct]);

  const drugWarnings = useMemo(() => getDrugWarnings(newDrug), [newDrug]);
  const availableRoutes = DRUG_ROUTES[newDrug] || [];
  const availableFormulations = availableRoutes.find(r => r.route === newRoute)?.formulations || [];
  const showPCA = (newDrug === 'morphine' || newDrug === 'hydromorphone' || newDrug === 'fentanyl') && !availableRoutes.find(r => r.route === 'pca');

  return (
    <div className="app">
      <header className="app-header">
        <h1><span className="header-icon">💊</span> Opioid Conversion Tool</h1>
        <p className="header-subtitle">
          Equianalgesic dosing for inpatient opioid rotation • Based on{' '}
          <a href="https://www.ncbi.nlm.nih.gov/books/NBK535402/" target="_blank" rel="noopener">StatPearls Opioid Equivalency</a>
        </p>
      </header>

      <div className="main-container">
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
          <h2 className="panel-title">Select New Regimen</h2>

          <div className="form-row">
            <label className="form-label">New Opioid</label>
            <select className="form-select" value={newDrug} onChange={(e) => handleNewDrugChange(e.target.value as OpioidDrug)}>
              {ALL_DRUGS.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
            </select>
          </div>
          <div className="form-row">
            <label className="form-label">Route</label>
            <select className="form-select" value={newRoute} onChange={(e) => handleNewRouteChange(e.target.value as Route)}>
              {availableRoutes.map(r => <option key={r.route} value={r.route}>{r.label}</option>)}
              {showPCA && <option value="pca">PCA (Patient-Controlled Analgesia)</option>}
            </select>
          </div>
          {availableFormulations.length > 0 && newRoute !== 'pca' && (
            <div className="form-row">
              <label className="form-label">Formulation</label>
              <select className="form-select" value={newFormulation} onChange={(e) => setNewFormulation(e.target.value as Formulation)}>
                {availableFormulations.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
              </select>
            </div>
          )}

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

        <section className="panel results-panel">
          <h2 className="panel-title">Conversion Results</h2>
          {!result ? (
            <div className="placeholder-text">Enter current regimen and select new regimen to see calculated doses.</div>
          ) : (
            <ResultsView result={result} renalImpairment={renalImpairment} hepaticImpairment={hepaticImpairment} drugWarnings={drugWarnings} />
          )}
        </section>
      </div>

      <footer className="app-footer">
        <p><strong>Disclaimer:</strong> This tool provides estimates based on published equianalgesic tables. Individual patient factors significantly affect dosing. Always use clinical judgment.</p>
      </footer>
    </div>
  );
}

function ResultsView({ result, renalImpairment, hepaticImpairment, drugWarnings }: {
  result: import('./types').ConversionResult;
  renalImpairment: boolean;
  hepaticImpairment: boolean;
  drugWarnings: { renal: string | null; hepatic: string | null };
}) {
  return (
    <div className="results-content">
      <div className="result-card result-card-primary">
        <div className="result-card-header">Recommended New Regimen</div>
        <div className="result-card-body">
          <div className="result-main-dose">
            <span className="result-number">{result.final24hDose}</span>
            <span className="result-unit">{result.final24hDoseUnit}</span>
            <span className="result-label">per 24 hours</span>
          </div>
          {result.crossToleranceReduction > 0 && (
            <div className="result-note">Includes {Math.round(result.crossToleranceReduction * 100)}% cross-tolerance reduction (raw: {result.rawEquianalgesicDose} {result.final24hDoseUnit})</div>
          )}
        </div>
      </div>

      <div className="result-card">
        <div className="result-card-header">Scheduled Dosing</div>
        <div className="result-card-body">
          <div className="dose-line"><span className="dose-value">{result.scheduledDoseMg}</span><span className="dose-unit">{result.scheduledUnit}</span></div>
          <div className="dose-freq">{result.scheduledFrequency}</div>
        </div>
      </div>

      <div className="result-card">
        <div className="result-card-header">Breakthrough (PRN) Dosing <span className="badge">{Math.round(result.breakthroughDosePercent)}% of daily</span></div>
        <div className="result-card-body">
          <div className="dose-line"><span className="dose-value">{result.breakthroughDoseMg}</span><span className="dose-unit">{result.breakthroughUnit}</span></div>
          <div className="dose-freq">{result.breakthroughFrequency}</div>
        </div>
      </div>

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

      <div className="result-card result-card-ome">
        <div className="result-card-body">
          <div className="conversion-summary">
            <div className="conv-step"><span className="conv-num">{result.current24hDose} mg</span><span className="conv-label">Current 24h dose</span></div>
            <span className="conv-arrow">→</span>
            <div className="conv-step"><span className="conv-num">{result.totalOME} mg</span><span className="conv-label">OME</span></div>
            <span className="conv-arrow">→</span>
            <div className="conv-step"><span className="conv-num">{result.rawEquianalgesicDose} {result.final24hDoseUnit}</span><span className="conv-label">Equianalgesic</span></div>
            {result.crossToleranceReduction > 0 && (
              <><span className="conv-arrow">→</span>
                <div className="conv-step"><span className="conv-num">{result.final24hDose} {result.final24hDoseUnit}</span><span className="conv-label">After {Math.round(result.crossToleranceReduction * 100)}% ↓</span></div></>
            )}
          </div>
        </div>
      </div>

      {(result.warnings.length > 0 || (renalImpairment && drugWarnings.renal) || (hepaticImpairment && drugWarnings.hepatic)) && (
        <div className="warnings-panel">
          <h3 className="warnings-title">⚠ Clinical Considerations</h3>
          <ul className="warnings-list">
            {result.warnings.map((w, i) => <li key={`c-${i}`} className="warning-item">{w}</li>)}
            {renalImpairment && drugWarnings.renal && <li key="renal" className="warning-item warning-renal">{drugWarnings.renal}</li>}
            {hepaticImpairment && drugWarnings.hepatic && <li key="hepatic" className="warning-item warning-hepatic">{drugWarnings.hepatic}</li>}
          </ul>
        </div>
      )}
    </div>
  );
}

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

function makeEmptyEntry(): OpioidEntry {
  return { id: nextId(), drug: 'morphine', route: 'po', formulation: 'IR', dose: 0, doseUnit: 'mg', frequency: 'q4h', dosesPerDay: 6 };
}
