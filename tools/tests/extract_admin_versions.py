import json

path = r'C:\Users\LGU-SanPedro\.gemini\antigravity\brain\0945f2fe-cc9b-48f2-820c-f986ce3c6a9d\.system_generated\logs\transcript_full.jsonl'
target_lines = [19382, 19389, 19409, 19411, 19427, 19433, 19439, 19445, 19697, 19742, 19772, 20113, 21092, 22136, 22263, 23768]

with open(path, 'r', encoding='utf-8') as f:
    for i, line in enumerate(f, 1):
        if i in target_lines:
            d = json.loads(line)
            step = d.get('step_index')
            tcs = d.get('tool_calls', [])
            for tc in tcs:
                name = tc.get('name')
                args = tc.get('args', {})
                if 'build_rares_admin_building' in str(args.get('Path', '')):
                    print(f"Line {i}, Step {step}, Tool {name}")
                    if name == 'write_file':
                        content = args.get('Content', '')
                        out_file = f"scratch_admin_script_step_{step}.py"
                        with open(out_file, 'w', encoding='utf-8') as out:
                            out.write(content)
                        print(f"  -> Saved {out_file} ({len(content)} chars)")
                    elif name == 'edit_file':
                        print(f"  -> Edit Target: {args.get('Target', '')[:120]}...")
                        print(f"  -> Edit Replacement: {args.get('Replacement', '')[:120]}...")

