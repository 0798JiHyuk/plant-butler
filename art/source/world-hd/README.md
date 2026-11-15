# 네 구역 별도 제작 배경

2026-11-15 사용자 요청에 따라 기존 이미지를 단순히 자르는 대신 네 구역을 각각 다시 제작했다.
OpenAI 내장 `image_gen` 편집 기능을 사용했으며, 최종 생성 프롬프트는 `prompts.json`에 보관한다.

- 편집 대상: `references/nw.png`, `ne.png`, `sw.png`, `se.png` (이전 전체 배경의 겹침 있는 구역).
- 공통 스타일 참조: 원본 `art/guide/theme_a_empty.png`. 기준 원본을 수정하지 않았다.
- 생성 원본: `nw.png`, `ne.png`, `sw.png`, `se.png`, 각각 실제 1435×1096. 요청 크기보다 생성 도구 출력이 작으므로 네 구역이 각각 네이티브 2048 해상도라고 표현하지 않는다.
- 이전 단순 분할 조각은 724×543이었다. 새 결과는 각 구역의 세부 표현을 따로 그린 것이며, 동일한 저해상도 원본을 확대만 한 결과가 아니다.
- `layout.json`은 4096×3072 월드에서 각 구역의 범위와 겹침 폭을 정의한다. 기존 저장 좌표와 충돌 좌표를 변경하지 않는다.
- `tools/stitch_world_hd.py`: Pillow/numpy를 사용하는 아트 도구. 겹침 영역의 색·밝기를 맞추고 차이가 적은 경로로 접합선을 정한 뒤 좁은 가장자리를 혼합한다. 지붕·길이 두 겹으로 보이지 않도록 넓은 단순 투명도 혼합을 피한다.
- `stitched.png`: 최종 4096×3072 합성 원본. `preview.jpg`는 검토용 축소본. 실제 생성 크기와 월드 범위는 `report.json`에 남긴다.
- `tools/slice_world_art.py`: 합성 원본을 2048×1536 네 장의 무손실 WebP로 출력한다. 파일은 `public/assets/garden/world-hd-{nw,ne,sw,se}.webp`이며 기존 배경 파일은 보존한다.
- 게임과 지도는 `src/core/worldTiles.ts`의 새 파일명을 공유한다. 기존 안개·발견·계정 저장 정책은 유지한다.

재생성 순서:

```powershell
python tools/stitch_world_hd.py
python tools/slice_world_art.py
```

최종 이미지의 확대 표시에는 여전히 한계가 있다. 출력 픽셀 크기와 생성된 원본 세부 해상도를 구분한다.
