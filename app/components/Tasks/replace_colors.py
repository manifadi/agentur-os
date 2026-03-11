import re
import sys

def replace_colors(content):
    replacements = {
        r'\bbg-white\b': 'bg-surface',
        r'\bbg-gray-50\b': 'bg-subtle',
        r'\bbg-gray-100\b': 'bg-hover',
        r'\btext-gray-900\b': 'text-text-primary',
        r'\btext-gray-800\b': 'text-text-primary',
        r'\btext-gray-700\b': 'text-text-secondary',
        r'\btext-gray-600\b': 'text-text-secondary',
        r'\btext-gray-500\b': 'text-text-muted',
        r'\btext-gray-400\b': 'text-text-placeholder',
        r'\btext-gray-300\b': 'text-text-placeholder',
        r'\bborder-gray-300\b': 'border-default',
        r'\bborder-gray-200\b': 'border-default',
        r'\bborder-gray-100\b': 'border-default',
        r'\bborder-gray-50\b': 'border-default',
        r'\bbg-blue-600\b': 'bg-accent',
        r'\bbg-blue-500\b': 'bg-accent',
        r'\bbg-blue-50\b': 'bg-accent-subtle',
        r'\btext-blue-600\b': 'text-accent',
        r'\btext-blue-500\b': 'text-accent',
        r'\btext-blue-400\b': 'text-accent',
        r'\bborder-blue-500\b': 'border-accent',
        r'\bborder-blue-400\b': 'border-accent',
        r'\bborder-blue-200\b': 'border-accent',
        r'\bborder-blue-100\b': 'border-accent',
        r'\bring-blue-500\b': 'ring-accent',
        r'\bring-blue-400\b': 'ring-accent',
        r'\btext-gray-900\b': 'text-text-primary'
    }
    for old, new in replacements.items():
        content = re.sub(old, new, content)
    return content

files = [
    '/Users/manuelfadljevic/Documents/_PERSONAL/agentur-os/app/components/Tasks/GlobalTasks.tsx',
    '/Users/manuelfadljevic/Documents/_PERSONAL/agentur-os/app/components/Tasks/TaskHistoryModal.tsx',
    '/Users/manuelfadljevic/Documents/_PERSONAL/agentur-os/app/components/Tasks/TaskDetailSidebar.tsx'
]

for file_path in files:
    with open(file_path, 'r') as f:
        content = f.read()
    
    new_content = replace_colors(content)
    
    with open(file_path, 'w') as f:
        f.write(new_content)

print("Replacement complete.")
