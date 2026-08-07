// test.mjs — the suite. Run: node test.mjs
//
// The load-bearing claim is that RAW AGREEMENT LIES on imbalanced criteria and kappa does not. So the
// suite builds the exact adversarial case — a judge that answers MET unconditionally on a criterion
// that is met 95% of the time — and proves raw agreement scores it ~0.95 while kappa scores it ~0.
// Kappa is additionally checked against hand-computed values, because a statistic nobody verified is
// a number with a Greek letter next to it.
import { MET, NOT_MET, NA, VERDICTS, confusion, rawAgreement, kappa, direction, analyse, analyseAll } from './agree.mjs';
import { AUTOMATE, AUDIT, KEEP, INSUFFICIENT, DECISIONS, DEFAULTS, decide, delegation, savings } from './delegate.mjs';

let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => { if (cond) pass++; else { fail++; console.error(`  FAIL  ${name}${extra ? ' · ' + extra : ''}`); } };
const throws = (name, fn, match) => {
  try { fn(); ok(name, false, 'expected a throw'); }
  catch (e) { ok(name, match ? String(e.message).includes(match) : true, e.message.slice(0, 90)); }
};
const rep = (v, n) => Array.from({ length: n }, () => v);

// ── 1 · the confusion matrix ────────────────────────────────────────────────────────────────
{
  const a = [MET, MET, NOT_MET, NOT_MET, MET, NOT_MET];
  const b = [MET, NOT_MET, NOT_MET, MET, MET, NOT_MET];
  const c = confusion(a, b);
  ok('confusion · counts both-met', c.bothMet === 2);
  ok('confusion · counts both-not-met', c.bothNot === 2);
  ok('confusion · counts a-only', c.aMetOnly === 1);
  ok('confusion · counts b-only', c.bMetOnly === 1);
  ok('confusion · totals the scored items', c.scored === 6);
  ok('confusion · reports the item count', c.items === 6);
  ok('confusion · the four cells sum to scored', c.bothMet + c.bothNot + c.aMetOnly + c.bMetOnly === c.scored);
}
throws('confusion · rejects mismatched lengths', () => confusion([MET], [MET, MET]), 'same items');

// abstention is neither agreement nor disagreement
{
  const c = confusion([MET, NA, MET, NOT_MET], [MET, MET, NA, NOT_MET]);
  ok('confusion · an abstention on either side is excluded', c.scored === 2);
  ok('confusion · abstentions are counted separately', c.abstained === 2);
  ok('confusion · an abstention is not scored as agreement', c.bothMet === 1);
  ok('confusion · an abstention is not scored as disagreement', c.aMetOnly === 0 && c.bMetOnly === 0);
  ok('confusion · invalid verdicts are counted, not crashed on', confusion(['WAT'], [MET]).invalid === 1);
  ok('confusion · an invalid verdict is not scored', confusion(['WAT'], [MET]).scored === 0);
}

// ── 2 · THE CLAIM · raw agreement lies where kappa does not ─────────────────────────────────
{
  // A criterion met 95 times in 100. The "judge" answers MET unconditionally: it has learned nothing.
  const reference = [...rep(MET, 95), ...rep(NOT_MET, 5)];
  const lazyJudge = rep(MET, 100);
  const a = analyse('LAZY-01', reference, lazyJudge);

  ok('claim · a constant judge scores high RAW agreement', a.raw >= 0.94, `raw=${a.raw}`);
  ok('claim · the same judge scores kappa at essentially zero', Math.abs(a.kappa) < 1e-9, `kappa=${a.kappa}`);
  ok('claim · so raw agreement alone would have recommended automation', a.raw >= DEFAULTS.automateRaw);
  ok('claim · and the delegation decision refuses anyway', decide(a).decision !== AUTOMATE);
  ok('claim · the refusal names kappa as the reason', decide(a).reasons.some(r => r.includes('κ')));

  // a judge that actually tracks the reference
  const goodJudge = [...rep(MET, 93), ...rep(NOT_MET, 2), ...rep(NOT_MET, 5)];
  const g = analyse('GOOD-01', reference, goodJudge);
  ok('claim · a judge that tracks the reference scores high kappa', g.kappa > 0.7, `kappa=${g.kappa}`);
  ok('claim · on the same criterion where the lazy judge scored zero', g.raw >= a.raw - 0.05);
}

// kappa against hand-computed values
{
  // perfect agreement, balanced
  const perfect = confusion([...rep(MET, 50), ...rep(NOT_MET, 50)], [...rep(MET, 50), ...rep(NOT_MET, 50)]);
  ok('kappa · perfect agreement is 1', kappa(perfect).kappa === 1);
  // complete disagreement, balanced: po = 0, pe = 0.5 → κ = −1
  const opposite = confusion([...rep(MET, 50), ...rep(NOT_MET, 50)], [...rep(NOT_MET, 50), ...rep(MET, 50)]);
  ok('kappa · complete disagreement is −1', Math.abs(kappa(opposite).kappa + 1) < 1e-9, `k=${kappa(opposite).kappa}`);
  // a hand-computed case: bothMet 40, bothNot 30, aMetOnly 20, bMetOnly 10, n = 100
  // po = 0.70 ; aMet = 0.60 ; bMet = 0.50 ; pe = 0.6*0.5 + 0.4*0.5 = 0.50 ; κ = 0.20/0.50 = 0.40
  const c = confusion(
    [...rep(MET, 40), ...rep(NOT_MET, 30), ...rep(MET, 20), ...rep(NOT_MET, 10)],
    [...rep(MET, 40), ...rep(NOT_MET, 30), ...rep(NOT_MET, 20), ...rep(MET, 10)]);
  const k = kappa(c);
  ok('kappa · matches the hand-computed value', Math.abs(k.kappa - 0.4) < 1e-9, `k=${k.kappa}`);
  ok('kappa · reports observed agreement', Math.abs(k.po - 0.7) < 1e-9);
  ok('kappa · reports chance agreement', Math.abs(k.pe - 0.5) < 1e-9);
  ok('kappa · is null with nothing scored', kappa(confusion([], [])).kappa === null);
  ok('kappa · raw agreement is null with nothing scored', rawAgreement(confusion([], [])) === null);
}

// the degenerate case — both raters constant
{
  const d = kappa(confusion(rep(MET, 40), rep(MET, 40)));
  ok('kappa · both raters always MET is flagged degenerate', d.degenerate === true);
  ok('kappa · a degenerate perfect match still reports 1', d.kappa === 1);
  ok('kappa · a degenerate case where they differ reports 0',
    (() => { const c = confusion(rep(MET, 10), rep(NOT_MET, 10)); return c.scored === 10 && kappa(c).kappa === 0; })());
  ok('delegate · a degenerate criterion never automates, whatever its raw agreement',
    decide(analyse('D', rep(MET, 60), rep(MET, 60))).decision === KEEP);
  ok('delegate · and says why', decide(analyse('D', rep(MET, 60), rep(MET, 60))).reasons[0].includes('never discriminated'));
}

// ── 3 · direction ───────────────────────────────────────────────────────────────────────────
{
  const over = direction(confusion([...rep(NOT_MET, 20), ...rep(MET, 20)], [...rep(MET, 20), ...rep(MET, 20)]));
  ok('direction · an over-awarding judge is named', over.tendency === 'over-awards');
  ok('direction · its bias is positive', over.bias > 0);
  ok('direction · a one-way disagreement is fully skewed', over.skew === 1);

  const under = direction(confusion([...rep(MET, 20), ...rep(MET, 20)], [...rep(NOT_MET, 20), ...rep(MET, 20)]));
  ok('direction · an under-awarding judge is named', under.tendency === 'under-awards');
  ok('direction · its bias is negative', under.bias < 0);

  const sym = direction(confusion([...rep(MET, 10), ...rep(NOT_MET, 10)], [...rep(NOT_MET, 10), ...rep(MET, 10)]));
  ok('direction · symmetric disagreement is named symmetric', sym.tendency === 'symmetric');
  ok('direction · symmetric disagreement has zero bias', sym.bias === 0);
  ok('direction · symmetric disagreement has skew 0.5', sym.skew === 0.5);

  const none = direction(confusion(rep(MET, 10), rep(MET, 10)));
  ok('direction · perfect agreement has no tendency', none.tendency === 'none');
  ok('direction · perfect agreement has zero skew', none.skew === 0);
  ok('direction · with nothing scored the bias is zero rather than NaN', direction(confusion([], [])).bias === 0);
}

// ── 4 · the delegation decision ─────────────────────────────────────────────────────────────
// a judge that tracks the reference closely, on a balanced criterion
const strongRef = [...rep(MET, 50), ...rep(NOT_MET, 50)];
const strongJudge = [...rep(MET, 49), NOT_MET, ...rep(NOT_MET, 49), MET];
{
  const d = decide(analyse('STRONG', strongRef, strongJudge));
  ok('delegate · a strong judge is handed the criterion', d.decision === AUTOMATE, JSON.stringify(d.reasons));
  ok('delegate · it reports the sample size it decided on', d.scored === 100);
  ok('delegate · the reason names both figures', d.reasons[0].includes('κ') && d.reasons[0].includes('raw'));
}
{
  // moderate: usable but not unattended
  const mid = [...rep(MET, 40), ...rep(NOT_MET, 10), ...rep(NOT_MET, 40), ...rep(MET, 10)];
  const d = decide(analyse('MID', strongRef, mid));
  ok('delegate · a moderate judge is audited rather than automated', d.decision === AUDIT, `k=${d.kappa}`);
  ok('delegate · and the shortfall is named', d.reasons.length > 0);
}
{
  const weak = [...rep(MET, 25), ...rep(NOT_MET, 25), ...rep(NOT_MET, 25), ...rep(MET, 25)];
  ok('delegate · a judge no better than chance is kept human', decide(analyse('WEAK', strongRef, weak)).decision === KEEP);
}
{
  const d = decide(analyse('TINY', rep(MET, 4), rep(MET, 4)));
  ok('delegate · too small a sample is INSUFFICIENT, not a pass', d.decision === INSUFFICIENT);
  ok('delegate · and it says how many it needed', d.reasons[0].includes(String(DEFAULTS.minScored)));
}
// the sample-size boundary
{
  const n = DEFAULTS.minScored;
  const ref = [...rep(MET, n / 2), ...rep(NOT_MET, n / 2)];
  ok('delegate · exactly the minimum sample IS decided', decide(analyse('AT', ref, ref)).decision !== INSUFFICIENT);
  ok('delegate · one below the minimum is not',
    decide(analyse('UNDER', ref.slice(1), ref.slice(1))).decision === INSUFFICIENT);
}
// bias blocks automation even when both agreement figures clear
{
  // 96% raw, but every disagreement runs one way
  const ref = [...rep(MET, 50), ...rep(NOT_MET, 50)];
  const biased = [...rep(MET, 50), ...rep(MET, 8), ...rep(NOT_MET, 42)];
  const a = analyse('BIASED', ref, biased);
  const d = decide(a, { automateKappa: 0.5, automateRaw: 0.9 });
  ok('delegate · systematic one-way drift blocks automation', d.decision !== AUTOMATE, `bias=${a.direction.bias}`);
  ok('delegate · and the reason names the direction', d.reasons.some(r => r.includes('over-awards')));
  ok('delegate · relaxing the bias bar lets it through',
    decide(a, { automateKappa: 0.5, automateRaw: 0.9, maxBias: 1 }).decision === AUTOMATE);
}
// thresholds are honoured at the boundary
{
  const a = analyse('B', strongRef, strongJudge);
  ok('delegate · a kappa threshold exactly at the value still automates',
    decide(a, { automateKappa: a.kappa }).decision === AUTOMATE);
  ok('delegate · just above it does not',
    decide(a, { automateKappa: a.kappa + 1e-9 }).decision !== AUTOMATE);
  ok('delegate · a raw threshold exactly at the value still automates',
    decide(a, { automateRaw: a.raw }).decision === AUTOMATE);
  ok('delegate · just above it does not', decide(a, { automateRaw: a.raw + 1e-9 }).decision !== AUTOMATE);
  ok('delegate · a bias bar exactly at the value still automates',
    decide(a, { maxBias: Math.abs(a.direction.bias) }).decision === AUTOMATE);
  ok('delegate · an audit floor exactly at kappa still audits',
    decide(a, { automateKappa: 1.1, auditKappa: a.kappa }).decision === AUDIT);
  ok('delegate · just above the audit floor drops to KEEP',
    decide(a, { automateKappa: 1.1, auditKappa: a.kappa + 1e-9 }).decision === KEEP);

  // A criterion can fail on one bar while sitting exactly ON another. The reasons must then name only
  // the bar it actually failed — a report that lists a figure as too low when it is exactly at the
  // threshold sends someone to fix the wrong thing.
  const kOnly = decide(a, { automateKappa: a.kappa, automateRaw: 1.1 });
  ok('delegate · a kappa sitting exactly on its bar is not listed as a shortfall',
    kOnly.decision !== AUTOMATE && !kOnly.reasons.some(r => r.includes('κ')), JSON.stringify(kOnly.reasons));
  const rOnly = decide(a, { automateRaw: a.raw, automateKappa: 1.1 });
  ok('delegate · a raw agreement sitting exactly on its bar is not listed as a shortfall',
    rOnly.decision !== AUTOMATE && !rOnly.reasons.some(r => r.includes('raw agreement')), JSON.stringify(rOnly.reasons));
  const bOnly = decide(a, { maxBias: Math.abs(a.direction.bias), automateKappa: 1.1 });
  ok('delegate · a bias sitting exactly on its bar is not listed as a shortfall',
    bOnly.decision !== AUTOMATE && !bOnly.reasons.some(r => r.includes('systematically')), JSON.stringify(bOnly.reasons));
  ok('delegate · but a bias just over the bar IS listed',
    decide(a, { maxBias: -1e-9, automateKappa: 1.1 }).reasons.some(r => r.includes('systematically')));
}

// ── 5 · across a whole rubric ───────────────────────────────────────────────────────────────
const REF = {
  'CON-02': [...rep(MET, 50), ...rep(NOT_MET, 50)],                 // mechanical, judge nails it
  'CAL-01': [...rep(MET, 50), ...rep(NOT_MET, 50)],                 // subtle, judge struggles
  'SAF-01': [...rep(MET, 95), ...rep(NOT_MET, 5)],                  // imbalanced
  'TINY-01': rep(MET, 5),                                            // not enough data
};
const JUDGE = {
  'CON-02': [...rep(MET, 50), ...rep(NOT_MET, 50)],                 // perfect
  'CAL-01': [...rep(MET, 30), ...rep(NOT_MET, 20), ...rep(NOT_MET, 30), ...rep(MET, 20)],
  'SAF-01': rep(MET, 100),                                           // always MET — the lazy judge
  'TINY-01': rep(MET, 5),
};
{
  const del = delegation(REF, JUDGE);
  ok('rubric · analyses every shared criterion', del.analyses.length === 4);
  ok('rubric · the mechanical criterion is automated', del.by[AUTOMATE].includes('CON-02'));
  ok('rubric · the subtle criterion is not', !del.by[AUTOMATE].includes('CAL-01'));
  ok('rubric · the imbalanced criterion with a lazy judge is not automated', !del.by[AUTOMATE].includes('SAF-01'));
  ok('rubric · the undersampled criterion is INSUFFICIENT', del.by[INSUFFICIENT].includes('TINY-01'));
  ok('rubric · every criterion gets exactly one decision',
    DECISIONS.reduce((s, d) => s + del.by[d].length, 0) === 4);
  ok('rubric · the automatable share counts undecided against automation', Math.abs(del.automatable - 0.25) < 1e-12);
  ok('rubric · reports the thresholds it used', del.thresholds.minScored === DEFAULTS.minScored);
  ok('rubric · criteria absent from the judge are skipped',
    delegation(REF, { 'CON-02': JUDGE['CON-02'] }).analyses.length === 1);
  ok('rubric · an empty rubric automates nothing rather than dividing by zero', delegation({}, {}).automatable === 0);
  ok('analyseAll · returns criteria in a stable order',
    analyseAll(REF, JUDGE).map(a => a.id).join() === ['CAL-01','CON-02','SAF-01','TINY-01'].join());
}

// ── 6 · savings, reported with the residual error ───────────────────────────────────────────
{
  const del = delegation(REF, JUDGE);
  const s = savings(del, { items: 100, perItemHuman: 2, perItemJudge: 0.1 });
  ok('savings · counts the criteria', s.criteria === 4);
  ok('savings · counts what was automated', s.automated === 1);
  ok('savings · human cost before is every criterion', s.humanBefore === 4 * 100 * 2);
  ok('savings · human cost after excludes the automated one', s.humanAfter === 3 * 100 * 2);
  ok('savings · the judge is not free', s.judgeCost === 1 * 100 * 0.1);
  ok('savings · nets the two', s.saved === s.humanBefore - s.humanAfter - s.judgeCost);
  ok('savings · reports a residual error rate', typeof s.residualErrorRate === 'number');
  ok('savings · with a perfect automated criterion the residual is zero', s.residualErrorRate === 0);
  ok('savings · automating nothing saves nothing',
    savings(delegation({ 'X': rep(MET, 5) }, { 'X': rep(MET, 5) }), { items: 10 }).saved === 0);
  ok('savings · automating nothing reports a zero residual rather than NaN',
    savings(delegation({ 'X': rep(MET, 5) }, { 'X': rep(MET, 5) }), { items: 10 }).residualErrorRate === 0);
  ok('savings · a residual is NOT reported as zero when the judge is imperfect', (() => {
    const ref = { 'A': [...rep(MET, 50), ...rep(NOT_MET, 50)] };
    const jud = { 'A': [...rep(MET, 49), NOT_MET, ...rep(NOT_MET, 49), MET] };
    return savings(delegation(ref, jud), { items: 10 }).residualErrorRate > 0;
  })());
}

console.log(`\nkonomi-judge · ${pass}/${pass + fail} passed`);
if (fail) { console.error(`${fail} FAILED`); process.exit(1); }
