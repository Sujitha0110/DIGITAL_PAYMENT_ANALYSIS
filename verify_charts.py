import re

with open('index.html', 'r', encoding='utf-8') as f:
    html = f.read()

canvases = re.findall(r'id="(chart-[^"]+)"', html)
print(f"Total {len(canvases)} chart canvases in index.html:")
for c in canvases:
    print(f"  * {c}")

with open('app.js', 'r', encoding='utf-8') as f:
    js = f.read()

js_charts = re.findall(r"getElementById\('(chart-[^']+)'\)", js)
print(f"\nTotal {len(js_charts)} chart references in app.js:")
for c in js_charts:
    print(f"  * {c}")


missing_in_js = set(canvases) - set(js_charts)
missing_in_html = set(js_charts) - set(canvases)
print("\nCanvases in HTML but missing in JS:", missing_in_js)
print("Canvases in JS but missing in HTML:", missing_in_html)
