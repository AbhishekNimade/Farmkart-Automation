import re

with open("public/style.css", "r") as f:
    css = f.read()

# 1. Update Root variables for premium typography and structure
css = re.sub(
    r':root \{[\s\S]*?--shadow-lg:[^\n]*;\n\}',
    ''':root {
  --bg-color: #f8fafc; /* Crisp, clean, professional light background */
  --card-bg: #ffffff;
  --text-primary: #0f172a; /* Deep Slate 900 */
  --text-secondary: #475569; /* Slate 600 - Perfect for reading */
  --accent-color: #10b981; /* Premium Emerald */
  --accent-hover: #059669;
  --brand-blue: #1e293b;
  --brand-green: #10b981;
  --glass-bg: rgba(255, 255, 255, 0.85);
  --glass-border: rgba(255, 255, 255, 0.4);
  /* Smooth, layered, professional shadows */
  --shadow-sm: 0 2px 4px rgba(15, 23, 42, 0.04);
  --shadow-md: 0 4px 12px rgba(15, 23, 42, 0.06), 0 2px 4px rgba(15, 23, 42, 0.04);
  --shadow-lg: 0 12px 24px rgba(15, 23, 42, 0.08), 0 4px 8px rgba(15, 23, 42, 0.04);
  --shadow-hover: 0 20px 32px rgba(15, 23, 42, 0.12), 0 8px 16px rgba(15, 23, 42, 0.08); /* Elevated hover */
  --transition-smooth: all 0.3s cubic-bezier(0.25, 1, 0.5, 1);
}''',
    css
)

# 2. Update typography baseline
css = re.sub(
    r'body \{\n  font-family: "Inter", sans-serif;\n  background-color: var\(--bg-color\);',
    '''body {
  font-family: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  background-color: var(--bg-color);
  color: var(--text-primary);
  line-height: 1.6;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;''',
    css
)

# 3. Enhance container padding
css = re.sub(
    r'\.app-container \{\n  width: 100%;\n  max-width: 1200px;\n  margin: 140px auto 40px;\n  padding: 0 20px;\n  flex: 1;\n\}',
    '''.app-container {
  width: 100%;
  max-width: 1280px; /* Slightly wider modern saas feel */
  margin: 120px auto 60px;
  padding: 0 32px;
  flex: 1;
}''',
    css
)

# 4. Stat Card professional styling
css = re.sub(
    r'\.stat-card \{\n  background: rgba\(255, 255, 255, 0\.3\);[\s\S]*?overflow: hidden;\n\}',
    '''.stat-card {
  background: var(--card-bg); /* Opaque background is better for reading than heavy blur */
  padding: 32px 24px;
  border-radius: 20px;
  box-shadow: var(--shadow-sm);
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  transition: var(--transition-smooth);
  border: 1px solid rgba(15, 23, 42, 0.04);
  position: relative;
  overflow: hidden;
}''',
    css
)

css = re.sub(
    r'\.stat-card:hover \{\n  transform: translateY\(-8px\);[\s\S]*?background: rgba\(255, 255, 255, 0\.4\);\n\}',
    '''.stat-card:hover {
  transform: translateY(-6px); /* Very subtle elegant lift */
  box-shadow: var(--shadow-hover);
  border-color: rgba(15, 23, 42, 0.08);
}''',
    css
)

css = re.sub(
    r'\.stat-icon \{\n  width: 56px;\n  height: 56px;\n  margin-bottom: 18px;\n  border-radius: 16px;\n  display: flex;\n  align-items: center;\n  justify-content: center;\n  color: var\(--icon-color\);\n  background: color-mix\(in srgb, var\(--icon-color\) 10%, transparent\);\n  backdrop-filter: blur\(10px\);\n  border: 1px solid rgba\(255, 255, 255, 0\.3\);\n\}',
    '''.stat-icon {
  width: 48px; /* Slightly tighter proportion */
  height: 48px;
  margin-bottom: 24px;
  border-radius: 12px; /* Modern minimal curve */
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--icon-color);
  background: color-mix(in srgb, var(--icon-color) 8%, transparent);
  border: 1px solid color-mix(in srgb, var(--icon-color) 15%, transparent);
}''',
    css
)

css = re.sub(
    r'\.stat-icon svg \{\n  width: 30px;\n  height: 30px;\n\}',
    '''.stat-icon svg {
  width: 24px;
  height: 24px;
  stroke-width: 2.5px; /* Thicker strokes look more modern */
}''',
    css
)

css = re.sub(
    r'\.stat-card h3 \{\n  font-size: 12px;\n  font-weight: 700;\n  color: var\(--text-secondary\);\n  text-transform: uppercase;\n  letter-spacing: 0\.8px;\n  margin-bottom: 10px;\n\}',
    '''.stat-card h3 {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 12px;
}''',
    css
)

css = re.sub(
    r'\.stat-value \{\n  font-size: 32px;\n  font-weight: 800;\n  color: var\(--icon-color\); /\* Original styling \*/\n  letter-spacing: -0\.5px;\n\}',
    '''.stat-value {
  font-size: 36px;
  font-weight: 700; /* Proportional weight */
  color: var(--icon-color);
  letter-spacing: -1px;
}''',
    css
)

# 5. Fix Dark mode depth
css = re.sub(
    r'body\.dark-mode \{\n  --bg-color: #0f172a;\n  --card-bg: rgba\(30, 41, 59, 0\.7\);\n  --text-primary: #f1f5f9;\n  --text-secondary: #94a3b8;\n  --glass-bg: rgba\(15, 23, 42, 0\.6\);\n  --glass-border: rgba\(255, 255, 255, 0\.1\);\n\n  background-color: #0f172a; /\* Deep luxury dark background \*/\n\}',
    '''body.dark-mode {
  --bg-color: #020617; /* Deepest professional slate */
  --card-bg: #0f172a; /* Slate 900 for cards, opaque not blured */
  --text-primary: #f8fafc; /* Crisp readable light text */
  --text-secondary: #94a3b8; /* Soft readable sub-text */
  --glass-bg: rgba(15, 23, 42, 0.85);
  --glass-border: rgba(255, 255, 255, 0.06); /* Very subtle glass border */
  
  --shadow-sm: 0 2px 4px rgba(0, 0, 0, 0.3);
  --shadow-md: 0 4px 12px rgba(0, 0, 0, 0.4);
  --shadow-hover: 0 20px 32px rgba(0, 0, 0, 0.5), 0 8px 16px rgba(0, 0, 0, 0.4);

  background-color: var(--bg-color);
}''',
    css
)

# 6. Smooth Feature Cards Interaction
css = re.sub(
    r'\.card \{\n  background: var\(--glass-bg\);[\s\S]*?padding: 30px;\n\}',
    '''.card {
  background: var(--card-bg);
  border-radius: 20px;
  overflow: hidden;
  box-shadow: var(--shadow-sm);
  transition: var(--transition-smooth);
  position: relative;
  border: 1px solid var(--glass-border);
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  text-align: left; /* SaaS cards are usually left-aligned */
  padding: 32px;
}''',
    css
)

css = re.sub(
    r'\.card:hover \{\n  transform: translateY\(-10px\);\n  box-shadow: 0 20px 40px rgba\(0, 0, 0, 0\.12\);\n  border-color: rgba\(255, 255, 255, 0\.6\);\n\}',
    '''.card:hover {
  transform: translateY(-8px);
  box-shadow: var(--shadow-hover);
  border-color: rgba(255, 255, 255, 0.2);
}''',
    css
)

# Apply and Save
with open("public/style.css", "w") as f:
    f.write(css)

print("UX refinement script executed successfully.")
