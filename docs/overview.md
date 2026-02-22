# Combat System Overview

## Phase System

Two-tier system: **MetaPhase** (major stage) + **MicroPhase** (step within stage).

**Space combat flow:**

```
SPACE_CANNON_OFFENSE: DICE_ROLL -> ASSIGN_HITS
SPACE_COMBAT:         START -> [AFB: DICE_ROLL -> ASSIGN_HITS]* -> DICE_ROLL -> ASSIGN_HITS -> END (loops)
COMPLETE
```

\*AFB runs inside round 1 only, between START and DICE_ROLL. After AFB completes, combat continues at SPACE_COMBAT:DICE_ROLL (skipping START). In subsequent rounds, AFB is skipped entirely.

**Ground combat flow:**

```
BOMBARDMENT:          DICE_ROLL -> ASSIGN_HITS
COMMIT_UNITS:         END
SPACE_CANNON_DEFENSE: DICE_ROLL -> ASSIGN_HITS
GROUND_COMBAT:        START -> DICE_ROLL -> ASSIGN_HITS -> END (loops)
COMPLETE
```

## Available Factions

`ARBOREC`, `ARGENT_FLIGHT`, `BARONY_OF_LETNEV`, `CLAN_OF_SAAR`, `COUNCIL_KELERES`, `CRIMSON_REBELLION`, `DEEPWROUGHT_SCHOLARATE`, `EMBERS_OF_MUAAT`, `EMIRATES_OF_HACAN`, `EMPYREAN`, `FEDERATION_OF_SOL`, `FIRMAMENT`, `GHOSTS_OF_CREUSS`, `L1Z1X_MINDNET`, `LAST_BASTION`, `MAHACT_GENE_SORCERERS`, `MENTAK_COALITION`, `NAALU_COLLECTIVE`, `NAAZ_ROKHA_ALLIANCE`, `NEKRO_VIRUS`, `NEUTRAL`, `NOMAD`, `OBSIDIAN`, `RAL_NEL`, `SARDAKK_NORR`, `TITANS_OF_UL`, `UNIVERSITIES_OF_JOL_NAR`, `VUILRAITH_CABAL`, `WINNU`, `XXCHA_KINGDOM`, `YIN_BROTHERHOOD`, `YSSARIL_TRIBES`

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

- Sardakk Norr: `unrelenting` ability applies -1 to hit values at runtime (e.g. Cruiser effectively [6, 1])
- Sardakk Norr Dreadnought (Exotrireme): Bombardment [4, 2] (stat override)
- Jol-Nar: `fragile` ability applies +1 to hit values at runtime (worsens combat)
