
import sys

file_path = r'd:\gla_coach\src\components\schedule\ScheduleCalendar.tsx'

def find_invalid_utf8(path):
    with open(path, 'rb') as f:
        data = f.read()
    
    print(f"File size: {len(data)} bytes")
    
    pos = 0
    errors = 0
    while pos < len(data):
        try:
            data[pos:pos+1].decode('utf-8')
            pos += 1
        except UnicodeDecodeError:
            # Found a start of an invalid sequence
            # Try to decode larger chunks to find the exact boundary
            start = pos
            while pos < len(data):
                try:
                    data[start:pos+1].decode('utf-8')
                    # If this succeeds, the invalid sequence ended before this
                    break
                except UnicodeDecodeError:
                    pos += 1
            
            errors += 1
            print(f"Error {errors} at index {start}:")
            ctx_start = max(0, start - 20)
            ctx_end = min(len(data), start + 20)
            print(f"  Context bytes: {data[ctx_start:ctx_end].hex(' ')}")
            # Try to show characters
            chars = ""
            for i in range(ctx_start, ctx_end):
                b = data[i]
                if 32 <= b <= 126:
                    chars += chr(b)
                else:
                    chars += "."
            print(f"  Context chars: {chars}")
            print("-" * 20)

find_invalid_utf8(file_path)
