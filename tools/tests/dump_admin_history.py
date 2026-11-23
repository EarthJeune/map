import json

path = r'C:\Users\LGU-SanPedro\.gemini\antigravity\brain\0945f2fe-cc9b-48f2-820c-f986ce3c6a9d\.system_generated\logs\transcript.jsonl'
with open(path, 'r', encoding='utf-8') as f:
    for i, line in enumerate(f, 1):
        if i >= 19380:
            d = json.loads(line)
            if d.get('type') == 'USER_INPUT':
                print(f"=== Line {i}, Step {d.get('step_index')} USER_INPUT ===")
                print(d.get('content', '')[:500])
                if d.get('media'):
                    print("Media:", [m.get('uri') for m in d.get('media')])

