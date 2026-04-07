# Skill: Moments

Load this skill when writing moment templates in `packages/engine/data/moments/`.

## What Moments Are
The product. The writing that makes the ocean rule work. Generic text kills the game. Specific, alive text makes the world feel real.

## Delivery Types
- `inbox` — player reads when they choose. Observations, non-urgent events.
- `popup` — interrupts. Direct conversations, decisions needed now.

## Writing Rules
- Use real context — names, gym, location, relationships, recent history
- Never generic: "John had a good session" is wrong
- Every moment needs 3+ text variants — same event, different angles
- Trigger conditions must be earned — nothing fires in week one
- Popup choices must have real tradeoffs — no obvious right answer

## Template Schema
```json
{
  "id": "soul_reveal_brave_first_drop",
  "type": "soul_reveal",
  "trait_revealed": "brave",
  "delivery": "inbox",
  "trigger_conditions": {
    "weeks_in_gym_min": 4,
    "event_required": "dropped_in_sparring",
    "trait_not_yet_revealed": "brave"
  },
  "text_variants": [
    "{{fighter_name}} got dropped hard in sparring today — {{opponent_name}} caught him clean. He took a second on the canvas, then got up and went straight back to work. Nobody made a thing of it.",
    "{{opponent_name}} put {{fighter_name}} down during the afternoon session. {{fighter_name}} was up before anyone could react, shaking his head like he was annoyed at himself, not scared.",
    "First time {{fighter_name}} has hit the floor in the gym. He got up, nodded at {{opponent_name}}, and kept going."
  ],
  "outcome_effects": {
    "soul_trait_revealed": { "person_id": "{{fighter_id}}", "trait": "brave" }
  },
  "requires_player_choice": false
}
```
