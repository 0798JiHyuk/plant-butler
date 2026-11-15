# Map/wayfinding artwork

Built-in imagegen, generated 2026-11-14. Reference: existing public/assets/garden/garden-connected.webp / original A-theme garden. Existing guide and garden art were preserved.

Sources: path-branch.png, wood-wayfinder.png, map-board.png in this directory.
Exports: public/assets/garden/{path-branch,wood-wayfinder,map-board}.png through tools/slice_neighborhood_art.py; called by slice_art.py. Export trims transparent margins, resizes, and feathers branch ends for terrain joins. Scene and mini/large map share the same generated images and worldGeometry.ts coordinates.

## Exact prompts

### path-branch
NEW isolated game environment sprite using the shown garden reference only for style. A horizontal short dirt footpath strip running LEFT to RIGHT, viewed from above like the garden floor reference. Wide panoramic 4:1 strip. Honey beige compacted earth center, subtle warm pixel-painted earth texture, a few flat warm gray stepping stones aligned horizontally. Upper and lower edges organically ragged, tiny sparse sage/moss grass tufts and earth crumbs with softly broken transparent perimeter, not a rectangle. LEFT and RIGHT ends should run fully to the sprite edge for seamless connections. Match the shown warm 2D pixel painted garden, not vector, no heavy dark outline, no border, no raised road curb. No trees, buildings, people, text, or signs. Truly transparent background outside the strip. Used as short left/right branch connecting an existing vertical garden path.

### wood-wayfinder
NEW small isolated wooden wayfinding sign sprite for the supplied warm pixel-painted garden reference. One rustic honey-brown wooden arrow plank pointing RIGHT, mounted on a short sturdy wooden post planted in a tiny subtle moss base. Three-quarter overhead game viewpoint matching garden cottage art, warm upper-left light, muted brown green outline, large readable pixel clusters, handmade rounded wood edges. Broad blank cream honey wood face reserved for game text overlay. Absolutely NO text, lettering, icons, people, buildings or surrounding scenery. Transparent background. Compact clean game prop, not a glossy UI button or vector diagram.

### map-board
NEW isolated village map-board prop matching the shown warm 2D pixel-painted garden cottage reference. Small upright honey wood framed rectangular blank parchment noticeboard on two short sturdy wooden posts. Three-quarter overhead game viewpoint, visible wooden frame depth, softly rounded handmade frame, pale cream parchment blank center, tiny moss at feet, soft upper-left daylight. Compact cozy rustic game-world prop with pixel-painted texture and muted brown green outlines. No text, no map markings, no symbols, no characters, no scenery. Transparent background. The parchment center must be broad and unobstructed for a simple in-game map mark drawn by code.
