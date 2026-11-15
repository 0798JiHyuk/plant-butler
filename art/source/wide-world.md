# 넓어진 동네 배경

현재 게임은 [네 구역 별도 제작본](world-hd/README.md)을 사용한다. 아래의 단순 분할 방식은 이전 작업 이력이며, 최신 생성 원본·프롬프트·재생성 방법은 `world-hd/`를 기준으로 한다.

- 요청 기준: 사용자가 제공한 전체 동선 도식. 정원은 왼쪽 아래, 집은 정원 위, 모루 상점은 가운데, 카페는 오른쪽 아래, 학교와 직장은 위쪽.
- 스타일 기준: 기존 `garden-world-v2.png`, `art/guide/STYLE_GUIDE.md`의 A 테마.
- 생성: OpenAI image generation, 2026-11-15. 원본 `garden-world-wide.png` (1448×1086), 게임 출력 `public/assets/garden/garden-world-wide.webp` (4096×3072).
- 출력 재생성: `python tools/slice_world_art.py`. 기존 원본은 보존한다.
- 건물·흙길·지도판은 배경에 포함한다. 중복 건물 스프라이트를 올리지 않는다. 카페 벤치는 별도 소품이다.
- 실제 문 앞 위치와 길/충돌/지도 좌표: `src/core/worldGeometry.ts`. 학교·직장은 외관과 앞마당만 제공하며 실내 입장이나 미션 완료를 만들지 않는다.
- 기존 저장 이전: `src/core/worldMigration.ts`. 정원 바깥 배치만 x+256/y+1536, 타일 +8/+48로 한 번 이동한다. 텃밭 슬롯 ID와 실내 배치는 이동하지 않는다. JSON의 `garden.layoutVersion: 2`가 중복 이전을 막는다. 테이블 변경은 없다.

## 생성 프롬프트

### 2026-11-15 네 조각 출력과 지도 안개

- 런타임 배경은 `world-nw.webp`, `world-ne.webp`, `world-sw.webp`, `world-se.webp` 네 장이다. 원본을 확대하기 전에 724×543씩 잘라 무손실 WebP로 출력한다. 네 조각을 복원하면 원본 RGB 픽셀과 정확히 같다.
- `src/core/worldTiles.ts`가 월드의 2048×1536 사분면 좌표를 Phaser와 SVG 지도에 함께 제공한다. 배경에만 LINEAR 필터를 적용하며 캐릭터 필터나 저장 좌표는 바꾸지 않는다.
- 원본의 실제 세부 해상도는 여전히 1448×1086이다. 분할로 새로운 디테일이 생기는 것은 아니며, 확대 재압축과 거친 최근접 샘플링을 피하는 변경이다.
- 지도 미발견 구역은 타원·길 주변의 흐린 경계를 가진 안개로 덮는다. 기존 발견 목록을 사용하므로 DB나 발견 조건은 변경하지 않는다. 미니맵과 전체 지도는 각각 고유한 SVG 필터 ID를 사용한다.

Create a VERY LARGE coherent playable village world background for a cozy 2D pixel-painted garden game. Use reference 1 ONLY for relative building layout, reference 2 for the warm moss green, honey wood, cream stone, upper-left daylight and three-quarter overhead pixel-painting style. This must be finished game scenery, NOT the flat diagram. LANDSCAPE 4:3 canvas, request maximum detail/resolution suitable for a 4096x3072 world. Exactly FIVE buildings, all fully readable with doors facing downward: (1) small round green-roof HOME at x29% y51%, front step/door base at x29% y58%; (2) MORU WOODWORK SHOP at x46% y58%, counter/door base x46% y65%, warm wood counter and blank sign; (3) cozy terracotta-roof CAFE at x77% y61%, door base x77% y68%, small mug sign but NO letters; (4) SCHOOL at x60% y17%, front door base x60% y25%, a slightly larger cream stone schoolhouse with sage roof, small bell and book-shaped emblem, NOT a church; (5) WORKPLACE at x85% y18%, door base x85% y26%, a modest village workshop/office with blue-green roof and a wooden work-lamp emblem, not a skyscraper. School and workplace in UPPER part, home and shop in LOWER LEFT/CENTER, cafe LOWER RIGHT, a broad junction at x61% y52%. A VERY SPACIOUS personal garden occupies LOWER LEFT x7%-37%, y53%-96%, with large leafy shade tree near x12% y57%, open grassy lawns, low stone borders and wooden entrance map board with NO text; leave this whole garden grass area broadly empty for player plants/furniture, especially x16%-29% y57%-70% and x10%-33% y75%-96%. Preserve room for saved garden objects, no central trees or furniture in these lawns. The house belongs to the top-right corner of this garden. Smooth wide winding beige dirt paths are PAINTED INTO the landscape: garden entrance near x22% y71% connects to house x29% y58% AND shop x46% y65%; shop connects diagonally northeast to junction x61% y52%; junction connects southeast to cafe x77% y68% AND north to school x60% y25%; school connects east to workplace x85% y26%. All roads bidirectional, unbroken and broad about 3%-4% canvas width, soft grass edges, a few flat stepping stones, no UI overlays or pasted rectangular road pieces. Build quiet open green spaces between districts with rounded groves and low hedges at outer borders; no rivers, bridges, cliffs, fences blocking roads, vehicles, people or quest props. No text anywhere, no labels, no HUD, no printed diagram arrows. Keep architecture consistently rustic garden A theme. The camera sees the whole connected neighborhood with generous spacing, not a zoomed-in single garden.
