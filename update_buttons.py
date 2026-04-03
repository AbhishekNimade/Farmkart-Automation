import re

with open("public/style.css", "r") as f:
    css = f.read()

# Enhance main Call-to-action buttons
css = re.sub(
    r'\.hero-cta \{\n  display: inline-flex;\n  align-items: center;\n  justify-content: center;\n  gap: 12px;\n  background: var\(--accent-color\);\n  color: white;\n  padding: 16px 36px;\n  border-radius: 50px;\n  font-size: 1\.1rem;\n  font-weight: 700;\n  text-transform: uppercase;\n  letter-spacing: 1px;\n  text-decoration: none;\n  transition: all 0\.4s cubic-bezier\(0\.4, 0, 0\.2, 1\);\n  box-shadow: 0 10px 25px rgba\(114, 191, 68, 0\.3\);\n\}',
    '''.hero-cta {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  background: var(--accent-color);
  color: white;
  padding: 16px 32px;
  border-radius: 12px; /* Modern saas buttons are usually subtly rounded, not pill shaped */
  font-size: 1rem;
  font-weight: 600;
  text-transform: none; /* Less aggressive than ALL CAPS */
  letter-spacing: 0.5px;
  text-decoration: none;
  transition: var(--transition-smooth);
  box-shadow: 0 4px 12px rgba(16, 185, 129, 0.2);
}''',
    css
)

css = re.sub(
    r'\.hero-cta:hover \{\n  transform: translateY\(-4px\);\n  box-shadow: 0 15px 35px rgba\(114, 191, 68, 0\.4\);\n  background: var\(--accent-hover\);\n\}',
    '''.hero-cta:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 16px rgba(16, 185, 129, 0.3);
  background: var(--accent-hover);
}''',
    css
)

css = re.sub(
    r'#start-btn \{\n  width: 100%;\n  padding: 16px;\n  background: linear-gradient\(135deg, #72bf44 0%, #5da632 100%\);\n  color: white;\n  border: none;\n  border-radius: 12px;\n  font-size: 16px;\n  font-weight: 700;\n  cursor: pointer;\n  transition: all 0\.3s;\n  box-shadow: 0 4px 12px rgba\(114, 191, 68, 0\.3\);\n  margin-top: 10px;\n\}',
    '''#start-btn {
  width: 100%;
  padding: 16px;
  background: var(--brand-blue); /* Solid slate is more professional than gradient */
  color: white;
  border: none;
  border-radius: 12px;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  transition: var(--transition-smooth);
  box-shadow: var(--shadow-sm);
  margin-top: 10px;
}''',
    css
)

css = re.sub(
    r'#start-btn:hover \{\n  transform: translateY\(-2px\);\n  box-shadow: 0 8px 20px rgba\(114, 191, 68, 0\.4\);\n\}',
    '''#start-btn:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-md);
  background: #334155; /* Lighter slate on hover */
}''',
    css
)

# Enhance section headers
css = re.sub(
    r'\.section-header \{\n  text-align: center;\n  margin-bottom: 50px;\n\}',
    '''.section-header {
  text-align: center;
  margin-bottom: 60px;
}''',
    css
)

css = re.sub(
    r'\.section-header h2 \{\n  font-size: 2\.5rem;\n  font-weight: 800;\n  color: var\(--text-primary\);\n  margin-bottom: 15px;\n\}',
    '''.section-header h2 {
  font-size: 2.25rem;
  font-weight: 700;
  color: var(--text-primary);
  margin-bottom: 16px;
  letter-spacing: -0.5px;
}''',
    css
)

css = re.sub(
    r'\.section-header p \{\n  font-size: 1\.1rem;\n  color: var\(--text-secondary\);\n  max-width: 600px;\n  margin: 0 auto;\n\}',
    '''.section-header p {
  font-size: 1.125rem;
  color: var(--text-secondary);
  max-width: 640px;
  margin: 0 auto;
}''',
    css
)

# Apply and Save
with open("public/style.css", "w") as f:
    f.write(css)

print("Button & Typopgrahy refinement script executed successfully.")
