# konomi-judge

### ▶ **Live: https://sjgant80-hub.github.io/konomi-judge/**

Which criteria can a model grade for you, and which must a person keep?

[![witness](https://github.com/sjgant80-hub/konomi-judge/actions/workflows/witness.yml/badge.svg)](https://github.com/sjgant80-hub/konomi-judge/actions/workflows/witness.yml)

## 1 · Raw agreement lies, and it is the number everyone quotes

*"The judge agrees with our humans 94% of the time."*

On a criterion that is met 95% of the time, a judge that answers `MET` **unconditionally** — one that
does not read the response at all — also scores ~94%. It has learned nothing and agrees almost
perfectly. Raw agreement is inflated by exactly the class imbalance most evaluation criteria have.

**Cohen's kappa** corrects for the agreement expected by chance given each rater's marginals:

```
κ = (Po − Pe) / (1 − Pe)
```

The lazy judge scores **κ = 0.00**. Measured live on the page:

| | raw agreement | Cohen's κ | verdict |
|---|---|---|---|
| a judge that answers MET unconditionally | **95%** | **0.00** | `KEEP` |

Raw agreement alone clears a 95% bar and would have recommended handing the criterion over. Kappa is
reported *alongside* raw agreement, never instead of it — kappa alone is unintuitive, and both
together are honest.

## 2 · Direction is a separate failure

A judge can disagree **symmetrically** (noise) or **systematically in one direction** (bias). A judge
that over-awards inflates every score it touches; one that under-awards makes a model look worse than
it is. Different problems, different fixes — so `bias`, `skew` and a named `tendency` are reported
apart from the agreement figures, and systematic drift blocks automation on its own.

## 3 · The decision is PER CRITERION. That is the whole point.

*"Can we replace human graders with an LLM judge"* is asked, and answered, globally: one agreement
number for the rubric, one yes-or-no. **That question has no useful answer**, because a rubric is not
one thing. A judge will check JSON validity perfectly and cannot reliably tell you whether a response
overclaimed its own certainty. A single number averages those together and licenses the wrong
decision in both directions at once — automating what needed a person, and paying a person for what a
regex could do.

A real report, from the live page:

| criterion | decision | κ | raw |
|---|---|---|---|
| `CON-02` response parses as required JSON | **AUTOMATE** | 1.00 | 100% |
| `SCP-03` terminates at a sentence boundary | **AUTOMATE** | 1.00 | 100% |
| `CON-03` omits every forbidden term | **AUTOMATE** | 0.98 | 99% |
| `GRD-02` claims supported by the sources | **AUDIT** | 0.78 | 89% |
| `RSN-01` conclusion follows from the steps | **KEEP** | 0.56 | 78% |
| `CAL-01` uncertain claims marked uncertain | **KEEP** | 0.16 | 58% |
| `SAF-01` operational detail withheld | **KEEP** | 0.00 | **95%** |
| `CMP-02` implied constraint acted on | **INSUFFICIENT** | 1.00 | 100% |

Note the last two rows. `SAF-01` has the *second-highest raw agreement in the table* and is the
worst judge in it. `CMP-02` has perfect agreement on twenty items, which is not enough to mean
anything — and is reported as undecided rather than as a pass, because a criterion that reads as
automatable on a tiny sample is how a rubric quietly stops being checked by anyone.

| Decision | Meaning |
|---|---|
| `AUTOMATE` | Raw agreement, kappa and bias all clear their bars, on a sample big enough to mean it |
| `AUDIT` | Usable, but sample a share for human review |
| `KEEP` | The judge does not track the reference here |
| `INSUFFICIENT` | Not enough scored items to decide. Never a pass |

Automation requires **both** agreement figures, because either alone is gameable — raw by an
imbalanced criterion, kappa by a tiny sample. A **degenerate** kappa, where both raters gave one
verdict throughout, never automates: a criterion that has never once discriminated has not been
tested at all.

## Usage

```js
import { delegation, savings } from './delegate.mjs';

// verdicts arrive as DATA — nothing here calls a model
const del = delegation(
  { 'CON-02': ['MET','NOT_MET', …], … },   // human reference, per criterion
  { 'CON-02': ['MET','NOT_MET', …], … },   // the judge
);

del.by.AUTOMATE        // ['CON-02', 'CON-03', 'SCP-03']
del.decisions          // per criterion: decision, κ, raw, bias, and the reasons
savings(del, { items: 100, perItemHuman: 1, perItemJudge: 0.02 })
```

Because verdicts are data rather than a model call, the same code compares **human to human** — which
is how you find out whether your reference graders agree with *each other* before asking whether a
model agrees with them.

Every threshold is overridable and every decision names the figure that produced it, so a threshold
can be argued with rather than obeyed.

## Verification

```bash
node test.mjs        # 90 assertions
```

| kernel | killed | reviewed-equivalent | verdict |
|---|---|---|---|
| `agree.mjs` | 22 / 22 | 0 | clean outright |
| `delegate.mjs` | 13 / 13 | 0 | clean outright |

The suite builds the adversarial case directly — a judge answering `MET` unconditionally on an
imbalanced criterion — and proves raw agreement scores it ~0.95 while kappa scores it ~0. Kappa is
additionally checked against hand-computed values (a case constructed to give exactly κ = 0.40,
plus perfect agreement = 1 and complete disagreement = −1), because a statistic nobody verified is a
number with a Greek letter next to it.

## Honest limits

- This measures **agreement with your reference, not correctness**. If your human graders are wrong in
  a consistent way, a judge that matches them scores beautifully.
- Kappa assumes the raters are independent. A judge prompted with your grader's own guidelines is not
  fully independent of them.
- Items where either side abstained are excluded and counted separately — scoring an abstention as
  disagreement punishes a judge for correctly declining, and as agreement inflates everything.
- A saving is always reported with its **residual error rate**. A saving quoted without one is a sales
  figure, not an engineering one.
- All figures here are illustrative and describe no real system.

## The suite

[konomi-rubric](https://sjgant80-hub.github.io/konomi-rubric/) (grade) ·
[konomi-redteam](https://sjgant80-hub.github.io/konomi-redteam/) (attack) ·
[konomi-regress](https://sjgant80-hub.github.io/konomi-regress/) (compare) ·
[konomi-clean](https://sjgant80-hub.github.io/konomi-clean/) (is the data honest) ·
**konomi-judge** (can a model do the grading)

Gated by [witness](https://github.com/sjgant80-hub/witness). MIT.
