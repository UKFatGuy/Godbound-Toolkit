# Godbound Toolkit

A full-function, no-build, browser-based companion app for the **Godbound** TTRPG by Kevin Crawford (Sine Nomine Publishing).

**TL;DR:** Open `index.html` in a modern browser (or run via Node.js/Docker) to use the dice roller, combat tracker, character sheet, data editor, import/export tools, and more. All data is saved locally in your browser and optionally on the server.

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

### Data Editor
- **Word & Gift templates**: create reusable Words of Power (with Gifts) that can be applied to any character with one click
- **Weapon templates**: define standard weapon loadouts and apply them instantly
- **Equipment templates**: store common item sets for quick assignment
- **Stock enemies**: build a roster of named enemies (HP, AC, notes) that populate the Combat Tracker's enemy drop-down

### Import / Export
- **Export**: download a single JSON file containing all characters, data templates, and dice history
- **Import**: load a previously exported file with three modes:
  - **Merge** – add imported characters and templates alongside existing ones (skips ID duplicates)
  - **Replace** – overwrite all local data with the imported file
  - **Cancel** – abort without making changes

### Print & Share
- **Printable summary**: generate a formatted, printer-friendly character summary in a new browser window
- **Shareable URL**: encode a character as a base64 query string (`?share=…`) — paste the link for anyone to import the character without a server

### Themes
Switch between four visual themes via the theme selector in the header:

| Theme | Appearance |
|---|---|
| Dark Fantasy *(default)* | Deep purple / gold |
| High Fantasy | Warm parchment / green |
| Retro Terminal | Green-on-black terminal |
| Sci-Fi | Cyan / dark steel |

Theme preference is saved to `localStorage` and applied immediately on page load.

## Requirements

- A modern browser (Chrome, Edge, Firefox, Safari).
- **Node.js 18+** for server-backed persistence (recommended) or Docker.

## Running locally

### Option A – Node server (recommended)

The Node/Express server enables server-side persistence so data survives clearing browser storage, and works across multiple browser profiles.

```bash
git clone https://github.com/UKFatGuy/Godbound-Toolkit.git
cd Godbound-Toolkit
npm ci
npm start
```

Then open `http://localhost:3000`.

> **Note:** Opening `index.html` directly (via `file://`) still works and falls back to `localStorage`-only storage, but server-backed persistence requires running via `npm start` (or Docker).

### Option B – Docker

See the [Docker instructions](#docker) section below.

## Docker

### Quick start

```bash
# Build the image
docker build -t godbound-toolkit .

# Run with a named volume so data persists across container restarts
docker run --rm -p 3000:3000 -v godbound_data:/app/data godbound-toolkit
```

Open `http://localhost:3000`.

### Using docker compose

```bash
docker compose up --build
```

To stop and remove containers (data is kept in the `godbound_data` volume):

```bash
docker compose down
```

### Changing the port

Pass the `PORT` environment variable at runtime:

```bash
# docker run
docker run --rm -p 8080:8080 -e PORT=8080 -v godbound_data:/app/data godbound-toolkit

# docker compose (set in a .env file or inline)
PORT=8080 docker compose up --build
```

### Persisting data

The container writes all saved data to `/app/data/appdata.json`. Mount a volume or bind mount to that path:

| Method | Command fragment |
|---|---|
| Named volume (recommended) | `-v godbound_data:/app/data` |
| Bind mount | `-v /your/host/path:/app/data` |

Data is preserved across `docker run`/`docker compose up` restarts as long as the volume or bind mount is reused.

## Data storage

This app saves:
- Dice roll history
- Combat tracker state
- Character sheets
- Data Editor templates (words, weapons, equipment, enemies)

When running via the Node server or Docker, data is written server-side to `data/appdata.json` **and** kept in `localStorage`. On page load the app re-hydrates from the server, so data is shared across browser profiles on the same server.

When opened as a plain file (`file://`), the app falls back to `localStorage` only.

### Resetting data

- **Server/Docker**: delete `data/appdata.json` (or the Docker volume) and restart.
- **Browser only**: open devtools and clear site data / localStorage for the page.

## Project Structure

```
index.html          Main entry point
css/
  styles.css        Theme system and all styles (4 switchable themes)
js/
  utils.js          Dice math, rule tables, helpers
  storage.js        localStorage + server-sync wrapper
  theme.js          Theme manager (Dark Fantasy / High Fantasy / Retro Terminal / Sci-Fi)
  dice.js           Dice roller UI logic
  combat.js         Combat tracker UI logic
  character.js      Character sheet UI logic
  dataeditor.js     Data Editor UI logic (word/weapon/equipment/enemy templates)
  importexport.js   Import and export all app data as JSON
  print.js          Print and share character sheets
  app.js            App initialisation and tab navigation
server.js           Express server — static file serving + REST persistence API
```

## Extending the Toolkit

Each module (`GoDice`, `GoCombat`, `GoCharacter`, `GoDataEditor`, `GoImportExport`, `GoPrint`, `GoTheme`) is a plain object in its own file.

To add a new tool:
1. Create `js/mytool.js` and add a `GoMyTool` object with `init()` and `render()` methods.
2. Add a `<section id="mytool-tab">` and a `<button class="tab-btn" data-tab="mytool-tab">` in `index.html`.
3. Load the new script with `<script src="js/mytool.js"></script>`.
4. Call `GoMyTool.init()` from `GoApp.init()` in `app.js`.

## Roadmap (ideas)

- Better mobile layout improvements
- Spell/ability reference look-up
- Session notes / encounter log

## Contributing

Issues and PRs are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md) for branch rules, code style guidelines, and the development setup. If you’re planning a larger change, consider opening an issue first to discuss scope.

## License

No license has been selected yet. If you intend this project to be open source, consider adding a LICENSE file (e.g., MIT, Apache-2.0, GPL-3.0).