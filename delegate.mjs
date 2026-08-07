// delegate.mjs — which criteria can a model grade for you, and which must a person keep?
//
// THE DECISION IS PER CRITERION. THAT IS THE WHOLE POINT.
//
// "Can we replace human graders with an LLM judge" is asked, and answered, globally: one agreement
// number for the whole rubric, one yes-or-no. That question has no useful answer, because the rubric
// is not one thing. A judge will check JSON validity perfectly and cannot reliably tell you whether a
// response overclaimed its own certainty. A single number averages those together and licenses the
// wrong decision in both directions at once — automating what needed a person, and paying a person
// for what a regex could do.
//
// So every criterion gets its own verdict:
//
//   AUTOMATE   agreement is high AND chance-corrected agreement is high AND the sample supports it
//   AUDIT      usable, but sample a share of it for human review
//   KEEP       the judge does not track the reference here; a person keeps this criterion
//   INSUFFICIENT   not enough scored items to decide — reported as unknown, never as a pass
//
// INSUFFICIENT exists because the alternative is worse. A criterion scored on four items where the
// judge happened to agree will read as AUTOMATE on raw agreement alone, and that is how a rubric
// quietly stops being checked by anyone.
//
// Pure and deterministic: no I/O, no clock, no randomness.
import { analyse, analyseAll } from './agree.mjs';

export const AUTOMATE = 'AUTOMATE';
export const AUDIT = 'AUDIT';
export const KEEP = 'KEEP';
export const INSUFFICIENT = 'INSUFFICIENT';
export const DECISIONS = Object.freeze([AUTOMATE, AUDIT, KEEP, INSUFFICIENT]);

export const DEFAULTS = Object.freeze({
  minScored: 30,        // fewer scored items than this and the decision is not made
  automateKappa: 0.8,   // chance-corrected agreement required to hand a criterion over
  automateRaw: 0.95,    // and raw agreement too — both, because either alone is gameable
  auditKappa: 0.6,      // above this it is usable under sampling
  maxBias: 0.05,        // systematic one-way drift beyond this blocks automation
});

/**
 * The delegation verdict for one analysed criterion, with the reason stated.
 *
 * Automation requires BOTH raw and chance-corrected agreement to clear their thresholds. Either one
 * alone is gameable: raw agreement by an imbalanced criterion, kappa by a tiny sample. A degenerate
 * kappa — where both raters gave one verdict throughout — never automates, because a criterion that
 * has never once discriminated has not been tested at all.
 */
export function decide(a, opts = {}) {
  const o = { ...DEFAULTS, ...opts };
  const reasons = [];
  const n = a.confusion.scored;

  if (n < o.minScored) {
    return { id: a.id, decision: INSUFFICIENT, scored: n, kappa: a.kappa, raw: a.raw, bias: a.direction.bias,
      reasons: [`only ${n} scored item(s); ${o.minScored} needed before a delegation decision means anything`] };
  }
  if (a.degenerate) {
    return { id: a.id, decision: KEEP, scored: n, kappa: a.kappa, raw: a.raw, bias: a.direction.bias,
      reasons: ['every scored item got the same verdict from both raters — this criterion has never discriminated, so agreement on it is not evidence'] };
  }

  const k = a.kappa, raw = a.raw, bias = Math.abs(a.direction.bias);
  if (k >= o.automateKappa && raw >= o.automateRaw && bias <= o.maxBias) {
    return { id: a.id, decision: AUTOMATE, scored: n, kappa: k, raw, bias: a.direction.bias,
      reasons: [`κ ${k.toFixed(2)} and raw ${(raw * 100).toFixed(0)}% both clear the bar, with bias ${(a.direction.bias * 100).toFixed(1)}%`] };
  }

  if (k < o.automateKappa) reasons.push(`κ ${k.toFixed(2)} is below ${o.automateKappa} — agreement here is not much better than chance given the marginals`);
  if (raw < o.automateRaw) reasons.push(`raw agreement ${(raw * 100).toFixed(0)}% is below ${(o.automateRaw * 100).toFixed(0)}%`);
  if (bias > o.maxBias) reasons.push(`the judge ${a.direction.tendency} systematically (bias ${(a.direction.bias * 100).toFixed(1)}%), which shifts every score it touches in one direction`);

  return { id: a.id, decision: k >= o.auditKappa ? AUDIT : KEEP, scored: n, kappa: k, raw, bias: a.direction.bias, reasons };
}

/** Decide across a whole rubric. */
export function delegation(reference, judge, opts = {}) {
  const analyses = analyseAll(reference, judge);
  const decisions = analyses.map(a => decide(a, opts));
  const by = {};
  for (const d of DECISIONS) by[d] = decisions.filter(x => x.decision === d).map(x => x.id);
  return {
    spec: 'konomi-judge-v1', analyses, decisions, by,
    // The honest headline: what share of the rubric a judge can actually be handed. Deliberately
    // counts INSUFFICIENT against automation — an undecided criterion is not an automated one.
    automatable: decisions.length === 0 ? 0 : by[AUTOMATE].length / decisions.length,
    thresholds: { ...DEFAULTS, ...opts },
  };
}

/**
 * What automating the AUTOMATE set would actually save, and cost.
 *
 * `perItemHuman` and `perItemJudge` are whatever unit you care about — minutes, pence, tokens. The
 * residual error is reported alongside the saving, because a saving quoted without it is a sales
 * figure rather than an engineering one.
 */
export function savings(del, { items = 0, perItemHuman = 1, perItemJudge = 0 } = {}) {
  const total = del.decisions.length;
  const auto = del.by[AUTOMATE].length;
  const audited = del.by[AUDIT].length;
  const humanBefore = total * items * perItemHuman;
  const humanAfter = (total - auto) * items * perItemHuman;
  const judgeCost = auto * items * perItemJudge;
  const autoAnalyses = del.analyses.filter(a => del.by[AUTOMATE].includes(a.id));
  const residual = autoAnalyses.length === 0 ? 0
    : 1 - autoAnalyses.reduce((s, a) => s + a.raw, 0) / autoAnalyses.length;
  return {
    criteria: total, automated: auto, audited, kept: del.by[KEEP].length, undecided: del.by[INSUFFICIENT].length,
    humanBefore, humanAfter, judgeCost, saved: humanBefore - humanAfter - judgeCost,
    // On the automated criteria, this share of verdicts will differ from what a person would have
    // said. It is small by construction — but it is not zero, and it is never reported as zero.
    residualErrorRate: residual,
  };
}

export default { AUTOMATE, AUDIT, KEEP, INSUFFICIENT, DECISIONS, DEFAULTS, decide, delegation, savings };
