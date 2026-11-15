# 온라인 카페 아트

사용자 요청: 기존 맵의 가로/세로 절반인 2048×1536 실내, 기존 따뜻한 그림체, 야외 벤치와 다른 의자 여러 개.

- `interior.png`: 기존 `art/source/home-interior.png`를 스타일 참고로 내장 image_gen 도구에서 새로 제작. 원본 1448×1086, 게임 공간 2048×1536에 표시한다. 테이블/의자는 배경에 굽지 않고 별도 배치한다.
- `chair.png`: `art/guide/theme_a_props.png`를 스타일 참고로 내장 image_gen에서 제작한 투명 배경 1인 쿠션 의자. 야외 벤치 원본을 변경하지 않는다.
- `prompts.json`: 최종 프롬프트와 참고 이미지 경로.
- `python tools/export_cafe_art.py`: `public/assets/garden/cafe/`에 WebP 배경과 alpha-crop한 의자를 출력한다.

좌석과 테이블은 `src/core/cafe.ts`에 고정하며 SQL의 좌표 목록과 함께 변경한다. 카페 스토리와 기존 미션/보상은 바꾸지 않는다.
