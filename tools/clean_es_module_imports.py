import os
import re

js_dir = 'js'
pattern = re.compile(r"""(from\s+['"][^'"]*?\.js)(\?v=[^'"]+)(['"])""")

total_modified = 0
for root, _, files in os.walk(js_dir):
    for f in files:
        if f.endswith('.js'):
            p = os.path.join(root, f)
            with open(p, 'r', encoding='utf-8') as file:
                content = file.read()
            new_content, count = pattern.subn(r'\1\3', content)
            if count > 0:
                print(f"Modifying {p}: {count} import(s) cleaned")
                with open(p, 'w', encoding='utf-8') as file:
                    file.write(new_content)
                total_modified += count

print(f"\nDone! Cleaned a total of {total_modified} fragmented import query string(s).")

