import re

path = 'd:/gla_coach/src/app/(main)/training/[id]/page.tsx'

with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# Replace group on the card wrapper
old_wrapper = 'active:scale-[0.98] text-left group ${'
new_wrapper = 'active:scale-[0.98] text-left group/card ${'
content = content.replace(old_wrapper, new_wrapper)

# Replace group-hover for the hole text
old_text = 'group-hover:text-brand-navy transition-colors'
new_text = 'group-hover/card:text-brand-navy transition-colors'
content = content.replace(old_text, new_text)

# Replace group-hover for the chevron
old_chevron = 'shadow-sm group-hover:scale-110 opacity-0 group-hover:opacity-100 transition-all'
new_chevron = 'shadow-sm group-hover/card:scale-110 opacity-0 group-hover/card:opacity-100 transition-all'
content = content.replace(old_chevron, new_chevron)

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)

print("Success")
