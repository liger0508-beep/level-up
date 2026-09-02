import json

filepath = r'D:\gla_coach\voice_dataset\AI_Voice_Trainer.ipynb'

with open(filepath, 'r', encoding='utf-8') as f:
    notebook = json.load(f)

# Find the code cell that clones rhasspy/piper-train.git
modified = False
for cell in notebook.get('cells', []):
    if cell.get('cell_type') == 'code':
        source = cell.get('source', [])
        # Check if it contains the old git clone command
        has_target = False
        for line in source:
            if 'piper-train.git' in line:
                has_target = True
                break
        
        if has_target:
            print("Found target cell!")
            new_source = []
            for line in source:
                if 'git clone https://github.com/rhasspy/piper-train.git' in line:
                    new_source.append(line.replace('git clone https://github.com/rhasspy/piper-train.git', 'git clone https://github.com/rhasspy/piper.git'))
                elif 'piper-train' in line and '%cd piper-train' in line:
                    # Replace %cd piper-train with cloning setup
                    # We will insert commands right after cloning, so we don't do it here
                    pass
                elif 'requirements.txt' in line:
                    new_source.append('     "!mv piper/src/python /content/piper-train\\n",\n')
                    new_source.append('     "!rm -rf piper\\n",\n')
                    new_source.append('     "%cd /content/piper-train\\n",\n')
                    new_source.append(line)
                elif 'src/python/piper_train/vits/monotonicalign' in line:
                    new_source.append(line.replace('src/python/piper_train/vits/monotonicalign', 'piper_train/vits/monotonicalign'))
                else:
                    new_source.append(line)
            
            # Filter out any duplicate cd's or None values
            cell['source'] = [s for s in new_source if s]
            modified = True
            break

if modified:
    with open(filepath, 'w', encoding='utf-8') as f:
        json.dump(notebook, f, ensure_ascii=False, indent=1)
    print("Notebook successfully updated!")
else:
    print("Could not find the target cell to modify.")
