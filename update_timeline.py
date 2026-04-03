import re

with open("public/style.css", "r") as f:
    css = f.read()

# 1. Timeline Card adjustments (make it soft and sophisticated)
css = re.sub(
    r'\.timeline-card \{\n  background: var\(--card-bg\);\n  padding: 25px 30px;\n  border-radius: 16px;\n  box-shadow: 0 5px 20px rgba\(0, 0, 0, 0\.05\);\n  border: 1px solid rgba\(255, 255, 255, 0\.5\);\n  transition: all 0\.6s cubic-bezier\(0\.34, 1\.56, 0\.64, 1\);\n  opacity: 0;\n\}',
    '''.timeline-card {
  background: var(--card-bg);
  padding: 32px; /* Uniform padding */
  border-radius: 20px; /* Modern curve */
  box-shadow: var(--shadow-sm);
  border: 1px solid var(--glass-border);
  transition: all 0.8s cubic-bezier(0.2, 0.8, 0.2, 1);
  opacity: 0;
}''',
    css
)

css = re.sub(
    r'\.timeline-step\.scroll-active \.timeline-card \{\n  opacity: 1;\n  transform: translateX\(0\);\n\}',
    '''.timeline-step.scroll-active .timeline-card {
  opacity: 1;
  transform: translateX(0);
  box-shadow: var(--shadow-md);
}''',
    css
)

# 2. Timeline Icon adjustments
css = re.sub(
    r'\.timeline-icon \{\n  width: 60px;\n  height: 60px;\n  background: white;\n  border: 2px solid var\(--brand-green\);\n  border-radius: 50%;\n  position: absolute;\n  left: 50%;\n  transform: translate\(-50%, 0\) scale\(0\);\n  z-index: 10;\n  display: flex;\n  align-items: center;\n  justify-content: center;\n  color: var\(--brand-green\);\n  box-shadow: 0 4px 15px rgba\(0, 0, 0, 0\.1\);\n  transition: transform 0\.6s cubic-bezier\(0\.34, 1\.56, 0\.64, 1\);\n\}',
    '''.timeline-icon {
  width: 56px;
  height: 56px;
  background: var(--card-bg);
  border: 2px solid var(--accent-color);
  border-radius: 50%;
  position: absolute;
  left: 50%;
  transform: translate(-50%, 0) scale(0);
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--accent-color);
  box-shadow: var(--shadow-sm);
  transition: transform 0.6s cubic-bezier(0.34, 1.56, 0.64, 1);
}''',
    css
)

css = re.sub(
    r'body\.dark-mode \.timeline-icon \{\n  background: #1e293b;\n  border-color: #3b82f6;\n  color: #3b82f6;\n\}',
    '''body.dark-mode .timeline-icon {
  background: var(--brand-blue);
  border-color: var(--accent-color);
  color: var(--accent-color);
}''',
    css
)


css = re.sub(
    r'\.timeline-badge \{\n  display: inline-block;\n  padding: 6px 16px;\n  background: rgba\(114, 191, 68, 0\.1\);\n  color: var\(--brand-green\);\n  border-radius: 30px;\n  font-size: 13px;\n  font-weight: 700;\n\}',
    '''.timeline-badge {
  display: inline-block;
  padding: 6px 16px;
  background: color-mix(in srgb, var(--accent-color) 12%, transparent);
  color: var(--accent-hover);
  border-radius: 9999px; /* Pill shape */
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.5px;
  text-transform: uppercase;
}''',
    css
)

css = re.sub(
    r'body\.dark-mode \.timeline-badge \{\n  background: rgba\(59, 130, 246, 0\.1\);\n  color: #3b82f6;\n\}',
    '''body.dark-mode .timeline-badge {
  background: color-mix(in srgb, var(--accent-color) 15%, transparent);
  color: var(--accent-color);
}''',
    css
)

# 3. Features Container Card alignment
css = re.sub(
    r'\.cards-container \{\n  display: grid;\n  grid-template-columns: repeat\(auto-fit, minmax\(300px, 1fr\)\);\n  gap: 30px;\n\}',
    '''.cards-container {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
  gap: 32px; /* Standardize layout rhythm */
}''',
    css
)

css = re.sub(
    r'\.card-icon \{\n  width: 70px;\n  height: 70px;\n  background: rgba\(255, 255, 255, 0\.5\);\n  border-radius: 20px;\n  display: flex;\n  align-items: center;\n  justify-content: center;\n  margin-bottom: 25px;\n  color: var\(--brand-blue\);\n  transition: all 0\.3s;\n\}',
    '''.card-icon {
  width: 64px;
  height: 64px;
  background: rgba(15, 23, 42, 0.04);
  border-radius: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 24px;
  color: var(--brand-blue);
  transition: var(--transition-smooth);
}''',
    css
)

css = re.sub(
    r'body\.dark-mode \.card-icon \{\n  background: rgba\(15, 23, 42, 0\.4\);\n  color: #60a5fa;\n\}',
    '''body.dark-mode .card-icon {
  background: rgba(255, 255, 255, 0.05);
  color: var(--text-primary);
}''',
    css
)

css = re.sub(
    r'\.card:hover \.card-icon \{\n  transform: scale\(1\.1\) rotate\(-5deg\);\n  background: var\(--brand-blue\);\n  color: white;\n\}',
    '''.card:hover .card-icon {
  transform: scale(1.05) translateY(-4px); /* Professional hover feel, less rotation */
  background: var(--brand-blue);
  color: white;
  box-shadow: var(--shadow-md);
}''',
    css
)

css = re.sub(
    r'\.card h2 \{\n  font-size: 1\.5rem;\n  font-weight: 700;\n  color: var\(--text-primary\);\n  margin-bottom: 15px;\n\}',
    '''.card h2 {
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 12px;
  letter-spacing: -0.25px;
}''',
    css
)

css = re.sub(
    r'\.card-cta \{\n  margin-top: 25px;\n  display: flex;\n  align-items: center;\n  gap: 10px;\n  color: var\(--brand-green\);\n  font-weight: 600;\n  font-size: 1rem;\n  transition: all 0\.3s;\n\}',
    '''.card-cta {
  margin-top: auto; /* Push to bottom */
  padding-top: 24px;
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--accent-color);
  font-weight: 600;
  font-size: 0.95rem;
  transition: var(--transition-smooth);
}''',
    css
)

css = re.sub(
    r'\.card-cta svg \{\n  transition: transform 0\.3s;\n\}',
    '''.card-cta svg {
  transition: transform 0.3s cubic-bezier(0.25, 1, 0.5, 1);
}''',
    css
)

css = re.sub(
    r'\.card:hover \.card-cta \{\n  gap: 15px;\n\}',
    '''.card:hover .card-cta {
  gap: 12px; /* Softer movement */
  color: var(--accent-hover);
}''',
    css
)

# Apply and Save
with open("public/style.css", "w") as f:
    f.write(css)

print("Timeline refinement script executed successfully.")
