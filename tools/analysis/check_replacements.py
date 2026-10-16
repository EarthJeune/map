import json

transcript_path = r'C:\Users\LGU-SanPedro\.gemini\antigravity-ide\brain\b6d2da97-aefb-4be7-8790-50927e71af8b\.system_generated\logs\transcript_full.jsonl'

steps_to_check = [10453, 10459, 10471, 10496, 10502, 10504]

with open(transcript_path, 'r', encoding='utf-8') as f:
    for line in f:
        d = json.loads(line)
        if d.get('step_index') in steps_to_check:
            print(f"=== Step {d['step_index']} ===")
            for tc in d.get('tool_calls', []):
                args = tc.get('args', {})
                print("Instruction:", args.get('Instruction'))
                print("TargetContent:\n", args.get('TargetContent'))
                print("---")
