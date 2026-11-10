#!/usr/bin/env python3
"""팀 미션 원본(JSON, schemaVersion 2)에서 게임이 쓰는 칸만 골라 src/core/data/missions.json으로 쓴다.

사용: python3 -I tools/import_missions.py docs/missions/틈새정원_90개미션_게임적용데이터_2026-11-08_v2.json
팀이 원본을 고치면 다시 돌린다. 화면에 쓰지 않는 칸(evidenceCodes·why 등)은 원본에만 남는다.
done 칸은 영역마다 형식이 달라(일상은 '기본 / 축소', 학업·업무는 설명 문장) 가져오지 않는다. 버튼은 buttonLabel.
"""
import json
import sys
from pathlib import Path

NPC = {'느리': 'nuri', '모루': 'moru', '피오': 'pio', '새싹이': 'sprout'}
ACADEMIC_INTENT = {'수업 자료': 'course', '과제 자료': 'assignment', '시험 자료': 'exam'}
OUT = Path(__file__).resolve().parent.parent / 'src' / 'core' / 'data' / 'missions.json'


def mission(m):
    e = m['eligibility']
    return {
        'id': m['id'],
        'categoryId': m['categoryId'],
        'stage': m['stage'],
        'stageName': m['stageName'],
        'intentIds': m['intentIds'],
        'npc': NPC[m['npc']],
        'dialogue': m['dialogue'],
        'name': m['name'],
        'basic': m['basic'],
        'small': m['small'],
        'buttonLabel': m['completion']['buttonLabel'],
        'record': m['record'],
        'smallRecord': m['smallRecord'],
        'conditionSummary': m['conditionSummary'],
        'allowedWorkStatuses': e['allowedWorkStatuses'],
        'basicFacts': e['basicRequiredFacts'],
        'smallFacts': e['smallRequiredFacts'],
        'mode': m['mode'],
        'nextId': m['recommendation']['nominalNextId'],
    }


def first(f):
    daily, academic, work = f['일상'], f['학업'], f['업무복귀']
    return {
        'daily': {
            'scenes': [{'label': k, 'missionId': v} for k, v in daily['choices'].items()],
            'previews': daily['fallbackPreviews'],
        },
        'academic': {
            'missionId': academic['default'],
            'targets': [{'label': t, 'intent': ACADEMIC_INTENT[t]} for t in academic['targetChoices']],
        },
        'work': {
            'pre_return': [{'label': k, 'missionId': v} for k, v in work['beforeReturn'].items()],
            'returned': [{'label': k, 'missionId': v} for k, v in work['afterReturn'].items()],
        },
    }


def main(src):
    data = json.loads(Path(src).read_text(encoding='utf-8'))
    if data.get('schemaVersion') != 2:
        sys.exit(f"schemaVersion 2만 읽을 수 있어요: {data.get('schemaVersion')}")
    out = {
        'version': data['version'],
        'first': first(data['firstRecommendations']),
        'missions': [mission(m) for m in data['missions']],
    }
    OUT.write_text(json.dumps(out, ensure_ascii=False, indent=1) + '\n', encoding='utf-8')
    print(f"{len(out['missions'])}개 미션 -> {OUT}")


if __name__ == '__main__':
    main(sys.argv[1])
