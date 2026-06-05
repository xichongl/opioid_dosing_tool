import { OpioidDrug, Route, OpioidEntry, NewRegimen, ConversionResult, PCAConfig } from '../types';

// ====================================================================
// EQUIANALGESIC CONVERSION TABLE
// Primary Reference: CDC Clinical Practice Guideline for Prescribing
// Opioids for Pain — United States, 2022 (MMWR Recomm Rep 2022;71[RR-3])
//   Oral MME factors (Box 4): https://www.cdc.gov/mmwr/volumes/71/rr/rr7103a1.htm
// Secondary Reference: StatPearls Opioid Equivalency (NCBI NBK535402)
//   Parenteral & route-specific factors
// Additional: McPherson ML. Demystifying Opioid Conversion Calculations. 2010.
//   (referenced by MDCalc Opiate Conversion Calculator)
//
// Reference: Oral morphine 30 mg = 30 OME (Oral Morphine Equivalents)
// CDC: Multiply dose by conversion factor to get MME.
//   e.g., hydromorphone 4mg PO × 5.0 = 20 MME
// StatPearls equianalgesic unit approach:
//   OME = totalDailyDose × (30 / equianalgesicUnits)
// Both methods are equivalent — this code uses equianalgesic units.
//
// NOTE: CDC conversions are for ORAL opioids only.
// Parenteral factors are from StatPearls and McPherson.
// ====================================================================

interface DrugConversion {
  equianalgesicUnits: number; // mg equivalent to 30mg PO morphine (30 OME)
  unit: string;
}

// For methadone: conversion ratio changes based on total daily OME
interface MethadoneRatio {
  maxOME: number;
  ratio: number; // OME : methadone ratio (e.g., 4 means 4mg OME = 1mg methadone)
}

// Main equianalgesic table (StatPearls / standard references)
const EQUIANALGESIC: Record<string, Record<string, DrugConversion>> = {
  morphine: {
    po: { equianalgesicUnits: 30, unit: 'mg' },
    iv: { equianalgesicUnits: 10, unit: 'mg' },
    sc: { equianalgesicUnits: 10, unit: 'mg' },
    pca: { equianalgesicUnits: 10, unit: 'mg' },
  },
  // CDC 2022 Guideline: hydromorphone PO multiplier = 5.0 (30 OME / 5.0 = 6.0 equianalgesic units)
  // Note: Some sources (StatPearls) use 7.5mg = 30 OME (multiplier 4.0).
  // The CDC 2022 Clinical Practice Guideline is used here as the authoritative reference.
  hydromorphone: {
    po: { equianalgesicUnits: 6.0, unit: 'mg' },  // 30/5.0 = 6.0 per CDC 2022
    iv: { equianalgesicUnits: 1.5, unit: 'mg' },
    sc: { equianalgesicUnits: 1.5, unit: 'mg' },
    pca: { equianalgesicUnits: 1.5, unit: 'mg' },
  },
  oxycodone: {
    po: { equianalgesicUnits: 20, unit: 'mg' },
  },
  hydrocodone: {
    po: { equianalgesicUnits: 30, unit: 'mg' },
  },
  fentanyl: {
    iv: { equianalgesicUnits: 0.1, unit: 'mg' },
    pca: { equianalgesicUnits: 0.1, unit: 'mg' },
    // Transdermal handled separately: 25 mcg/hr patch ≈ 60 mg OME/day
    transdermal: { equianalgesicUnits: -1, unit: 'mcg/hr' },
  },
  codeine: {
    po: { equianalgesicUnits: 200, unit: 'mg' },
  },
  tramadol: {
    po: { equianalgesicUnits: 150, unit: 'mg' },
  },
  methadone: {
    po: { equianalgesicUnits: -1, unit: 'mg' }, // ratio-based
    iv: { equianalgesicUnits: -1, unit: 'mg' }, // ratio-based
  },
  buprenorphine: {
    sl: { equianalgesicUnits: 0.4, unit: 'mg' }, // 0.4mg SL ≈ 10mg IV morphine ≈ 30mg OME
    transdermal: { equianalgesicUnits: -1, unit: 'mcg/hr' },
  },
};

// Methadone conversion ratios by total daily OME (conservative)
const METHADONE_RATIOS: MethadoneRatio[] = [
  { maxOME: 100, ratio: 4 },
  { maxOME: 300, ratio: 8 },
  { maxOME: 500, ratio: 12 },
  { maxOME: 1000, ratio: 15 },
  { maxOME: Infinity, ratio: 20 },
];

// Buprenorphine transdermal: mcg/hr → OME/day
const BUPRENORPHINE_TD_MCGHR_TO_OME: Record<number, number> = {
  5: 12,
  10: 24,
  15: 36,
  20: 48,
  35: 84,
  52_5: 126,
  70: 168,
};

// Fentanyl transdermal: mcg/hr → OME/day (conservative: 1 mcg/hr ≈ 2.4 mg OME/day)
const FENTANYL_PATCH_MCGHR_TO_OME_FACTOR = 2.4;

// Available fentanyl patch sizes (mcg/hr)
const FENTANYL_PATCH_SIZES = [12, 25, 50, 75, 100];

// Available buprenorphine patch sizes (mcg/hr)
const BUPRENORPHINE_PATCH_SIZES = [5, 10, 15, 20];

// ====================================================================
// HELPER: Get equianalgesic units for a drug/route pair
// ====================================================================
function getEquianalgesicUnits(drug: OpioidDrug, route: Route): number {
  const drugData = EQUIANALGESIC[drug];
  if (!drugData) throw new Error(`Unknown drug: ${drug}`);
  const routeData = drugData[route];
  if (!routeData) throw new Error(`Unknown route ${route} for ${drug}`);
  return routeData.equianalgesicUnits;
}

// ====================================================================
// CALCULATE total 24h dose and OME for each entry
// ====================================================================
export function calculateEntryOME(entry: OpioidEntry): { totalDailyDose: number; ome: number } {
  const { drug, route, dose, dosesPerDay, doseUnit, frequency } = entry;

  // For continuous infusions, dose is in mg/hr; multiply by 24 for daily total
  const isContinuousInfusion = frequency === 'continuous';
  const effectiveDosesPerDay = isContinuousInfusion ? 24 : dosesPerDay;

  // Special handling for transdermal fentanyl
  if (drug === 'fentanyl' && route === 'transdermal') {
    // dose is in mcg/hr
    const totalOME = dose * FENTANYL_PATCH_MCGHR_TO_OME_FACTOR;
    return { totalDailyDose: dose, ome: totalOME };
  }

  // Special handling for transdermal buprenorphine
  if (drug === 'buprenorphine' && route === 'transdermal') {
    const ome = BUPRENORPHINE_TD_MCGHR_TO_OME[dose] || dose * 2.4;
    return { totalDailyDose: dose, ome };
  }

  // Special handling for methadone
  if (drug === 'methadone') {
    // Can't calculate OME without knowing total OME, which depends on methadone dose
    // Use a rough initial estimate: assume mid-range ratio 8:1
    const doseInMg = doseUnit === 'mcg' ? dose / 1000 : dose;
    const totalDailyDose = doseInMg * effectiveDosesPerDay;
    const estimatedOME = totalDailyDose * 8; // rough estimate
    return { totalDailyDose, ome: estimatedOME };
  }

  // Standard conversion
  const units = getEquianalgesicUnits(drug, route);
  if (units <= 0) throw new Error(`Invalid equianalgesic units for ${drug} ${route}`);

  const doseInMg = doseUnit === 'mcg' ? dose / 1000 : dose;
  const totalDailyDose = doseInMg * effectiveDosesPerDay;

  // Formula: OME = totalDailyDose * (30 / equianalgesicUnits)
  const ome = totalDailyDose * (30 / units);

  return { totalDailyDose, ome };
}

// ====================================================================
// Calculate total OME from an array of entries
// ====================================================================
export function calculateTotalOME(entries: OpioidEntry[]): number {
  return entries.reduce((sum, entry) => sum + calculateEntryOME(entry).ome, 0);
}

// ====================================================================
// Get methadone conversion ratio based on OME
// ====================================================================
function getMethadoneRatio(totalOME: number): number {
  for (const r of METHADONE_RATIOS) {
    if (totalOME <= r.maxOME) return r.ratio;
  }
  return METHADONE_RATIOS[METHADONE_RATIOS.length - 1].ratio;
}

// ====================================================================
// MAIN CONVERSION FUNCTION
// ====================================================================
export function performConversion(
  currentEntries: OpioidEntry[],
  newRegimen: NewRegimen,
  crossTolerancePercent: number,
  breakthroughPercent: number,
): ConversionResult {
  const warnings: string[] = [];

  // Step 1: Calculate total OME
  let totalOME = 0;
  let current24hTotal = 0;
  for (const entry of currentEntries) {
    const { totalDailyDose, ome } = calculateEntryOME(entry);
    current24hTotal += totalDailyDose;
    totalOME += ome;
  }

  // Refine methadone OME calculation if methadone is in the current regimen
  // Recalculate with correct ratio based on total OME
  for (const entry of currentEntries) {
    if (entry.drug === 'methadone') {
      const otherOME = totalOME - calculateEntryOME(entry).ome;
      const methRatio = getMethadoneRatio(otherOME);
      const doseInMg = entry.doseUnit === 'mcg' ? entry.dose / 1000 : entry.dose;
      const effectiveDoses = entry.frequency === 'continuous' ? 24 : entry.dosesPerDay;
      const methDaily = doseInMg * effectiveDoses;
      const methOME = methDaily * methRatio;
      totalOME = otherOME + methOME;
    }
  }

  // Step 2: Calculate raw equianalgesic dose for new drug
  let rawDose: number;
  let doseUnit = 'mg';
  const { drug: newDrug, route: newRoute } = newRegimen;

  // Handle transdermal fentanyl as new regimen
  if (newDrug === 'fentanyl' && newRoute === 'transdermal') {
    // OME → mcg/hr: divide by 2.4
    rawDose = totalOME / FENTANYL_PATCH_MCGHR_TO_OME_FACTOR;
    doseUnit = 'mcg/hr';
    // Round to nearest available patch size
    rawDose = roundToNearestPatchSize(rawDose, FENTANYL_PATCH_SIZES);
  }
  // Handle transdermal buprenorphine as new regimen
  else if (newDrug === 'buprenorphine' && newRoute === 'transdermal') {
    rawDose = totalOME / 2.4; // rough estimate
    doseUnit = 'mcg/hr';
    rawDose = roundToNearestPatchSize(rawDose, BUPRENORPHINE_PATCH_SIZES);
    if (rawDose > 20) {
      warnings.push('Buprenorphine patch doses >20 mcg/hr may require multiple patches. Consider alternative opioid.');
    }
  }
  // Handle methadone as new regimen
  else if (newDrug === 'methadone') {
    const ratio = getMethadoneRatio(totalOME);
    rawDose = totalOME / ratio;
    doseUnit = 'mg';
    warnings.push(
      `Methadone conversion is complex. Used ${ratio}:1 OME-to-methadone ratio based on ` +
      `${Math.round(totalOME)} mg OME/day. Start conservatively; titrate slowly. ` +
      'ECG monitoring recommended (QTc prolongation risk).'
    );
  }
  // Handle buprenorphine SL
  else if (newDrug === 'buprenorphine' && newRoute === 'sl') {
    const units = getEquianalgesicUnits(newDrug, newRoute);
    rawDose = totalOME * (units / 30);
    doseUnit = 'mg';
    warnings.push(
      'Buprenorphine is a partial mu-opioid agonist. In opioid-tolerant patients, ' +
      'it may precipitate withdrawal. Start at low doses and titrate carefully.'
    );
  }
  // Standard conversion
  else {
    const units = getEquianalgesicUnits(newDrug, newRoute);
    rawDose = totalOME * (units / 30);
    doseUnit = 'mg';
  }

  // Step 3: Determine if cross-tolerance reduction is needed
  // Check if switching to a different opioid (not just route change of same drug)
  const isSameDrug = currentEntries.length === 1 && currentEntries[0].drug === newDrug;
  const isNewDrugOrRoute = !isSameDrug;
  const effectiveCrossTolerance = isNewDrugOrRoute ? crossTolerancePercent : 0;

  // Step 4: Apply cross-tolerance reduction
  const final24hDose = rawDose * (1 - effectiveCrossTolerance);

  // Step 5: Generate scheduled dosing recommendation
  const { scheduledDoseMg, scheduledFrequency, scheduledUnit } =
    generateScheduledDosing(newDrug, newRoute, final24hDose, doseUnit);

  // Step 6: Generate breakthrough dosing
  const breakthroughDoseMg = final24hDose * breakthroughPercent;
  const breakthroughFreq = 'q4h PRN';

  // Step 7: Generate PCA settings if applicable
  let pca: PCAConfig | null = null;
  if (newRoute === 'pca') {
    pca = generatePCASettings(newDrug, final24hDose);
  }

  // Step 8: Generate warnings
  generateWarnings(newDrug, newRoute, warnings);

  return {
    current24hDose: Math.round(current24hTotal * 100) / 100,
    totalOME: Math.round(totalOME * 100) / 100,
    rawEquianalgesicDose: Math.round(rawDose * 100) / 100,
    crossToleranceReduction: effectiveCrossTolerance,
    final24hDose: Math.round(final24hDose * 100) / 100,
    final24hDoseUnit: doseUnit,
    scheduledDoseMg: Math.round(scheduledDoseMg * 100) / 100,
    scheduledFrequency,
    scheduledUnit,
    breakthroughDoseMg: Math.round(breakthroughDoseMg * 100) / 100,
    breakthroughDosePercent: breakthroughPercent * 100,
    breakthroughFrequency: breakthroughFreq,
    breakthroughUnit: doseUnit === 'mcg/hr' ? 'mg' : doseUnit,
    pca,
    warnings,
  };
}

// ====================================================================
// Generate scheduled dosing based on drug, route, and total daily dose
// ====================================================================
function generateScheduledDosing(
  drug: OpioidDrug,
  route: Route,
  totalDailyDose: number,
  unit: string,
): { scheduledDoseMg: number; scheduledFrequency: string; scheduledUnit: string } {
  // Transdermal: already a continuous delivery
  if (route === 'transdermal') {
    return {
      scheduledDoseMg: totalDailyDose,
      scheduledFrequency: 'Apply one patch every 72 hours',
      scheduledUnit: unit,
    };
  }

  // IV continuous or PCA
  if (route === 'iv' || route === 'sc' || route === 'pca') {
    if (drug === 'fentanyl') {
      // Fentanyl IV is usually given as mcg/hr or mcg doses
      const mcgPerHr = (totalDailyDose * 1000) / 24;
      return {
        scheduledDoseMg: Math.round(mcgPerHr * 10) / 10,
        scheduledFrequency: 'mcg/hr continuous infusion (or divide into intermittent doses)',
        scheduledUnit: 'mcg/hr',
      };
    }
    // IV morphine or hydromorphone
    const mgPerHr = totalDailyDose / 24;
    if (mgPerHr < 0.5) {
      // Low dose: suggest intermittent rather than continuous
      return {
        scheduledDoseMg: totalDailyDose / 6,
        scheduledFrequency: 'q4h IV/SC',
        scheduledUnit: 'mg',
      };
    }
    return {
      scheduledDoseMg: Math.round(mgPerHr * 100) / 100,
      scheduledFrequency: 'mg/hr continuous infusion',
      scheduledUnit: 'mg/hr',
    };
  }

  // Oral: default to q4h for IR, q12h for ER
  const doseQ4h = totalDailyDose / 6;
  const doseQ12h = totalDailyDose / 2;

  if (drug === 'methadone') {
    // Methadone: typically q8h or q12h for pain
    return {
      scheduledDoseMg: totalDailyDose / 3,
      scheduledFrequency: 'q8h (methadone typical pain dosing)',
      scheduledUnit: 'mg',
    };
  }

  // Default: recommend both IR and ER options
  if (doseQ4h < 2) {
    return {
      scheduledDoseMg: Math.round(doseQ4h * 100) / 100,
      scheduledFrequency: 'q4h scheduled (IR)',
      scheduledUnit: 'mg',
    };
  }

  return {
    scheduledDoseMg: Math.round(doseQ4h * 100) / 100,
    scheduledFrequency: `q4h (IR) OR ${Math.round(doseQ12h * 100) / 100} mg q12h (ER)`,
    scheduledUnit: 'mg',
  };
}

// ====================================================================
// Generate PCA settings
// ====================================================================
function generatePCASettings(drug: OpioidDrug, totalDailyDose: number): PCAConfig {
  const mgPerHr = totalDailyDose / 24;

  switch (drug) {
    case 'morphine': {
      // Basal: 40-60% of hourly rate; Bolus: ~50-100% of hourly rate
      const basal = Math.round(mgPerHr * 0.5 * 10) / 10;
      const bolus = Math.max(0.5, Math.round(mgPerHr * 0.8 * 10) / 10);
      const lockout = 8; // minutes
      const oneHrLimit = Math.round((basal + bolus * (60 / lockout)) * 10) / 10;
      const fourHrLimit = Math.round(oneHrLimit * 4 * 10) / 10;
      return { enabled: true, basalRate: basal, bolusDose: bolus, lockoutMinutes: lockout, oneHourLimit: oneHrLimit, fourHourLimit: fourHrLimit };
    }
    case 'hydromorphone': {
      const basal = Math.round(mgPerHr * 0.5 * 100) / 100;
      const bolus = Math.max(0.1, Math.round(mgPerHr * 0.8 * 100) / 100);
      const lockout = 8;
      const oneHrLimit = Math.round((basal + bolus * (60 / lockout)) * 100) / 100;
      const fourHrLimit = Math.round(oneHrLimit * 4 * 100) / 100;
      return { enabled: true, basalRate: basal, bolusDose: bolus, lockoutMinutes: lockout, oneHourLimit: oneHrLimit, fourHourLimit: fourHrLimit };
    }
    case 'fentanyl': {
      const mcgPerHr = mgPerHr * 1000;
      const basal = Math.round(mcgPerHr * 0.5);
      const bolus = Math.max(10, Math.round(mcgPerHr * 0.8));
      const lockout = 6;
      const oneHrLimit = Math.round(basal + bolus * (60 / lockout));
      const fourHrLimit = Math.round(oneHrLimit * 4);
      return { enabled: true, basalRate: basal, bolusDose: bolus, lockoutMinutes: lockout, oneHourLimit: oneHrLimit, fourHourLimit: fourHrLimit };
    }
    default:
      return { enabled: false, basalRate: 0, bolusDose: 0, lockoutMinutes: 8, oneHourLimit: 0, fourHourLimit: 0 };
  }
}

// ====================================================================
// Generate clinical warnings
// ====================================================================
function generateWarnings(drug: OpioidDrug, route: Route, warnings: string[]): void {
  // Renal warnings
  const renalWarnings: Partial<Record<OpioidDrug, string>> = {
    morphine: '⚠ Renal impairment: Morphine active metabolites (M6G, M3G) accumulate in renal failure. Use with caution; consider hydromorphone or fentanyl instead.',
    codeine: '⚠ Renal impairment: Avoid codeine in renal failure (CrCl <30 mL/min).',
    tramadol: '⚠ Renal impairment: Avoid tramadol if CrCl <30 mL/min; reduce frequency if CrCl 30-60.',
    hydromorphone: '✓ Hydromorphone is preferred in renal impairment (H3G metabolite is inactive).',
    fentanyl: '✓ Fentanyl is relatively safe in renal impairment.',
    methadone: '✓ Methadone is relatively safe in renal impairment.',
  };

  // Hepatic warnings
  const hepaticWarnings: Partial<Record<OpioidDrug, string>> = {
    morphine: '⚠ Hepatic impairment: Avoid in severe hepatic impairment; reduce dose in moderate impairment.',
    codeine: '⚠ Hepatic impairment: Avoid codeine (impaired CYP2D6 conversion to active morphine).',
    tramadol: '⚠ Hepatic impairment: Avoid tramadol in severe hepatic impairment.',
    oxycodone: '⚠ Hepatic impairment: Reduce oxycodone dose by 50% in moderate-severe impairment.',
    hydrocodone: '⚠ Hepatic impairment: Use hydrocodone with caution; consider dose reduction.',
  };

  // Methadone specific
  if (drug === 'methadone') {
    warnings.push(
      '⚠ Methadone has a long and variable half-life (8-59 hours). Risk of delayed respiratory depression. ' +
      'ECG monitoring for QTc prolongation recommended. Consult pain specialist or pharmacist.'
    );
  }

  // Buprenorphine specific
  if (drug === 'buprenorphine' && route === 'sl') {
    warnings.push(
      '⚠ In patients receiving full mu-agonists, buprenorphine may precipitate withdrawal. ' +
      'Patient should be in mild withdrawal before first dose.'
    );
  }

  // Transdermal fentanyl
  if (drug === 'fentanyl' && route === 'transdermal') {
    warnings.push(
      '⚠ Fentanyl patch: Onset 12-24 hours; offset 24+ hours after removal. Continue previous opioid ' +
      'for 12 hours after first patch application. Not for acute/post-op pain in opioid-naïve patients.'
    );
  }
}

// ====================================================================
// Round to nearest available patch size
// ====================================================================
function roundToNearestPatchSize(value: number, sizes: number[]): number {
  if (value <= sizes[0]) return sizes[0];
  if (value >= sizes[sizes.length - 1]) return sizes[sizes.length - 1];

  let closest = sizes[0];
  let minDiff = Math.abs(value - sizes[0]);
  for (const size of sizes) {
    const diff = Math.abs(value - size);
    if (diff < minDiff) {
      minDiff = diff;
      closest = size;
    }
  }
  return closest;
}

// ====================================================================
// Get renal/hepatic warnings for display (independent of conversion)
// ====================================================================
export function getDrugWarnings(drug: OpioidDrug): { renal: string | null; hepatic: string | null } {
  const renalMap: Partial<Record<OpioidDrug, string>> = {
    morphine: 'Active metabolites (M6G) accumulate in renal failure — use with caution.',
    codeine: 'Avoid in renal failure (CrCl <30).',
    tramadol: 'Avoid if CrCl <30; reduce frequency if CrCl 30-60.',
    hydromorphone: 'Preferred in renal impairment (inactive metabolites).',
    fentanyl: 'Relatively safe in renal impairment.',
    methadone: 'Relatively safe in renal impairment.',
    oxycodone: 'Use with caution in renal impairment.',
    hydrocodone: 'Use with caution in renal impairment.',
  };

  const hepaticMap: Partial<Record<OpioidDrug, string>> = {
    morphine: 'Avoid in severe hepatic impairment; reduce dose in moderate.',
    codeine: 'Avoid (impaired conversion to active morphine).',
    tramadol: 'Avoid in severe hepatic impairment.',
    oxycodone: 'Reduce dose by 50% in moderate-severe impairment.',
    hydrocodone: 'Use with caution; consider dose reduction.',
    hydromorphone: 'Use with caution in hepatic impairment.',
    fentanyl: 'Relatively safe; may have prolonged effect in severe impairment.',
    methadone: 'Use with caution; may accumulate in severe impairment.',
  };

  return {
    renal: renalMap[drug] || null,
    hepatic: hepaticMap[drug] || null,
  };
}
