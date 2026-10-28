import re

with open('index.html', 'r', encoding='utf-8') as f:
    html = f.read()

with open('app.js', 'r', encoding='utf-8') as f:
    js = f.read()

# Check getElementById references
ids = list(set(re.findall(r'getElementById\([\'"]([^\'"]+)[\'"]\)', js)))
missing = []
for el_id in ids:
    if f'id="{el_id}"' not in html and f"id='{el_id}'" not in html:
        # Dynamic element IDs like page-executive, etc.
        if el_id not in ['page-executive', 'page-failure', 'page-retry', 'page-pending', 'page-refund', 'page-ml']:
            missing.append(el_id)

print(f"Checked {len(ids)} unique getElementById references.")
if missing:
    print("Missing IDs:", missing)
else:
    print("SUCCESS: All getElementById references exist in HTML!")

open_b = js.count('{')
close_b = js.count('}')
print(f"Braces: {open_b} open, {close_b} close (diff = {open_b - close_b})")

open_p = js.count('(')
close_p = js.count(')')
print(f"Parentheses: {open_p} open, {close_p} close (diff = {open_p - close_p})")
