# Smithing Sprites Organization

This folder contains all sprites related to the smithing/metalworking system, organized by metal type.

## Folder Structure

```
smithing/
├── copper/
│   ├── ingot.png
│   ├── worked_ingot.png
│   ├── shortsword_head.png
│   ├── longsword_blade.png
│   ├── greatsword_blade.png
│   ├── dagger_blade.png
│   ├── axe_head.png
│   └── spear_head.png
├── iron/
│   └── (same structure as copper)
├── steel/
│   └── (same structure as copper)
├── gold/
│   └── (same structure as copper)
├── silver/
│   └── (same structure as copper)
└── mithril/
    └── (same structure as copper)
```

## Naming Conventions

Each metal folder should contain:

### Base Sprites (Required)
- `ingot.png` - The raw ingot before working
- `worked_ingot.png` - The ingot after initial hammering (flattened/shaped)

### Weapon Heads/Blades (Add as needed)
- `shortsword_head.png` - Shortsword weapon head
- `longsword_blade.png` - Longsword blade
- `greatsword_blade.png` - Greatsword blade
- `dagger_blade.png` - Dagger blade
- `axe_head.png` - Axe head
- `spear_head.png` - Spear head

## Adding New Metals

To add a new metal type:

1. Create a new folder with the metal name in **lowercase** (e.g., `titanium/`)
2. Add the required sprites following the naming convention above
3. Add the metal to `data/materials.json`
4. The system will automatically recognize and use the new metal

## Adding New Weapon Types

To add a new weapon type:

1. Add sprites for all existing metals following the pattern: `{weapontype}_{part}.png`
   - Example: `warhammer_head.png`
2. Update `data/hammering-config.json` with the new weapon type configuration
3. The sprite path will be: `assets/sprites/smithing/{metal}/{weapontype}_{part}.png`

## How The System Works

The sprite paths use a template system:
- `{metal}` placeholder gets replaced with the lowercase metal name
- Example: `assets/sprites/smithing/{metal}/longsword_blade.png`
  - Becomes: `assets/sprites/smithing/copper/longsword_blade.png` for copper
  - Becomes: `assets/sprites/smithing/iron/longsword_blade.png` for iron

This allows the same weapon type configuration to work for all metals automatically.
