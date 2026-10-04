# Wearable art (hats, hair, glasses, clothes, accessories)

Draw the SVG, drop it in the slot folder, run one command. No code to write.

```
assets/wear/
  hat/        crown.svg
  hair/       hairLong.svg   hairLong.back.svg      <- optional layer drawn BEHIND the head
  glasses/    glassesRound.svg
  outfit/     dress.svg      dress.back.svg
  accessory/  scarf.svg
```

## Spec for the designer

| | |
|---|---|
| Canvas | `viewBox="-20 -18 240 276"` (exactly) |
| Head | centred at x = 100; crown of the head y ≈ 32, eyes y ≈ 74, chin y ≈ 140 |
| Body | torso from y ≈ 146 to 216 (outfit / accessory) |
| Outline | `#3A2418`, `stroke-width` 2.5–3, round caps and joins |
| Elements | only `path`, `circle`, `rect`, `g` |
| Attributes | `d cx cy r x y width height rx ry fill fill-opacity fill-rule stroke stroke-width stroke-opacity stroke-linecap stroke-linejoin stroke-dasharray opacity transform` |
| Not allowed | gradients, filters, masks, clip-paths, images, text, `style`, `class`, `id` (convert text to paths) |
| Background | transparent: no full-canvas rectangle |
| Layers | `<key>.svg` is drawn in front of the head/body. `<key>.back.svg` (optional, hair / hat / outfit / accessory) is drawn behind it, e.g. the back of long hair or a cape |

The file name is the item's key: letters and digits only (`hairLong`, `redCape`). The folder is its slot.
A key that already exists in code (`crown`, `scarf`, ...) is **redrawn** by the file; keep its slot.
Files starting with `_` are ignored (use them for drafts).

## Add an item

1. Save the file(s) as above.
2. `pnpm --filter @dozari/mobile wear:build` (checks the SVG and regenerates
   `src/components/wearArt.generated.tsx` and `packages/shared/src/economy/wear-generated.ts`; commit both).
3. Add one shop row (admin panel, «حجره / بازار») with effect `cosmetic`, the same slot, and `iconKey` = the file's key.

`pnpm --filter @dozari/mobile wear:check` fails when the generated files are stale (CI runs it).
