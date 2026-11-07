# A테마 열매나무 교체 원본

기존 정원과 소품의 따뜻한 2D 픽셀 페인팅에 맞춘 나무 4종이다.
기준 파일은 art/guide/theme_a_props.png와 theme_a_decorated.png이며,
art/guide/STYLE_GUIDE.md 및 production_rules.json을 따른다.
기준 이미지는 변경하지 않았다. AI 이미지 생성 도구로 제작한 원본 PNG를 보존한다.

## 제작 명세

- 대상: tree_young / tree_grown / apple_tree / peach_tree
- 공통: 올라가서 내려다보는 기존 3/4 시점, 황록색 햇빛과 짙은 올리브색 잎,
  따뜻한 갈색 줄기, 단순하고 둥근 수관, 짧은 접촉 그림자, 실제 알파 투명 배경.
- tree_grown을 기준으로 사과/복숭아 열매만 추가하는 편집을 요청했다.
- tree_young은 같은 디자인에서 수관과 가지를 단순화한 어린 나무 변형이다.
- 열매: 사과는 빨간 열매, 복숭아는 살구·분홍색과 중앙 골이 보이는 열매.
- 제외: 배경/지면 타일/화분/텍스트, 실사, 3D 플라스틱, 단순한 벡터 원.

## 내보내기

원본은 실제 1254×1254 RGBA이며 이미지 생성 결과 그대로 보관했다.
python tools/slice_tree_art.py로 이 폴더의 원본 4개만 내보낼 수 있다.
전체 python tools/slice_art.py에도 같은 내보내기를 연결했다.
예전 python tools/make_tree_placeholders.py 명령도 새 원본을 사용한다.

앱 파일은 public/assets/plants의 같은 이름 4개다. 192×192 RGBA,
내용 최대 176px, 바닥 기준 y=188, 아래쪽 중앙 정렬을 사용한다.
생성 알파의 거의 보이지 않는 외곽 노이즈는 알파 8 초과 영역으로 크롭 범위를
측정해 제외하며 크롭 안의 색/알파는 보존한다. 재색칠·배경 제거는 하지 않는다.
실제 원본 크기·크롭 범위·SHA256·출력 범위는 export-manifest.json을 참고한다.

게임의 기존 이름/텍스처 키/표시 크기는 유지한다. 어린 나무 84px, 성목 120px.
성장 날짜·열매 지급량·수확 조건·배치·저장 형식은 바꾸지 않는다.
