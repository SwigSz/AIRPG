# AI RPG - Legacy Game Framework

A browser-based RPG framework featuring generational gameplay, settlement management, and complex character progression systems.

## Overview

This is a framework for a legacy-style RPG where players manage both individual characters and settlements across multiple generations. The game combines elements of character progression, settlement building, exploration, and turn-based combat.

## Features (Framework)

- **Character System**: Skills, stats, traits, professions, and aging mechanics
- **Settlement Management**: Population control, task allocation, resources, and upgrades
- **World & Exploration**: Procedural world generation with multiple biomes and difficulty scaling
- **Combat System**: Turn-based combat with abilities, bestiary, and damage calculations
- **Crafting & Magic**: Recipe-based crafting and custom spell creation
- **Generational Gameplay**: Marriage, children, inheritance, and rebirth mechanics
- **Quest System**: Dynamic quest generation and objective tracking
- **Knowledge Systems**: Libraries, skill books, scrolls, and grimoires

## Project Structure

```
legacy-game/
├── index.html                   # Main entry point
├── README.md                    # This file
├── .gitignore                   # Git ignore file
│
├── assets/                      # Game assets
│   ├── images/                  # Icons, portraits, sprites, backgrounds
│   ├── audio/                   # Music, SFX, ambient sounds
│   └── fonts/                   # Custom fonts
│
├── css/                         # Stylesheets
│   ├── main.css                 # Base styles & layout
│   ├── components/              # UI component styles
│   └── tabs/                    # Tab-specific styles
│
├── js/                          # JavaScript modules
│   ├── main.js                  # Main initialization
│   ├── config.js                # Configuration constants
│   ├── utils.js                 # Utility functions
│   ├── core/                    # Core game systems
│   ├── ui/                      # UI management
│   ├── character/               # Character systems
│   ├── settlement/              # Settlement systems
│   ├── world/                   # World & map systems
│   ├── combat/                  # Combat systems
│   ├── inventory/               # Inventory systems
│   ├── crafting/                # Crafting systems
│   ├── magic/                   # Magic systems
│   ├── knowledge/               # Knowledge systems
│   ├── quest/                   # Quest systems
│   └── progression/             # Progression systems
│
└── data/                        # Game data (JSON)
    ├── skills.json              # Skill definitions
    ├── items.json               # Item database
    ├── enemies.json             # Enemy definitions
    ├── recipes.json             # Crafting recipes
    ├── spells.json              # Spell database
    └── ...                      # Additional data files
```

## Getting Started

1. Open `index.html` in a modern web browser
2. The framework UI will load with placeholder content
3. Navigate between tabs using the left sidebar
4. Use the "Toggle Combat (Demo)" button to test combat view switching

## Current Status

This is a **framework implementation** with:
- ✅ Complete UI layout and styling
- ✅ Tab navigation system
- ✅ Combat view toggle
- ✅ Organized file structure
- ⏳ Placeholder content (awaiting data/logic implementation)

## Development

The project uses vanilla JavaScript with a modular architecture. Each system is organized into its own module for easy maintenance and extension.

### Key Modules

- **UI Management**: Tab switching, modals, notifications, activity log
- **Character System**: Stats, skills, traits, aging, generation
- **Settlement System**: Population, tasks, resources, upgrades
- **Combat System**: Turn-based mechanics, enemies, abilities
- **World System**: Map, exploration, biomes, difficulty scaling
- **Progression**: Marriage, children, inheritance, rebirth

## Time System

The game operates on an accelerated time scale where **1 real second = 1 in-game day**.

## Future Implementation

All game systems are organized and ready for implementation:
- Game state management
- Save/load functionality
- Data-driven content from JSON files
- Full character progression mechanics
- Settlement simulation
- Combat encounters
- Quest generation
- And much more...

## License

[Specify your license here]

## Credits

Created as a framework for a browser-based legacy RPG game.
