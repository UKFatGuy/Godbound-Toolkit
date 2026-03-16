# Godbound Toolkit

A full-function, no-build, browser-based companion app for the **Godbound** TTRPG by Kevin Crawford (Sine Nomine Publishing).

**TL;DR:** Open `index.html` in a modern browser to use the dice roller, combat tracker, and character sheet. All data is saved locally in your browser.

## Features

### Dice Roller
- **Quick dice**: d4, d6, d8, d10, d12, d20, d100 with adjustable count and modifier
- **Custom notation**: free-text rolls like `2d6+3` or `3d8-1`
- **Attack roll**: d20 + attack bonus vs. target AC with HIT / MISS / CRITICAL / FUMBLE
- **Saving throws**: Hardiness, Evasion, Spirit vs. a configurable target number
- **Fray dice**: automatic level-to-notation lookup (1d6 → 2d8 across levels 1–10)
- **Roll history**: last 50 rolls stored in `localStorage`

### Combat Tracker
- Track any number of PCs and NPCs/monsters
- **Initiative**: manual entry or one-click d20 roll for the whole group, auto-sorted
- **HP bars**: colour-coded (green / amber / red), +/- buttons and direct input
- **Effort tracking**: clickable pip system for PC divine power usage
- **Status effects**: add/remove freeform tags per combatant
- **Round counter** with Next / Prev turn controls
- Full combat state persisted to `localStorage` between sessions

### Character Sheet
- **Multiple characters**: create, switch and delete characters; all auto-saved
- **Attributes**: STR / DEX / CON / INT / WIS / CHA with live modifier display
- **Saving throws**: Hardiness, Evasion, Spirit (editable target numbers)
- **Combat stats**: current & max HP, AC, Attack Bonus, Fray Dice (auto from level)
- **Divine resources**: Effort (total / committed-day / committed-scene), Dominion, Influence
- **Words of Power**: choose from all 25 Godbound Words or add a custom one; add Gifts with effort cost, description and active toggle
- **Equipment**: weapons (damage dice, attack modifier), armour (AC bonus), and other items
- **Notes**: freeform text area
- All character data persisted to `localStorage`

## Requirements

- A modern browser (Chrome, Edge, Firefox, Safari).
- No server, build step, or dependencies required.

## Running locally

1. Clone or download this repository.
2. Open `index.html` in your browser.

If your browser blocks local file access for any feature (rare), run a tiny local web server instead, for example:

- Python: `python -m http.server 8000`

Then open `http://localhost:8000`.

## Data storage (localStorage)

This app saves:
- Dice roll history
- Combat tracker state
- Character sheets

…to your browser’s **localStorage** for this site/origin.

### Resetting data

If you need to clear everything:
- Open your browser devtools and clear site data for the page, **or**
- Clear localStorage for this site via your browser settings.

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

## Roadmap (ideas)

- Export/import characters and encounters (JSON)
- Better mobile layout improvements
- Printable / shareable character summaries

## Contributing

Issues and PRs are welcome. If you’re planning a larger change, consider opening an issue first to discuss scope.

## License

No license has been selected yet. If you intend this project to be open source, consider adding a LICENSE file (e.g., MIT, Apache-2.0, GPL-3.0).