# NEXUS player character — NX-01 "Wayfinder"

`NEXUS_Player.glb` is the game-ready export of the Blender source project that lives beside this
repository in `../Blender-1/` (`project/NEXUS_Character.blend`, built procedurally by
`scripts/nx_build.py`). The `.blend` is the source of truth; this GLB is what the game loads.

| Fact | Value |
| --- | --- |
| Units / scale | 1 unit = 1 m, 1.316 m tall, feet on the origin, centred on X |
| Forward | +Z (matches the player's facing axis in `Player.ts`) |
| Geometry | 24 rigid parts, 84 primitives, 45,144 triangles, no textures |
| Materials | NX_ArmorPrimary, NX_ArmorSecondary, NX_Trim, NX_Joint, NX_JointSegment, NX_Visor, NX_EnergyCyan, NX_EnergyBlue, NX_EnergyViolet |
| Rig | 20 bones: Root, Hips, Spine, Chest, Neck, Head, Shoulder/UpperArm/Forearm/Hand (L/R), Thigh/Shin/Foot (L/R); every part weighted 1.0 to one bone |
| Animation clips | none (the game animates the bones procedurally, see `src/player/PlayerAnimation.ts`) |

`src/player/PlayerCharacter.ts` merges the 84 primitives into one skinned mesh with one draw
call per material and clamps the authored emissive strengths (4–6) into the game's bloom range.
Bone and material names above are a contract: keep them when re-exporting.

Re-export from the Blender project (the pipeline validates and writes `exports/NEXUS_Player.glb`):

```powershell
& "C:\Program Files\Blender Foundation\Blender 5.2\blender.exe" -b --python scripts\nx_pipeline.py -- --steps build,validate,export
```

then copy `Blender-1/exports/NEXUS_Player.glb` over this file.
