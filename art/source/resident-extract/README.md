# 기존 배경 픽셀 추출 지도 · 2026-11-15

이 방식은 사용자 정정으로 교체됐다. 현재 게임은 [새로 제작한 지도 그림](../resident-painted/README.md)을 사용한다. 아래는 이전 추출 방식의 기록이다.

사용자 정정 요청: 다른 그림체로 다시 그리지 않고, 현재 전체 배경에서 나무·돌담·돌과 길을 가져온다.

- 유일한 그림 원본: `art/source/world-hd/stitched.png` (4096×3072). 원본 해시와 크기는 `source.json`에 기록한다.
- `masks.json`: 1440×1080 검토 이미지 기준 추출 범위. 나무는 외곽 다각형, 돌담·길은 원본 위 선 영역, 돌은 개별 영역으로 지정한다. 집과 건물·지도판은 제외한다.
- `tools/extract_resident_maps.py`는 이미지 RGB를 새로 그리거나 색을 바꾸지 않는다. 선택한 부분을 남기고 나머지 알파만 투명하게 만든다. 추출 경계에는 작은 알파 페더를 적용한다.
- 완전 투명한 픽셀의 RGB만 0으로 정리해 숨겨진 전체 배경이 다운로드되는 것을 피한다. 알파가 0보다 큰 모든 픽셀의 RGB는 원본과 동일하다.
- 출력: `public/assets/garden/resident-nature-original.webp`, `resident-roads-original.webp` (무손실 RGBA). 이전 추상 SVG 도형은 사용하지 않는다.
- 피오는 새 무늬를 그리지 않고, 게임 배경 네 조각을 고정 통행 불가 마스크로 잘라 보여준다. 미발견 안개·개인 가구 위치와는 별개다.
- React 프레임·정원 위치·지도 탭·스토리 조건·보상·저장 방식은 그대로 유지한다. '빗금'이라고 부르던 지도 소개 문구만 실제 그림 표현에 맞춘다.
- 검토용 파일: `nature-preview.jpg`, `roads-preview.jpg`. `nature-mask.png`, `roads-mask.png`는 원본 크기의 추출 알파다.

재생성: `python tools/extract_resident_maps.py`. 전체 아트 출력 경로의 `slice_world_art.py`에서도 실행한다.
