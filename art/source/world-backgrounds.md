# A 테마 확장 배경

- `home-interior.png`: 빈 집 내부. 크림 벽·꿀빛 나무 바닥·세이지 커튼·러그와 아래 중앙 출구. 배치할 가구와 캐릭터·글자는 배경에 포함하지 않음.
- `garden-meadow.png`: 기존 정원 아래 길과 이어지는 빈 마당. 중앙 모랫길, 양옆 빈 잔디와 숲 테두리.
- `garden-connected.png`: 위 두 야외 그림을 맞붙인 경계를 제거하기 위한 통합 아웃페인팅. 실제 게임은 이 한 장을 가로 1266px·세로 1474px로 내보내 사용한다. 원래 정원의 배치 좌표를 보존하도록 가로·세로 비율을 유지한다. 기존 개별 원본은 보존한다.
- `field-planted.png`: 텃밭 두둑 위에 표시하는 낮은 파종 흔적. `garden/field.png`를 스타일 참조로 imagegen에서 투명 배경으로 제작했다. `tools/slice_planted_art.py`로 96px 투명 캔버스에 바닥 정렬해 내보낸다. 맨땅의 기존 `planted-mound.png`와 구분한다.
- `field-planted-marker.png`: 빈 두둑과 구분이 약했던 파종 흔적을 대체하는 현재 텃밭용 그림. 밝은 나무 푯말에 작은 씨앗 문양을 넣고 낮은 흙자리와 결합했다. 같은 텃밭 원본을 스타일 참조로 imagegen에서 제작, 96px 투명 캔버스로 내보낸다. 맨땅 그림과 성장 일정은 바꾸지 않는다.
- 제작: imagegen 내장 도구, 2026-11-12. 기존 `public/assets/garden/background.webp`를 스타일 참조로 사용. 기존 원본·팀 가이드 이미지는 수정하지 않음.
- 기준: `art/guide/STYLE_GUIDE.md`의 A 테마, 따뜻한 2D 픽셀 페인팅·3/4 시점·위/왼쪽 낮빛.
- 재생성된 그림은 기존 그림과 픽셀 단위로 일치하지 않는다. 길 경계·걸을 수 있는 영역·모바일에서의 가구 크기는 런타임에서 검수한다.
- 내보내기: `python tools/slice_world_art.py` (또는 전체 `python tools/slice_art.py`). 원본은 보존하고 게임용 WebP를 `public/assets/garden/`에 만든다.
