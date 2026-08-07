// agree.mjs — how well does a cheap grader match the expensive one?
//
// WHY RAW AGREEMENT IS NOT ENOUGH, AND WHY THIS IS THE COMMON MISTAKE
//
// "The judge agrees with our humans 94% of the time" is the number everyone quotes, and on a
// criterion that is met 95% of the time, a judge that answers MET unconditionally also scores 94%.
// It has learned nothing and agrees almost perfectly. Raw agreement is inflated by exactly the
// imbalance that most evaluation criteria have.
//
// Cohen's kappa corrects for the agreement expected by chance given each rater's marginals:
//
//   κ = (Po − Pe) / (1 − Pe)
//
// A constant judge scores κ ≈ 0 no matter how high its raw agreement is. That is the entire point,
// and it is why kappa is reported alongside — never instead of — the raw figure, since kappa alone
// is unintuitive and both together are honest.
//
// The third number nobody reports is DIRECTION. A judge can disagree symmetrically (noise) or
// systematically in one direction (bias). A judge that over-awards inflates every score it touches;
// one that under-awards makes a model look worse than it is. Symmetric disagreement is a different
// problem with a different fix, so the two are separated here.
//
// Pure and deterministic: no I/O, no clock, no randomness. Verdicts arrive as DATA — nothing here
// calls a model, which is what lets the same code compare human-to-human as well as judge-to-human.

export const VERSION = '0.1.0';
export const SPEC_VERSION = 'konomi-judge-v1';

export const MET = 'MET';
export const NOT_MET = 'NOT_MET';
export const NA = 'N/A';
export const VERDICTS = Object.freeze([MET, NOT_MET, NA]);

/**
 * Compare two verdict sequences over the same items, in the same order.
 *
 * Items where EITHER side abstained (N/A) are excluded and counted separately. Scoring an abstention
 * as a disagreement punishes a judge for correctly declining, and scoring it as agreement inflates
 * everything — so it is neither, and the count is reported so the exclusion is visible.
 */
export function confusion(a, b) {
  if (a.length !== b.length) throw new Error('both raters must cover the same items, in the same order');
  let bothMet = 0, bothNot = 0, aMetOnly = 0, bMetOnly = 0, abstained = 0, invalid = 0;
  for (let i = 0; i < a.length; i++) {
    const x = a[i], y = b[i];
    if (!VERDICTS.includes(x) || !VERDICTS.includes(y)) { invalid++; continue; }
    if (x === NA || y === NA) { abstained++; continue; }
    if (x === MET && y === MET) bothMet++;
    else if (x === NOT_MET && y === NOT_MET) bothNot++;
    else if (x === MET) aMetOnly++;
    else bMetOnly++;
  }
  return { bothMet, bothNot, aMetOnly, bMetOnly, abstained, invalid, scored: bothMet + bothNot + aMetOnly + bMetOnly, items: a.length };
}

/** Raw agreement: the share of scored items where the two raters said the same thing. */
export function rawAgreement(c) {
  return c.scored === 0 ? null : (c.bothMet + c.bothNot) / c.scored;
}

/**
 * Cohen's kappa. Returns null when there is nothing to measure, and 1 when the two raters agree
 * completely — including the degenerate case where both always said the same single verdict, which
 * makes the chance-corrected denominator zero. That case is reported as `degenerate` rather than
 * hidden, because "κ = 1" from a constant criterion is not evidence of anything.
 */
export function kappa(c) {
  const n = c.scored;
  if (n === 0) return { kappa: null, po: null, pe: null, degenerate: false };
  const po = (c.bothMet + c.bothNot) / n;
  const aMet = (c.bothMet + c.aMetOnly) / n;
  const bMet = (c.bothMet + c.bMetOnly) / n;
  const pe = aMet * bMet + (1 - aMet) * (1 - bMet);
  if (pe === 1) return { kappa: po === 1 ? 1 : 0, po, pe, degenerate: true };
  return { kappa: (po - pe) / (1 - pe), po, pe, degenerate: false };
}

/**
 * Which way the disagreement runs.
 *
 * `bias` is (b awarded − a awarded) / scored, positive when B (conventionally the judge) awards MET
 * more often than A (the reference). `skew` is the share of disagreements that run one way: 0.5 is
 * symmetric noise, 1.0 is entirely one-directional.
 */
export function direction(c) {
  const disagreements = c.aMetOnly + c.bMetOnly;
  const bias = c.scored === 0 ? 0 : (c.bMetOnly - c.aMetOnly) / c.scored;
  const skew = disagreements === 0 ? 0 : Math.max(c.aMetOnly, c.bMetOnly) / disagreements;
  return {
    disagreements, bias, skew,
    tendency: disagreements === 0 ? 'none' : c.bMetOnly > c.aMetOnly ? 'over-awards' : c.aMetOnly > c.bMetOnly ? 'under-awards' : 'symmetric',
  };
}

/** Everything about one criterion, from two verdict sequences. */
export function analyse(id, reference, judge) {
  const c = confusion(reference, judge);
  const k = kappa(c);
  return {
    id, confusion: c, raw: rawAgreement(c),
    kappa: k.kappa, po: k.po, pe: k.pe, degenerate: k.degenerate,
    direction: direction(c),
  };
}

/**
 * Analyse a whole rubric at once.
 * `reference` and `judge` are objects mapping criterion id → array of verdicts, one per item.
 */
export function analyseAll(reference, judge) {
  const ids = Object.keys(reference).filter(id => Array.isArray(judge[id])).sort();
  return ids.map(id => analyse(id, reference[id], judge[id]));
}

export default { VERSION, SPEC_VERSION, MET, NOT_MET, NA, VERDICTS, confusion, rawAgreement, kappa, direction, analyse, analyseAll };
