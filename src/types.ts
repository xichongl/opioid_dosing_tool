// ---- Opioid drug identifiers ----
export type OpioidDrug =
  | 'morphine'
  | 'hydromorphone'
  | 'oxycodone'
  | 'hydrocodone'
  | 'fentanyl'
  | 'codeine'
  | 'tramadol'
  | 'methadone'
  | 'buprenorphine';

export type Route =
  | 'po'      // oral
  | 'iv'      // intravenous
  | 'sc'      // subcutaneous
  | 'transdermal' // patch
  | 'sl'      // sublingual / buccal
  | 'pca';    // PCA (IV)

export type Formulation = 'IR' | 'ER' | 'continuous' | 'patch' | 'pca';

// ---- A single opioid entry in the current regimen ----
export interface OpioidEntry {
  id: string;
  drug: OpioidDrug;
  route: Route;
  formulation: Formulation;
  dose: number;          // in mg (or mcg/hr for transdermal fentanyl)
  doseUnit: 'mg' | 'mcg' | 'mcg/hr';
  frequency: string;     // e.g. 'q4h', 'q6h', 'q8h', 'q12h', 'continuous', 'once'
  dosesPerDay: number;   // calculated: how many doses in 24h
}

// ---- PCA Configuration ----
export interface PCAConfig {
  enabled: boolean;
  basalRate: number;       // mg/hr
  bolusDose: number;       // mg per demand dose
  lockoutMinutes: number;  // lockout interval in minutes
  oneHourLimit: number;    // 1-hour safety limit (mg)
  fourHourLimit: number;   // 4-hour safety limit (mg)
}

// ---- New regimen entry (one agent in a multi-agent regimen) ----
export type RegimenRole = 'basal' | 'bolus' | 'both';

export interface NewRegimenEntry {
  id: string;
  drug: OpioidDrug;
  route: Route;
  formulation: Formulation;
  role: RegimenRole;        // basal (ER/long-acting), bolus (IR), or both
  allocationPct: number;    // % of total daily OME allocated to this agent (0-100)
}

// ---- New regimen (array of agents) ----
export interface NewRegimen {
  entries: NewRegimenEntry[];
  breakthroughPct: number;  // % of daily dose reserved for breakthrough
}

// ---- Renal/Hepatic impairment flags ----
export interface ImpairmentFlags {
  renal: boolean;
  hepatic: boolean;
}

// ---- Per-agent result in the conversion ----
export interface AgentResult {
  drug: OpioidDrug;
  route: Route;
  formulation: Formulation;
  role: RegimenRole;
  allocationPct: number;
  rawEquianalgesicDose: number;
  crossToleranceReduction: number;
  final24hDose: number;
  doseUnit: string;
  scheduledDoseMg: number;
  scheduledFrequency: string;
  scheduledUnit: string;
  pca: PCAConfig | null;
}

// ---- Conversion result ----
export interface ConversionResult {
  // Current totals
  current24hDose: number;
  totalOME: number;

  // Per-agent results
  agents: AgentResult[];

  // Overall breakthrough dosing (from IR/bolus agent)
  breakthroughDoseMg: number;
  breakthroughDosePercent: number;
  breakthroughFrequency: string;
  breakthroughUnit: string;

  // Aggregate PCA (if any agent uses PCA)
  pca: PCAConfig | null;

  // Warnings
  warnings: string[];
}

// ---- Available routes for each drug ----
export const DRUG_ROUTES: Record<OpioidDrug, { route: Route; label: string; formulations: { value: Formulation; label: string }[] }[]> = {
  morphine: [
    { route: 'po', label: 'PO (Oral)', formulations: [
      { value: 'IR', label: 'Immediate Release (IR)' },
      { value: 'ER', label: 'Extended Release (ER)' },
    ]},
    { route: 'iv', label: 'IV', formulations: [
      { value: 'IR', label: 'IV Push / Infusion' },
      { value: 'continuous', label: 'Continuous Infusion' },
      { value: 'pca', label: 'PCA' },
    ]},
    { route: 'sc', label: 'SC (Subcutaneous)', formulations: [
      { value: 'IR', label: 'Intermittent SC' },
      { value: 'continuous', label: 'Continuous SC Infusion' },
    ]},
  ],
  hydromorphone: [
    { route: 'po', label: 'PO (Oral)', formulations: [
      { value: 'IR', label: 'Immediate Release (IR)' },
      { value: 'ER', label: 'Extended Release (ER)' },
    ]},
    { route: 'iv', label: 'IV', formulations: [
      { value: 'IR', label: 'IV Push / Infusion' },
      { value: 'continuous', label: 'Continuous Infusion' },
      { value: 'pca', label: 'PCA' },
    ]},
    { route: 'sc', label: 'SC (Subcutaneous)', formulations: [
      { value: 'IR', label: 'Intermittent SC' },
      { value: 'continuous', label: 'Continuous SC Infusion' },
    ]},
  ],
  oxycodone: [
    { route: 'po', label: 'PO (Oral)', formulations: [
      { value: 'IR', label: 'Immediate Release (IR)' },
      { value: 'ER', label: 'Extended Release (ER)' },
    ]},
  ],
  hydrocodone: [
    { route: 'po', label: 'PO (Oral)', formulations: [
      { value: 'IR', label: 'Immediate Release (IR)' },
      { value: 'ER', label: 'Extended Release (ER)' },
    ]},
  ],
  fentanyl: [
    { route: 'iv', label: 'IV', formulations: [
      { value: 'IR', label: 'IV Push / Infusion' },
      { value: 'continuous', label: 'Continuous Infusion' },
      { value: 'pca', label: 'PCA' },
    ]},
    { route: 'transdermal', label: 'Transdermal Patch', formulations: [
      { value: 'patch', label: 'Patch (mcg/hr)' },
    ]},
  ],
  codeine: [
    { route: 'po', label: 'PO (Oral)', formulations: [
      { value: 'IR', label: 'Immediate Release' },
    ]},
  ],
  tramadol: [
    { route: 'po', label: 'PO (Oral)', formulations: [
      { value: 'IR', label: 'Immediate Release (IR)' },
      { value: 'ER', label: 'Extended Release (ER)' },
    ]},
  ],
  methadone: [
    { route: 'po', label: 'PO (Oral)', formulations: [
      { value: 'IR', label: 'Oral' },
    ]},
    { route: 'iv', label: 'IV', formulations: [
      { value: 'IR', label: 'IV' },
    ]},
  ],
  buprenorphine: [
    { route: 'sl', label: 'SL / Buccal', formulations: [
      { value: 'IR', label: 'Sublingual / Buccal' },
    ]},
    { route: 'transdermal', label: 'Transdermal Patch', formulations: [
      { value: 'patch', label: 'Patch (mcg/hr)' },
    ]},
  ],
};

// Frequency presets
export const FREQUENCY_PRESETS: { value: string; label: string; dosesPerDay: number }[] = [
  { value: 'q1h', label: 'Every 1 hour (q1h)', dosesPerDay: 24 },
  { value: 'q2h', label: 'Every 2 hours (q2h)', dosesPerDay: 12 },
  { value: 'q3h', label: 'Every 3 hours (q3h)', dosesPerDay: 8 },
  { value: 'q4h', label: 'Every 4 hours (q4h)', dosesPerDay: 6 },
  { value: 'q6h', label: 'Every 6 hours (q6h)', dosesPerDay: 4 },
  { value: 'q8h', label: 'Every 8 hours (q8h)', dosesPerDay: 3 },
  { value: 'q12h', label: 'Every 12 hours (q12h)', dosesPerDay: 2 },
  { value: 'daily', label: 'Once daily', dosesPerDay: 1 },
  { value: 'continuous', label: 'Continuous (mg/hr × 24h)', dosesPerDay: 1 },
  { value: 'once', label: 'One-time dose', dosesPerDay: 1 },
];
