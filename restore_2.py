import re

with open("public/style.css", "r") as f:
    css = f.read()

# I will just write regex replacements for what's left.
# E.g. .timeline-badge which was not found before.
css = re.sub(
    r'\.timeline-badge \{[\s\S]*?body\.dark-mode \.timeline-badge \{[\s\S]*?\}',
    '''.timeline-badge {
  display: inline-block;
  padding: 6px 16px;
  background: rgba(114, 191, 68, 0.1);
  color: var(--brand-green);
  border-radius: 30px;
  font-size: 13px;
  font-weight: 700;
}

body.dark-mode .timeline-badge {
  background: rgba(59, 130, 246, 0.1);
  color: #3b82f6;
}''',
    css
)

css = re.sub(
    r'body\.dark-mode \{[\s\S]*?background-color: var\(--bg-color\); /\* Deep luxury dark background \*/\n\}',
    '''body.dark-mode {
  --bg-color: #0f172a;
  --card-bg: rgba(30, 41, 59, 0.7);
  --text-primary: #f1f5f9;
  --text-secondary: #94a3b8;
  --glass-bg: rgba(15, 23, 42, 0.6);
  --glass-border: rgba(255, 255, 255, 0.1);

  background-color: #0f172a; /* Deep luxury dark background */
}''',
    css
)

css = re.sub(
    r'body\.dark-mode \.footer-col ul li a:hover \{\n\s+color: var\(--accent-color\);\n\}',
    '''body.dark-mode .footer-col ul li a:hover {
  color: #72bf44;
}''',
    css
)

css = re.sub(
    r'/\* Scrollbar styling for Dark Mode \*/[\s\S]*?border: 3px solid var\(--brand-blue\);\n\}',
    '''/* Scrollbar styling for Dark Mode */
body.dark-mode::-webkit-scrollbar-track {
  background: #0f172a;
}
body.dark-mode::-webkit-scrollbar-thumb {
  background-color: #334155;
  border: 3px solid #0f172a;
}''',
    css
)

css = re.sub(
    r'\.timeline-icon \{[\s\S]*?body\.dark-mode \.timeline-icon \{[\s\S]*?\}',
    '''.timeline-icon {
  width: 60px;
  height: 60px;
  background: white;
  border: 2px solid var(--brand-green);
  border-radius: 50%;
  position: absolute;
  left: 50%;
  transform: translate(-50%, 0) scale(0);
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--brand-green);
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
  transition: transform 0.6s cubic-bezier(0.34, 1.56, 0.64, 1);
}

body.dark-mode .timeline-icon {
  background: #1e293b;
  border-color: #3b82f6;
  color: #3b82f6;
}''',
    css
)

css = re.sub(
    r':root \{[\s\S]*?--shadow-lg: 0 10px 15px -3px rgba\(0, 0, 0, 0\.1\), 0 4px 6px -2px rgba\(0, 0, 0, 0\.05\);',
    ''':root {
  --bg-color: #f3f4f6; /* Lighter Gray for better contrast */
  --card-bg: #ffffff;
  --text-primary: #1f2937; /* Gray 800 */
  --text-secondary: #4b5563; /* Gray 600 */
  --accent-color: #72bf44; /* Farmkart Green */
  --accent-hover: #5da632;
  --glass-bg: rgba(255, 255, 255, 0.7);
  --glass-border: rgba(255, 255, 255, 0.5);
  --shadow-sm: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
  --shadow-md:
    0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
  --shadow-lg:
    0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);''',
    css
)

with open("public/style.css", "w") as f:
    f.write(css)

print("Done restoring extra targets")
