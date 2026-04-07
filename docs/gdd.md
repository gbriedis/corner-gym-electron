# Corner Gym — Game Design Document
> Version 1.0
> Rule: If it doesn't serve a purpose, it's not in the game.

---

## 1. What Is Corner Gym

Corner Gym is a boxing simulation game. You are the owner of a gym — not a promoter, not a fighter. You took a brave decision to rent a space, and now you live with the consequences of that decision.

The game is about life. Fighters come in young, raw, and unproven. You observe them, train them, find them fights, and watch them become something — or not. Your reputation grows with theirs. The gym outlives everyone in it. There is no end. There is only the next generation coming up behind the last.

---

## 2. Platform & Tech

- **Engine:** Electron + React
- **Primary target:** Steam (desktop)
- **Secondary target:** Mobile (later)
- **Philosophy:** Feels like a game, not a website.
- **Data rule:** Everything is JSON. The backend reads data. Nothing is hardcoded. Ever.
- **Storage:** SQLite for long-term save data. JSON for configuration and schemas.

---

## 3. Core Philosophy

- Numbers live in the engine. Behavior lives on screen. Players never see raw stats.
- If it doesn't serve a purpose, it's not in the game.
- No graphics for v1. Atmosphere comes from text, UI, and moments.
- Sandbox. No end state. Infinite loop.
- The world is fully simulated in depth where it matters, faked intelligently where it doesn't.
- Architecture carries the full vision from day one. V1 is the first neighborhood. The city was always the plan.

---

## 4. Build Philosophy — V1 and Beyond

### The Core Principle
V1 is not a small game that grows into a big game. V1 is the full architecture populated with one nation. Every schema, every system, every engine component is built to carry the complete vision. What changes between V1 and V2 is what gets populated and activated — not how the foundations are built.

### What Is Hard and Takes Real Thought
- The simulation engine — how advance week calculates everything
- The moment system — how soul trait reveals are triggered, written, feel real
- The event text and dialog writing — this is the product
- The UI — feels like a game, not a spreadsheet
- Balance — finances, development curves, fight frequency feeling right

### What Claude Code Populates Fast
- Names (first, last, regional) — minutes
- Cities and locations with modifiers — minutes
- Equipment lists and costs — minutes
- Amateur event calendars — minutes
- Location modifier values — minutes

### V1 Scope
One nation — Latvia. Real cities, real regional modifiers. Valmiera as starting point. A generated population with soul traits, physical gifts, backgrounds. Local amateur circuit running. Core weekly loop feeling alive. Writing good enough that the ocean rule works. Architecture ready for the world.

### Early Game — First Week
The game does not start slow. On day one, a fight is already on the calendar — one of the fighters in the gym has a bout coming. There is already a heartbeat. You are thrown in. Everything unfolds from there.

---

## 5. The World

### Hierarchy
```
Continent → Nation → Region/Subsector → City/Town
```
Each layer stacks modifiers. Location is not a setting — it is a variable that touches everything.

### What Each Layer Defines
- **Genetics pool** — body types, physical tendencies of people born here
- **Style tendencies** — how fighters from this place naturally box
- **Boxing infrastructure** — governing body, amateur scene, pro scene, event frequency, sanctioning bodies
- **Economy** — rent, wages, sponsor money availability
- **Talent density** — size of the fighter pool
- **Rival gym density** — competition for talent and reputation
- **Culture modifiers** — hunger, discipline, ego, loyalty tendencies

### Starting Location
- Player picks starting city at game start
- No relocation. Your city is your story for the run.
- Not better or worse — just a different run.

### Reputation Gravity
- **Early game:** You go to the world. You attend events, scout, travel, run ad campaigns.
- **Late game:** The world comes to you. Fighters from other nations seek out your gym.

### World Simulation — Two Tiers

**Full sim — your proximity.**
Your nation and every entity you have interacted with. Every week fully calculated. Every relationship, every training session, every finance tick. Real depth, real consequences.

**Background sim — the noise.**
Everything else. Results exist. Rankings update. Events happen. Records are real and trackable. But the engine is not burning cycles on weekly training sessions for a fighter in Nigeria you've never touched. When you interact with him — scout him, your fighter gets matched — he gets pulled into full sim. Until then he runs lightweight.

This is how Football Manager handles it. Selected nations run deep. The rest exists coherently but cheaply.

**Everything is still trackable.** The fight happened. The record is real. The career arc is real. You can follow it, cross reference it, look up any fighter in the world. The tier only affects computation depth, not data existence.

| Tier | Who | What runs |
|------|-----|-----------|
| Full sim | Your nation + interacted entities | Everything |
| Background sim | Rest of world | Results, records, rankings, milestones only |

Promotion between tiers happens automatically when proximity increases.

---

## 6. The Gym

### Starting State
Rundown but functional.

| Asset | Condition |
|-------|-----------|
| Mats | Worn |
| Heavy bags | A couple, used |
| Ring | None — space too small |
| Changing rooms | Single shower, basic lockers |
| Reception | Decent — your anchor |
| Strength room | Dumbbells, bench, pull-up bar, squat rack |

### Physical Infrastructure
Square meters are the primary constraint. No ring until space allows. Expand space first, equipment follows. Equipment degrades — maintenance is a deliberate choice.

### Gym Composition
85/10/5 is your starting inheritance, not a permanent model. Composition shifts with reputation and your choices. A pure fighters gym is a valid late game state.

| Group | Starting % | Who They Are |
|-------|-----------|--------------|
| Regulars | ~85% | Pay the bills. Real people with traits and stories. Occasionally one surprises you. |
| Atmosphere | ~10% | Soul of the gym. OGs, journeymen, young teachers. Keep culture alive. |
| Competitors | ~5% | The ones who want to prove something. |

**Kids classes** — revenue now, pipeline later. Summer recap surfaces potential.

### Staff

| Role | Impact |
|------|--------|
| Head coach | Biggest influence on fighter style and gym identity |
| Secondary coach | Supports, fills gaps |
| Fitness coach | Conditioning, injury prevention |
| Maintenance | Equipment condition |

- Early game: gym members fill secondary roles. They have a ceiling.
- As fighters level up, staff must follow.
- Changing head coach shifts gym identity gradually — faster for raw fighters, slower for shaped ones.

### Knowing a Coach Before Hiring
The ocean rule applies to coaches too — but shallower water at the start. A CV tells you the broad strokes — who he trained, his record as a coach, what style he runs. Public coaches have more signal — video, reputation, word of mouth. Low level or private coaches have less. You make an informed bet, not a certain one. The rest you learn after he's in the building.

### Gym Identity
Emerges from who coaches here, who trains here, what fights your fighters take. Not assigned — built over years.

### Accomplishments Wall
Permanent. Amateur titles, tournament wins, Olympic medals, pro belts. Always visible. Changes the atmosphere of the gym.

---

## 7. People

### The Core Principle
Everyone is a real person. Category describes where they are now, not what they are forever.

### How People Arrive
Arrival is a signal, not a guarantee. The first data point. Just the first.

| Method | Signal |
|--------|--------|
| Walk-in | Self-motivated, curious, or desperate |
| Word of mouth | Vouched for |
| Ad campaign | Volume fishing, low signal |
| You scouted them | You saw something |
| Reputation pull | They sought you out — late game |
| Event encounter | Luck meets preparation |

### The Ocean Rule
Surface profile on first meeting — record, background, reason for coming. That is all. Depth reveals over weeks, months, years. You cannot know everything about anyone instantly.

### The Three Layers of a Person

**Layer 1 — Soul Traits** *(permanent)*

Never shown as numbers. Expressed through behavior. Revealed through moments.

| Trait | Opposite |
|-------|----------|
| Brave | Craven |
| Calm | Panicky |
| Humble | Arrogant |
| Patient | Impatient |
| Trusting | Paranoid |
| Disciplined | Reckless |
| Determined | Fragile |
| Hungry | Content |

**Layer 2 — Physical Gifts** *(genetic, mostly fixed)*

Injury resilience, power ceiling, gas tank, hand speed, chin, recovery rate. Discovered through training, sparring, fights. Sometimes the hard way.

**Layer 3 — Health & Body** *(accumulates over career)*

Hands, jaw, ribs, knees, shoulders — each with injury history and resilience. Cut history. Accumulated damage. Three injury tiers: minor, medium, career-threatening.

**Layer 4 — Style** *(emerges over time)*

How they move. How they use what they have. Not assigned — emerges from soul traits, physical gifts, coaching, experience. Pressure fighter, counterpuncher, boxer, brawler — these are outcomes, not inputs.

**Layer 5 — Developed Attributes** *(shaped by environment)*

Technique, ring IQ, combination work, defensive awareness, footwork. Grow through training and — critically — through fights.

### Training Has a Ceiling — Fighting Breaks Through It
A fighter who hasn't fought in a long time stagnates. Development curve flattens. You see it. The atmosphere guys notice. Certain things only unlock through actual combat.

### Soul Trait Reveals
Through natural events — never menus.

- Dropped in sparring — gets up quiet or makes excuses?
- Outboxed for 6 rounds — does he keep coming?
- Rival gym offers better terms — does he come to tell you himself?
- Misses two sessions, comes back and gets straight to work — life or character?

Some traits surface in weeks. Some take years.

---

## 8. Relationships

### The Web
Relationships are earned through contact. A relationship only exists between two people who have actually interacted — shared a training session, had a conversation, been in the same room for something that mattered. You've never met — no relationship exists yet.

As proximity increases, the relationship deepens. As someone goes inactive or leaves, the relationship goes dormant but is never deleted. History matters.

This means the engine never tracks all-to-all. It tracks what has actually happened between people.

| Relationship | Notes |
|-------------|-------|
| Fighter ↔ You | Trust, satisfaction, openness |
| Fighter ↔ Coach | Belief, coachability, friction |
| Fighter ↔ Fighter | Bond, rivalry, tolerance, respect |
| Coach ↔ You | Alignment, trust, communication |

Relationships influence each other. A fighter who trusts you but clashes with the coach puts you in the middle. Two fighters who clash but both respect the coach — the coach is the glue. If the coach leaves, that glue is gone.

### Gym Culture
An emergent property of who's there, how long, and what they've been through together. New arrivals are measured against it automatically. Someone who comes in at the wrong intensity gets read by the gym before you even notice. The gym reacts. Then you find out.

Culture fit plays out over sessions and weeks. Some people assimilate. Some simmer and get pushed out. Some change the culture from inside.

---

## 9. Training

### Philosophy
Training is not a menu. It is not micromanagement. It is life happening in your gym.

### How It Works
The coach runs his plan. His methodology was visible before you hired him — CV, reputation, history. The structural training plan runs automatically. Development calculates silently underneath — coach quality, fighter traits, session type, stagnation state, time since last fight.

You do not touch the training plan directly. That is the coach's job.

### What You See
Moments that happened during training worth surfacing. Not attribute ticks — life.

- A sparring session got heated
- Two fighters clashed and the gym went quiet
- A kid who's been invisible for months looked different — everyone noticed
- Intensity between two fighters has been building for weeks
- A fighter got dropped and something shifted in him

### Relationship Shifts Through Training
Fighters develop relationships with each other through shared sessions. Bonds form. Rivalries simmer. Personality clashes surface. These shifts are tracked in the relationship web and express themselves over time.

---

## 10. The Interaction Model

### Two Layers

**The Inbox — your desk**
Passive information. Things that happened. Things that need a decision that can wait. You read it, act or don't, advance the week.

**The Dialog Popup — you're physically there**
Someone pulled you aside or you walked over. It's happening now. CK3 / Victoria 3 style — situation described in text, you pick A, B, sometimes C. Immediate reaction visible. Outcome ripples forward.

The popup doesn't happen every week. When it does, it has weight.

| Inbox | Dialog Popup |
|-------|-------------|
| Equipment arrived | Fighter wants to talk |
| Revenue change | Coach has a concern |
| World boxing news | Sparring incident needs your call |
| Training observation | Rival gym approached your fighter |
| Scout report | Fighter ready to discuss going pro |
| Reports and reviews | New arrival causing culture friction |

### Modular Reports
You choose what you want reported and how often. Fighter development, finances, gym condition, world boxing news, local scene — each a toggle. Reports speak in language, not numbers.

*"The heavy bags are overdue for maintenance."*
*"Marko has been quiet since the sparring incident two weeks ago."*
*"Revenue has held steady. The kids class is filling up."*

You read direction, not data. The monthly assistant review is the compass — broad strokes, general health, things worth noticing. The detail lives in the moments.

---

## 11. The Moment System

### What It Is
The heart of the game. Every soul trait reveal, relationship shift, training event, and fight aftermath is a moment. Moments are written, triggered, and contextualised by the simulation state.

### How It Works
Each moment type has:
- **Trigger conditions** — specific simulation thresholds that must be met
- **Text variants** — a pool of written versions that draw from real simulation context (real names, real history, real relationships)
- **Delivery method** — inbox or popup
- **Outcome effects** — what changes in the simulation as a result

The template fires at the right time. The context fills it. No two moments feel identical even when the underlying trigger is the same — because the names, history, and relationships are always different.

### Trigger Discipline
Moments fire at the right time — not too early, not too late. A soul trait reveal cannot happen in week one. It must be earned by time and circumstance. The trigger conditions enforce this. The writing quality is the product, but the trigger discipline is what makes the writing land.

### Moment Categories
- Soul trait reveals
- Relationship shifts (positive and negative)
- Training events
- Fight aftermath
- Gym culture events
- Financial pressure events
- World news and boxing events

---

## 12. Fighting

### Your Role
Not a promoter. You find opportunities, prepare fighters, keep them.

### How Fights Happen
- **You go looking** — attend events, watch fighters, hire freelancers for areas you can't reach
- **Information flows** — internet, boxing news, local reputation
- **Promoters come to you** — increases with reputation

### Fight Frequency
Fighter-specific tolerance. Fighter communicates readiness. You always have enough information to make an informed decision.

### Event Types
- **Cards** — multiple bouts, one night
- **Tournaments** — bracket, multiple fights same day, fatigue and damage carry forward

### Amateur vs Pro Transition
Dynamic negotiation. Fighter has own ambitions shaped by soul traits. Up to three conversations depending on trust and track record. No right answer.

### The Olympics
Separate pipeline. Small number ever reach it. Own progression ladder within the amateur structure.

### After the Fight
Win or lose, the fighter comes back different. The gym shifts. People who didn't fight look at those who did differently.

---

## 13. Keeping Fighters

### Loyalty
A relationship growing or eroding every week.

**Builds:** results, belief, atmosphere, track record.
**Erodes:** stagnation, bigger gym calling, bad results with no plan, avoiding hard fights.

### Poaching
Fighter comes to you when it happens. Dialog popup. You respond. You find out how he felt. Life moves on.

### Retirement
No health bar. The fighter tells you. His body tells him. Some leave at 20, some fight at 40. After — some stay as coaches or atmosphere, some leave as legends. Accomplishments stay on the wall forever.

---

## 14. Scouting

- **You go yourself** — events, surface read, approach after
- **Freelancers** — report in inbox, surface info only
- **Internet and news** — fighters making waves surface passively
- **Reputation pull** — late game, world comes to you

---

## 15. Rival Gyms

Exist and operate. Move through the world like you do. Not as intelligent as a human player but active. Poaching rare at low levels, increases with stakes. Your track record and fighter loyalty is your defense.

---

## 16. Finances

Victoria 3 model. Balance act. Collapse is real.

**Income:** member fees, kids classes, fighter earnings cut, private sessions, sponsorships (later)
**Outgoings:** rent, staff wages, equipment, taxes, loans, scouting costs

Loans exist. Degrading equipment is a valid short-term choice. Emergency mechanics exist for near-bankruptcy — prevent irreversible death spirals while keeping stakes real.

---

## 17. The Gym Owner

Project Zomboid model. Point limit at creation. Buffs and debuffs. Traits develop through play.

| Example Trait | Effect |
|--------------|--------|
| Eye for talent | Better surface read on arrivals |
| Trust builder | Fighters open up faster |
| Financial discipline | Slower financial degradation |
| Scout network | Better passive information flow |
| Motivator | Fighters push harder |
| Reckless spender | Debuff — expansion tempts you |
| Impatient | Debuff — harder to hold fighters in amateurs |

---

## 18. The Simulation Engine — Advance Week

### Order of Operations

**1. World ticks**
Background sim resolves. Full sim entities update. Rankings, news, events.

**2. Gym ticks**
Finances move. Equipment degrades. Staff show up or don't.

**3. Training runs**
Each fighter processed. Development calculated silently. Relationship shifts calculated. Moments flagged if thresholds crossed.

**4. People live their lives**
Loyalty shifts. Rival gyms make moves. Culture fit of recent arrivals evaluated.

**5. Events queue**
Everything that crossed a threshold gets queued for delivery.

**6. Surface**
Inbox populated. Dialog popups flagged. Most weeks quiet. Some weeks loud. The ratio is the game.

---

## 19. JSON Schema Skeleton

Everything is data. Nothing hardcoded.

### Person
```
id, name, age, nationality, city_of_origin, region_of_origin
soul_traits: { brave, calm, humble, patient, trusting, disciplined, determined, hungry }
physical_gifts: { injury_resilience, power_ceiling, gas_tank, hand_speed, chin, recovery_rate }
health: { hands, jaw, ribs, knees, shoulders, cut_history, accumulated_damage }
body: { height, reach, stance }
background: { reason_for_boxing, life_circumstances, economic_status }
known_to_player: { soul_traits_revealed: [], gifts_revealed: [], depth_level }
relationships: [ { person_id, temperature, history: [], dormant: bool } ]
```

### Fighter
Extends Person.
```
record: { amateur: [], pro: [] }
current_gym, previous_gyms
status: amateur | pro
style: { archetype, tendencies }
developed_attributes: { technique, ring_iq, combinations, defense, footwork }
ambitions: { amateur_goals: [], pro_goals: [] }
loyalty: { trust, satisfaction, stagnation_state }
fight_frequency_tolerance
retirement_profile: { desired_exit_age, post_boxing_path }
accomplishments: []
```

### Gym
```
id, name, owner_id, location_id
infrastructure: { square_meters, zones: {} }
equipment: [ { type, condition, purchase_date } ]
staff: [ { person_id, role, quality, ceiling } ]
members: [ { person_id, category } ]
finances: { monthly_revenue, monthly_outgoings, balance, loan, gdp_history: [] }
reputation: { local, regional, national, international }
identity: { style_reputation, known_for }
culture: { strength, established_since, defining_traits: [] }
accomplishments: []
```

### Location
```
id, name, type: city|town|village
region_id, nation_id, continent_id
modifiers: { genetics_pool, style_tendency, talent_density, rival_density, economy, infrastructure, culture }
boxing_body
active_events: []
```

### Event
```
id, name, type: card|tournament
date, location_id, promoter_id, sanctioning_body
bouts: []
bracket: {} (tournaments only)
attendance
world_ranking_implications
```

### Bout
```
id, event_id
fighter_a_id, fighter_b_id
result: { winner_id, method, round }
aftermath: { fighter_a_impact, fighter_b_impact }
card_position: main|co-main|prelim
title_implications
```

### World State
```
sim_tier: { full_sim: [], background_sim: [] }
rankings: { amateur: {}, pro: {} }
title_holders: {}
news_feed: []
upcoming_events: []
```

### Moment
```
id, type: soul_reveal|relationship_shift|training_event|fight_aftermath|culture_event|finance_event|world_event
trigger_conditions: {}
delivery: inbox | popup
text_variants: []
outcome_effects: {}
requires_player_choice: bool
choices: [ { label, outcome_effects } ]
```

---

*This document is complete. No open questions. Nothing gets coded without living here first.*
