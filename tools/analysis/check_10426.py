import json

transcript_path = r'C:\Users\LGU-SanPedro\.gemini\antigravity-ide\brain\b6d2da97-aefb-4be7-8790-50927e71af8b\.system_generated\logs\transcript_full.jsonl'

with open(transcript_path, 'r', encoding='utf-8') as f:
    for line in f:
        d = json.loads(line)
        if d.get('step_index') in [10426, 10428, 10430]:
            print(f"=== Step {d['step_index']} ===")
            content = d.get('content', '')
            lines = content.split('\n')
            print(lines[0:5])
            print("Lines count:", len(lines))
