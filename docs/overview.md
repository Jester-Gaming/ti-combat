# Combat System Overview

## Phase System

Two-tier system: **MetaPhase** (major stage) + **MicroPhase** (step within stage).

**Space combat flow:**

```
SPACE_CANNON_OFFENSE: START -> DICE_ROLL -> ASSIGN_HITS -> END
AFB:                  START -> DICE_ROLL -> ASSIGN_HITS -> END
SPACE_COMBAT:         START -> DICE_ROLL -> ASSIGN_HITS -> END (loops)
COMPLETE
```

**Ground combat flow:**

```
BOMBARDMENT:          START -> DICE_ROLL -> ASSIGN_HITS -> END
SPACE_CANNON_DEFENSE: START -> DICE_ROLL -> ASSIGN_HITS -> END
GROUND_COMBAT:        START -> DICE_ROLL -> ASSIGN_HITS -> END (loops)
COMPLETE
```

## Available Factions

`ARBOREC`, `ARGENT_FLIGHT`, `BARONY_OF_LETNEV`, `CLAN_OF_SAAR`, `COUNCIL_KELERES`, `CRIMSON_REBELLION`, `DEEPWROUGHT_SCHOLARATE`, `EMBERS_OF_MUAAT`, `EMIRATES_OF_HACAN`, `EMPYREAN`, `FEDERATION_OF_SOL`, `FIRMAMENT`, `GHOSTS_OF_CREUSS`, `L1Z1X_MINDNET`, `LAST_BASTION`, `MAHACT_GENE_SORCERERS`, `MENTAK_COALITION`, `NAALU_COLLECTIVE`, `NAAZ_ROKHA_ALLIANCE`, `NEKRO_VIRUS`, `NOMAD`, `OBSIDIAN`, `RAL_NEL`, `SARDAKK_NORR`, `TITANS_OF_UL`, `UNIVERSITIES_OF_JOL_NAR`, `VUILRAITH_CABAL`, `WINNU`, `XXCHA_KINGDOM`, `YIN_BROTHERHOOD`, `YSSARIL_TRIBES`

## Base Unit Types

`WAR_SUN`, `CRUISER`, `DREADNOUGHT`, `DESTROYER`, `PDS`, `CARRIER`, `FIGHTER`, `INFANTRY`, `SPACE_DOCK`, `FLAGSHIP`, `MECH`

## Base Unit Combat Values

Format: `[hitValue, diceCount]`

| Unit        | Combat | Bombardment | AFB    | Space Cannon | Sustain |
| ----------- | ------ | ----------- | ------ | ------------ | ------- |
| WAR_SUN     | [3, 3] | [3, 3]      | —      | —            | yes     |
| DREADNOUGHT | [5, 1] | [5, 1]      | —      | —            | yes     |
| CRUISER     | [7, 1] | —           | —      | —            | —       |
| DESTROYER   | [9, 1] | —           | [9, 2] | —            | —       |
| CARRIER     | [9, 1] | —           | —      | —            | —       |
| FIGHTER     | [9, 1] | —           | —      | —            | —       |
| PDS         | —      | —           | —      | [6, 1]       | —       |
| INFANTRY    | [8, 1] | —           | —      | —            | —       |

Note: Faction-specific units override these values. Use `getFactionUnitConfig(faction)` to check. Notable overrides:

- Sardakk Norr: All combat values improved by 1 (e.g. Cruiser [6, 1])
- Sardakk Norr Dreadnought (Exotrireme): Bombardment [4, 2]
- Jol-Nar: All combat values worsened by 1 (Fragile ability built into faction)
