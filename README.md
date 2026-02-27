# Godbound Toolkit

A full-function web-app companion for the **Godbound** TTRPG by Kevin Crawford (Sine Nomine Publishing).

## Features

### 🎲 Dice Roller
- **Quick dice** — d4, d6, d8, d10, d12, d20, d100 with adjustable count & modifier
- **Custom notation** — free-text rolls like `2d6+3` or `3d8-1`
- **Attack roll** — d20 + attack bonus vs. target AC with HIT / MISS / CRITICAL / FUMBLE
- **Saving throws** — Hardiness, Evasion, Spirit vs. configurable target number
- **Fray dice** — automatic level-to-notation lookup (1d6 → 2d8 across levels 1–10)
- **Roll history** — last 50 rolls stored in localStorage

### ⚔️ Combat Tracker
- Add any number of PCs and NPCs / monsters
- **Initiative** — manual entry or one-click d20 roll for the whole group, auto-sorted
- **HP bars** — colour-coded (green / amber / red), +/- buttons and direct input
- **Effort tracking** — clickable pip system for PC divine power usage
- **Status effects** — add / remove freeform tags per combatant
- **Round counter** with Next / Prev turn controls
- Full state persisted to localStorage between sessions

### 📜 Character Sheet
- **Multiple characters** — create, switch and delete characters; all auto-saved
- **Attributes** (STR / DEX / CON / INT / WIS / CHA) with live modifier display
- **Saving throws** — Hardiness, Evasion, Spirit (editable target numbers)
- **Combat stats** — current & max HP, AC, Attack Bonus, Fray Dice (auto from level)
- **Divine Resources** — Effort (total / committed-day / committed-scene), Dominion, Influence
- **Words of Power** — choose from all 25 Godbound Words or add a custom one; add Gifts with effort cost, description and active toggle
- **Equipment** — Weapons (damage dice, attack modifier), Armour (AC bonus), Other items
- **Notes** — freeform text area
- All data persisted to localStorage

## Usage

Open `index.html` in any modern browser — no build step or server required.

## Project Structure

```
index.html          Main entry point
css/
  styles.css        Dark fantasy theme
js/
  utils.js          Dice math, rule tables, helpers
  storage.js        localStorage wrapper
  dice.js           Dice roller UI logic
  combat.js         Combat tracker UI logic
  character.js      Character sheet UI logic
  app.js            App initialisation and tab navigation
```

## Extending the Toolkit

Each module (`GoDice`, `GoCombat`, `GoCharacter`) is a plain object in its own file.
To add a new tool:
1. Create `js/mytool.js` and add a `GoMyTool` object with `init()` and `render()` methods.
2. Add a `<section id="mytool-tab">` and a `<button class="tab-btn" data-tab="mytool-tab">` in `index.html`.
3. Load the new script with `<script src="js/mytool.js"></script>`.
4. Call `GoMyTool.init()` from `GoApp.init()` in `app.js`.
