# Current Task

## Task: Simulation Calibration Fixes

### What To Fix
Six issues identified from the CLI inspection report. Fix in order — each affects the next.

### Skill To Load
`.claude/skills/engine/SKILL.md`

---

## Fix 1 — USA Bouts: 0

**Root cause:** The event calendar is only generated for Latvia. USA events are never created so USA fighters never compete.

**Location:** `packages/engine/src/generation/calendar.ts` and `packages/engine/src/generation/world.ts`

`generateWorld` calls `generateCalendar` once. Check whether it passes all included nations or only the player nation. The calendar must generate domestic events for every nation in `config.includedNations` — not just the player nation.

Fix: `generateCalendar` must iterate over all included nations and generate domestic events for each. Latvia gets LBF events. USA gets USA Boxing events. Both appear on the shared calendar.

Also check `eventTick.ts` — verify it processes events for all nations, not just the player nation. The event loop must not filter by `nationId === playerNationId`.

---

## Fix 2 — Attributes Too Low

**Root cause:** Attribute accumulation events are either not being applied to fighters after bouts, or the gain values produce negligible growth.

**Two things to check:**

**Check A — Are attribute events being applied?**

In `backrun.ts` or `ipc.ts`, after `resolveBout()` returns `fighterAAttributeEvents` and `fighterBAttributeEvents` — are these actually being written to the fighter's `attributeHistory` and applied to their `developedAttributes.current` values?

The attribute events are calculated but may never be applied. Verify the flow:
```
resolveBout() → returns AttributeHistoryEvent[]
→ must be applied: fighter.developedAttributes[attr].current += delta
→ must be stored: fighter.attributeHistory[attr].events.push(event)
→ fighter marked as pendingFighterUpdates
```

**Check B — Are gain values sufficient?**

From `attribute-accumulation.json`, `amateur_bout` base gain for `ring_iq` is 0.4. With opposition quality multiplier of 1.0 and no soul trait bonus, a fighter gets 0.4 ring_iq per bout. After 50 bouts that's 20 points — but the cap is 20 so something else is wrong.

With 132 bouts, even at 0.3 gain per bout for power = 39.6 total. Power should be near ceiling not at 8.3.

The issue is likely that attribute events are calculated but not applied. Find where `pendingAttributeEvents` is consumed and verify the delta is actually added to `developedAttribute.current`.

---

## Fix 3 — Too Many Retirements (70%)

**Root cause:** Retirement probability is too high or triggering incorrectly.

**Location:** `packages/engine/src/engine/identityTick.ts`

Current retirement rules fire at:
- Age >= 38: 5% per week
- Age >= 35 AND heavy damage: 3% per week  
- 3 consecutive losses: 1% per week
- Content + no title ambitions + age >= 32: 0.5% per week

**Problem:** 5% per week at age 38 means a fighter has a 93% chance of retiring within a year of turning 38. Over 10 years with many fighters reaching 35+, most retire.

**Fix — reduce retirement probabilities significantly:**
```
Age >= 40: 3% per week (was 38 at 5%)
Age >= 37: 1% per week
Age >= 35 AND health heavily damaged: 1% per week (was 3%)
3 consecutive losses: 0.3% per week (was 1%)
Content + no title ambitions + age >= 35: 0.2% per week (was 32 at 0.5%)
```

Also add a minimum bout requirement — a fighter should not retire without having competed at all. If `totalBouts === 0`, retirement probability = 0 regardless of age.

---

## Fix 4 — Gym Finances Wildly Inflated

**Root cause:** Income calculation is not dividing by 4 to convert monthly to weekly, OR member count is orders of magnitude too high, OR the revenue is compounding incorrectly over 520 weeks.

**Location:** `packages/engine/src/engine/weeklyTick.ts`

Check the weekly income formula:
```typescript
// WRONG — this adds full monthly income every week
weeklyIncome = memberCount × monthlyMembershipFee

// CORRECT — divide by 4 to get weekly portion
weeklyIncome = (memberCount × monthlyMembershipFee) / 4
```

Also check member count — 3,250 persons in Latvia across 23 gyms = ~141 members per gym average. If all 141 members pay €30/month that's €4,230/month = €1,057/week. Over 520 weeks with no expenses that's €549,640. But Olimps Rīga has €3.8 million — so either the member count is wrong or the income formula is multiplying incorrectly.

Check if `memberIds.length` is being used vs a fixed count. Also verify outgoings (rent + wages) are being deducted each week.

**Target after fix:** A healthy gym after 10 years should have €10,000-€80,000. A struggling gym should be in deficit or near zero.

---

## Fix 5 — Fighter Bouts Too Frequent (132 bouts in 10 years)

**Root cause:** `coachShouldEnterFighter` is entering fighters into every available event with insufficient restriction.

**Location:** `packages/engine/src/engine/coachEntryDecision.ts`

132 bouts over 520 weeks = ~0.25 bouts per week = fighting roughly every 4 weeks. Real amateur fighters compete every 6-12 weeks at most.

**Fix — add minimum weeks between bouts:**
```typescript
// Fighter must have at least 6 weeks recovery between bouts
// For aspiring fighters: 8 weeks minimum
// For competing veterans with high bout count: 6 weeks minimum
const weeksSinceLastBout = calculateWeeksSince(
  fighter.career.lastBoutYear,
  fighter.career.lastBoutWeek,
  currentYear,
  currentWeek
)
const minWeeksBetweenBouts = fighter.competition.amateur.wins + fighter.competition.amateur.losses > 20
  ? 6
  : 8
if (weeksSinceLastBout < minWeeksBetweenBouts) return false
```

Also check if the event generation is creating too many events per city per year. If Riga has 20 club cards per year and a fighter enters all of them, the bout count explodes.

---

## Fix 6 — USA Competing Fighters at 0-0

This is a consequence of Fix 1. Once USA events generate and USA fighters compete, their records will populate. No separate fix needed — verify after Fix 1 is applied.

However also check: USA fighters are marked `competing` in identity state despite never having competed. The `aspiring → competing` transition should only happen when a fighter actually enters and completes a bout — not on a probability roll alone.

**Location:** `packages/engine/src/engine/identityTick.ts` and `packages/engine/src/engine/eventTick.ts`

The `competing` state should be set in `eventTick` when a fighter completes their first bout — not in `identityTick` as a probability transition. A fighter is `competing` when they have competed, not when they intend to.

Fix: Remove `aspiring → competing` probability transition from `identityTick`. Instead, in `eventTick`, after a fighter completes their first bout, set their identity state to `competing`.

---

## Verification

After all fixes, run the CLI tool again. Expected output:

```
BOUT RESULTS HEALTH CHECK
KO/TKO        30-40%   ← was 13.1%, too low
Decision      60-70%

ATTRIBUTE DISTRIBUTIONS (latvia fighters)
power    mean: 7-10   ← was 2.5, too low
ring_iq  mean: 3-6    ← was 1.2, appropriate range

GYM FINANCIALS (latvia)
Most profitable: €20,000-€80,000   ← was €3.8M, absurd

TOP FIGHTERS BY RECORD
1. Fighter  12-2   ← was 132-1, unrealistic
```

---

### Definition Of Done
- [ ] Fix 1 — USA bouts > 0 after backrun
- [ ] Fix 2 — Latvia attribute means: power ~8, chin ~8, ring_iq ~3-5
- [ ] Fix 3 — Retired fighters < 30% of total Latvia fighters
- [ ] Fix 4 — Most profitable gym < €100,000 after 10 years
- [ ] Fix 5 — Top fighter record < 60 bouts total
- [ ] Fix 6 — USA competing fighters have real records
- [ ] Run CLI tool and paste output to verify all six fixes
- [ ] `pnpm typecheck` clean
- [ ] `pnpm test` passing
- [ ] `bash .claude/hooks/stop.sh` passes
- [ ] Committed: `fix: simulation calibration`

### Notes
- Fix in order — Fix 1 (USA events) and Fix 2 (attribute application) are the most critical
- Fix 6 resolves automatically once Fix 1 is done
- Do not change attribute gain values in attribute-accumulation.json until confirming events are being applied — the values may be correct, the application may be broken
- After each fix, run the CLI tool to verify before moving to the next
- The retirement probability reduction (Fix 3) should be conservative — we want fighters to have careers, not fight forever
