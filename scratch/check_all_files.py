
import os

def check_file(path):
    try:
        with open(path, 'rb') as f:
            data = f.read()
        data.decode('utf-8')
        return True, None
    except UnicodeDecodeError as e:
        return False, str(e)

root = r'd:\gla_coach\src'
for dirpath, dirnames, filenames in os.walk(root):
    for f in filenames:
        if f.endswith(('.ts', '.tsx', '.js', '.jsx', '.css')):
            full_path = os.path.join(dirpath, f)
            ok, err = check_file(full_path)
            if not ok:
                print(f"INVALID UTF-8 in {full_path}: {err}")
