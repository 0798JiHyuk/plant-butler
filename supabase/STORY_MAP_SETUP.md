# Story/map v2 integration

## Sources and precedence

- Latest `01_스토리_최종.md` and `02_개발자_구현안.md` (2026-11-14, story-map-v2) are retained in `src/core/data/story-map-source.md` and `story-map-contract.md`.
- `story-map.json` is a local runtime adapter: 34 scenes; 14 revised scenes use only r2 choice IDs. The 20 unchanged scenes retain original IDs from final-6.
- The delivered `00_전체_통합.json` is still final-6 and is not the revised story authority.
- Referenced `08_스토리_개정데이터.json` and `03_지도_스토리_데이터.json` were not supplied. Do not claim conformance with their missing migration/milestone contracts. Replace/compare this explicit MD adapter when they arrive.
- Older Expo/local-only statements do not replace the current React/Vite/Phaser/Supabase implementation. Protected docs were not edited.

## Implemented scope

P0: short opening, board/NPC main-story interactions, story notebook, 34-scene catalog with state-appropriate availability, confirmation cursors, explicit choices, pause/resume, blank/together/own ending, optional temporary name, map layers after actual confirmation. No action/purchase/visit reward prerequisite for ending.

Garden and house remain. Existing lower space now connects shop front, junction and cafe exterior/bench with a bidirectional walkable path. Mini/large maps show known places and short frontier ends; destination/bookmark clicks never move the player or discover a place. The source's diagram coordinates are mapped explicitly to actual world coordinates in exploration.ts/neighborhood.ts.

P0 decoration: inventory instance placement draft, undo, cancel, local transactional save, conflict detection without discarding draft, bench sitting/standing, one basic bench using the existing bench artwork on first home entry. Preview and saved decoration goals never grant ownership or change actual placement. Purchase intents retain a request ID to prevent repeat-tap debit in this client snapshot. This is NOT a claim of server-authoritative economy.

Ambient: fold/restore HUD, mute, reduced-motion setting, basic synthesized cafe ambience after browser gesture; background tabs stop ambience. Physical-device audio/resource verification remains required.

P1 school/work/cafe interior and rotation are intentionally disabled as specified by the staged plan, not disguised as undiscovered playable places. The optional future map shows disabled nodes separately; they never enter the path graph. Help-story entry is hidden until team-verified resources exist.

## Persistence / database

No additional SQL is required. The existing garden_saves.state JSONB and authenticated revision/request-id RPC continue to save the whole snapshot. Added optional fields are `garden.exploration` (version 1), `garden.narrative` (version 2), `settings.folded` and `settings.reducedMotion`. Names/interior continue in their existing fields.

Legacy root version, mission progress, first pouch policy, 3 actual actions/day, prices, seed probabilities, growth, harvest and visit rewards are unchanged. Mission display titles/dialogue/start buttons/after-action lines are updated from final-6 while structured eligibility/recommendation/action text remains intact.

Old story.seen/choices are retained verbatim. Old completed scenes do not imply newly confirmed map facts; old players are not forced into the new opening. No retroactive gifts, rewards or ending choices are generated. Opening and shared first-gift source use the existing free-packet marker so a prior recipient is not granted another pouch.

tryUpdate writes localStorage before committing memory or announcing local success. Existing cloud status remains visible separately: local saved is not server saved. Network failure/conflict uses the existing account sync retry/selection UI. Account changes discard active layout editing without committing another account's draft.

## Verification

- Node 22 typecheck/lint/Vitest/production build.
- Unit coverage includes zero-action ending, unseen layers, duplicate discovery/purchase, insufficient fruit, legacy/new decode, pending name vs blank ending, layout undo/cancel, storage quota failure, revision-like concurrent layout change, and unrelated balance preservation.
- Chrome CDP browser checks use mocked Supabase responses only; never production personal state.
- Live Google OAuth, production Supabase saves and physical devices are not re-certified by these checks.
- New 14-event analytics list was not sent to the existing 12-event PRD table. Resolve the event contract before enabling new collection; no personal text or facts/workStatus are logged.


## Map/story consistency correction (2026-11-14)

The earlier diagram-space mini-map and snapped zone marker were replaced. `core/worldGeometry.ts` is now the source for actual world anchors, walkable road polylines and next-bend guidance. Both maps use the actual garden background, building sprites and branch textures under discovery masks; player position uses exact world coordinates. Proposed school/work nodes are listed separately, never placed at invented world coordinates. Branches join the background's existing central path instead of painting a new flat zigzag over it.

`SpeakerPortrait` reuses the existing NPC front images for every spoken line and choice reply. The reply speaker is resolved from the source attribution, rather than inherited from the previous line. Source line fact keys now record actual confirmed observations. The E01 fourth-stone exchange includes its complete source branch. A new optional narrative origin flag distinguishes new runs from unknown legacy history; a free-packet marker never substitutes for observation history. Old narrative snapshots without this flag use neutral unknown-history wording and preserve all progress.

Story guidance follows confirmed main facts; leaving a choice pending does not repeat an already confirmed map observation. The on-world interaction remains required for board scenes; distant story hints locate the board/NPC on the map instead of opening their dialogue remotely.

No table or RPC changes. Existing snapshots and economy remain valid.


## Google-only / resident atlas revision

The latest user direction replaces guest access and the prior map-layer presentation. Gate entry now requires an existing or newly authenticated Google user and initial account save loading. No anonymous accounts are created and cached anonymous sessions are not accepted for play. Apply the new Google-only migration and disable Anonymous in the dashboard; historical rows are not deleted. Photo verification uses the same Google identity policy. See AUTH_SETUP.md.

`garden-world-v2.webp` contains the complete central and branch paths. The scene and mini-map no longer load or paste path-branch sprites. Old source/reference images are retained, and the obsolete public path-branch export was removed.

Three resident maps use one `resident-map-base.webp` with identical tree/house/entrance geography. Neuri emphasizes shade/stones, Moru clear routes/signs, Pio sound/quiet. They are separate illustrated views, not terrain changes or a correct-map puzzle. The combined view unlocks only after the confirmed board-slot reveal, never in the earlier Pio comparison. C01 can compare the three individual maps without revealing the combined board ending.

Own map editing saves only optional `garden.narrative.mapName` and up to five fixed-place symbols in `garden.narrative.marks`. It does not alter terrain, furniture, rewards, missions or the existing garden HUD name. A name-free map with symbols is allowed. Explicit blank choice, editor cancel and saved own map remain distinct. Old own-map snapshots without mapName continue to display their prior garden name. Existing root version and cloud JSON/RPC shape stay compatible.

Fold and mute are in Settings. A folded screen retains only restoration/map controls, and a seated character retains standing control. Auth setup, SQL and physical-device checks are documented separately.
