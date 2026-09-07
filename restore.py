import json
import re

log_file = r"C:\Users\owner\.gemini\antigravity-ide\brain\e1d1e3fc-e49d-4768-a736-453566324f3e\.system_generated\logs\transcript.jsonl"
target_file = r"d:\gla_coach\src\app\(main)\training\challenges\create\page.tsx"

lines_extracted = {}

with open(log_file, 'r', encoding='utf-8') as f:
    for line in f:
        try:
            data = json.loads(line)
            if data.get('type') == 'TOOL_RESPONSE' and 'Showing lines' in data.get('content', ''):
                content = data['content']
                for text_line in content.split('\n'):
                    match = re.match(r'^(\d+): (.*)$', text_line)
                    if match:
                        line_num = int(match.group(1))
                        lines_extracted[line_num] = match.group(2)
        except Exception as e:
            pass

if not lines_extracted:
    print("No lines found!")
else:
    max_line = max(lines_extracted.keys())
    print(f"Extracted up to line {max_line}")
    with open(target_file, 'w', encoding='utf-8') as f:
        for i in range(1, max_line + 1):
            if i in lines_extracted:
                f.write(lines_extracted[i] + '\n')
            else:
                f.write('\n')
    print("Restored successfully.")
