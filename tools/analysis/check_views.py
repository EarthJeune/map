import json

transcript_path = r'C:\Users\LGU-SanPedro\.gemini\antigravity-ide\brain\b6d2da97-aefb-4be7-8790-50927e71af8b\.system_generated\logs\transcript_full.jsonl'

# Let's inspect step 10430 (it viewed lines 251 to 350)
# And let's check what other view_file or read was done on build_ored_building.py between 5992 and 10453
views = []
with open(transcript_path, 'r', encoding='utf-8') as f:
    for line in f:
        if 'build_ored_building.py' in line:
            d = json.loads(line)
            step = d.get('step_index')
            if d.get('type') == 'VIEW_FILE' and 'build_ored_building.py' in d.get('content', ''):
                views.append(step)

print("View steps:", views)
