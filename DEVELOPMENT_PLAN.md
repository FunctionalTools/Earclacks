# Earclacks Game Development Plan

## Current Scope Assessment
This is a **major game development project** requiring:
- 40+ unique tank types with distinct mechanics
- Multiple game modes (Battle Royale, Block Breaker, Zombies)
- Complex weapon systems with scaling mechanics
- Save/load game system
- Complete UI overhaul
- Homepage with history

**Estimated effort: 10,000+ lines of code, 20+ hours of development**

## Phase 1: Core Weapons & Foundation ✅ IN PROGRESS
**Goal: Functional game with 10 weapon balls and save system**

### Weapons to Add:
1. ✅ Wrench (already exists - spawns turrets)
2. Sword (+1 damage per hit, rotating blade)
3. Dagger (+attack speed per hit, fast spin)
4. Bow (shoots arrows, +1 arrow per hit)
5. Spear (increases length & damage)
6. Hammer (rotation speed based damage)
7. Shield (deflects projectiles, widens on parry)
8. Staff (shoots fireballs, +0.5 size/damage)
9. Unarmed (speed-based damage, resets on hit)
10. Shuriken (throwing stars with bounces)

### Systems:
- Projectile variety (different sizes, colors, damage)
- Stat scaling per hit
- Rotation-based weapons
- LocalStorage save/load
- Clear map function

## Phase 2: Game Modes
- Battle Royale (shrinking arena)
- Block Breaker mode
- Mode selection on new game
- Victory conditions

## Phase 3: Extended Arsenal
- 12 more weapon balls (Scythe, Scepter, Katana, Flask, etc.)
- Block breaker balls (Grower, Speedy, Duplicator, etc.)
- Fusion ball combinations

## Phase 4: Complete Experience
- History page as homepage
- Professional UI redesign
- Game mode variations
- Zombies mode
- Credits

## Implementation Status
**Current Phase:** Phase 1 (Starting now)
**Files Being Modified:**
- src/main.js (weapon mechanics)
- index.html (UI updates)
- src/style.css (styling)
- New: game-state.js (save/load)

## Next Steps
1. Implement Phase 1 weapons (5-6 at a time)
2. Test and balance each weapon
3. Add save/load system
4. Move to Phase 2

This will be built incrementally to ensure each part works before moving forward.
