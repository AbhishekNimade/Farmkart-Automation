import os

file_path = "public/style.css"
with open(file_path, "r") as f:
    content = f.read()

replacements = [
    # 916
    (
        "border: 2px solid var(--accent-color);",
        "border: 2px solid var(--brand-green);"
    ),
    # 908
    (
        """  color: var(--accent-color);
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
  transition: transform 0.6s cubic-bezier(0.34, 1.56, 0.64, 1);
}

body.dark-mode .timeline-icon {
  background: var(--brand-blue);
  border-color: var(--text-secondary); /* Soft Green */
  color: var(--text-secondary);
}""",
        """  color: var(--brand-green);
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
  transition: transform 0.6s cubic-bezier(0.34, 1.56, 0.64, 1);
}

body.dark-mode .timeline-icon {
  background: #1e293b;
  border-color: #3b82f6;
  color: #3b82f6;
}"""
    ),
    (
        """.timeline-badge {
  display: inline-block;
  padding: 6px 16px;
  background: rgba(114, 191, 68, 0.1); /* Green */
  color: var(--accent-color);
  border-radius: 30px;
  font-size: 13px;
  font-weight: 700;
}

body.dark-mode .timeline-badge {
  background: rgba(36, 39, 52, 0.3); /* Blue */
  color: var(--text-secondary); /* Soft green */
}""",
        """.timeline-badge {
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
}"""
    ),
    # 900
    (
        """input:checked + .slider {
  background-color: var(--accent-color);
}""",
        """input:checked + .slider {
  background-color: #72bf44;
}"""
    ),
    (
        """.range-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: var(--accent-color);
  cursor: pointer;
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.2);
}""",
        """.range-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: #72bf44;
  cursor: pointer;
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.2);
}"""
    ),
    (
        """body.dark-mode {
  --bg-color: #242734; /* Brand Blue */
  --card-bg: rgba(58, 64, 86, 0.7); /* Dark Blue-Gray */
  --text-primary: #f1f5f9;
  --text-secondary: #9AD66A; /* Soft Green */
  --glass-bg: rgba(36, 39, 52, 0.6);
  --glass-border: rgba(255, 255, 255, 0.1);

  background-color: var(--bg-color); /* Deep luxury dark background */
}""",
        """body.dark-mode {
  --bg-color: #0f172a;
  --card-bg: rgba(30, 41, 59, 0.7);
  --text-primary: #f1f5f9;
  --text-secondary: #94a3b8;
  --glass-bg: rgba(15, 23, 42, 0.6);
  --glass-border: rgba(255, 255, 255, 0.1);

  background-color: #0f172a; /* Deep luxury dark background */
}"""
    ),
    (
        """  background:
    radial-gradient(
      circle at 20% 30%,
      rgba(114, 191, 68, 0.1) 0%, /* Green */
      transparent 50%
    ),
    radial-gradient(
      circle at 80% 70%,
      rgba(115, 147, 111, 0.1) 0%, /* Light Green */
      transparent 50%
    );""",
        """  background:
    radial-gradient(
      circle at 20% 30%,
      rgba(114, 191, 68, 0.15) 0%,
      transparent 50%
    ),
    radial-gradient(
      circle at 80% 70%,
      rgba(59, 130, 246, 0.15) 0%,
      transparent 50%
    );"""
    ),
    (
        """body.dark-mode .footer-col ul li a:hover {
  color: var(--accent-color);
}""",
        """body.dark-mode .footer-col ul li a:hover {
  color: #72bf44;
}"""
    ),
    (
        """body.dark-mode input:checked + .slider {
  background-color: var(--accent-color); /* Keep green for active state */
}""",
        """body.dark-mode input:checked + .slider {
  background-color: #72bf44; /* Keep green for active state */
}"""
    ),
    (
        """/* Scrollbar styling for Dark Mode */
body.dark-mode::-webkit-scrollbar-track {
  background: var(--brand-blue);
}
body.dark-mode::-webkit-scrollbar-thumb {
  background-color: #3A4056;
  border: 3px solid var(--brand-blue);
}""",
        """/* Scrollbar styling for Dark Mode */
body.dark-mode::-webkit-scrollbar-track {
  background: #0f172a;
}
body.dark-mode::-webkit-scrollbar-thumb {
  background-color: #334155;
  border: 3px solid #0f172a;
}"""
    ),
    # 892
    (
        """/* Override previous text colors to match Dark Blue-Gray or Blue where appropriate */
#stat-customers,
#stat-products,
#stat-pending {
  color: var(--brand-blue); /* Blue #242734 */
}

/* Keep completed soft green */
#stat-completed {
  color: var(--accent-hover); /* Light Green #73936f */
}""",
        """/* Override previous rainbow text colors */
#stat-customers,
#stat-products,
#stat-pending {
  color: #1e293b;
}

/* Keep completed nice and green optionally or just slate */
#stat-completed {
  color: #15803d; /* Professional dark green for completion */
}"""
    ),
    (
        """.hero-section .highlight {
  color: var(--accent-color); /* Green #72bf44 */
}""",
        """.hero-section .highlight {
  color: #16a34a; /* Premium Farmkart Green */
}"""
    ),
    (
        """.divider {
  height: 4px;
  width: 80px;
  background: var(--accent-color); /* Green #72bf44 */
  margin: 25px auto;
  border-radius: 20px;
}""",
        """.divider {
  height: 4px;
  width: 80px;
  background: #16a34a; /* Unified green */
  margin: 25px auto;
  border-radius: 20px;
}"""
    ),
    (
        """#start-btn {
  width: 100%;
  padding: 16px;
  background: var(--brand-blue); /* Button Blue #242734 */
  color: white;""",
        """#start-btn {
  width: 100%;
  padding: 16px;
  background: #16a34a;
  color: white;"""
    ),
    (
        """  transition: all 0.3s;
  box-shadow: 0 4px 12px rgba(36, 39, 52, 0.3);
  margin-top: 10px;
}

#start-btn:hover {
  transform: translateY(-2px);
  background: var(--accent-color); /* Hover Green #72bf44 */
  box-shadow: 0 8px 20px rgba(114, 191, 68, 0.4);
}""",
        """  transition: all 0.3s;
  box-shadow: 0 4px 12px rgba(22, 163, 74, 0.3);
  margin-top: 10px;
}

#start-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 20px rgba(114, 191, 68, 0.4);
}"""
    ),
    (
        """.section-header .highlight {
  color: var(--accent-color);
}""",
        """.section-header .highlight {
  color: #16a34a; /* Premium minimal green text instead of gradient */
}"""
    ),
    (
        """.step-num {
  width: 50px;
  height: 50px;
  background: var(--brand-blue); /* Dark Blue */
  color: white;
  font-weight: 800;
  font-size: 1.2rem;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 15px;
  box-shadow: 0 4px 15px rgba(36, 39, 52, 0.3);
}""",
        """.step-num {
  width: 50px;
  height: 50px;
  background: #16a34a;
  color: white;
  font-weight: 800;
  font-size: 1.2rem;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 15px;
  box-shadow: 0 4px 15px rgba(22, 163, 74, 0.3);
}"""
    ),
    # 881
    (
        """:root {
  --bg-color: #E5E7EB; /* Light Gray */
  --card-bg: #ffffff;
  --text-primary: #242734; /* Blue */
  --text-secondary: #3A4056; /* Dark Blue-Gray */
  --accent-color: #72bf44; /* Green */
  --accent-hover: #73936f; /* Light green hover */
  --accent-soft: #9AD66A; /* Soft Green */
  --brand-blue: #242734;
  --glass-bg: rgba(255, 255, 255, 0.7);
  --glass-border: rgba(255, 255, 255, 0.5);
  --shadow-sm: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
  --shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
  --shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);""",
        """:root {
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
    0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);"""
    ),
    (
        """body {
  font-family: "Inter", sans-serif;
  background-color: var(--bg-color); /* Elegant light background */""",
        """body {
  font-family: "Inter", sans-serif;
  background-color: #f8fafc; /* Elegant light background */"""
    ),
    (
        """/* Subtle animated gradient overlay for depth */
body::before {
  content: "";
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background:
    radial-gradient(
      circle at 20% 30%,
      rgba(114, 191, 68, 0.05) 0%, /* Green #72bf44 */
      transparent 50%
    ),
    radial-gradient(
      circle at 80% 70%,
      rgba(36, 39, 52, 0.05) 0%, /* Blue #242734 */
      transparent 50%
    );
  pointer-events: none;
  z-index: 0;
}""",
        """/* Subtle animated gradient overlay for depth */
body::before {
  content: "";
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background:
    radial-gradient(
      circle at 20% 30%,
      rgba(114, 191, 68, 0.08) 0%,
      transparent 50%
    ),
    radial-gradient(
      circle at 80% 70%,
      rgba(59, 130, 246, 0.08) 0%,
      transparent 50%
    );
  pointer-events: none;
  z-index: 0;
}"""
    ),
    (
        """.external-link-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  text-decoration: none;
  background: var(--brand-blue); /* Professional Blue */""",
        """.external-link-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  text-decoration: none;
  background: linear-gradient(135deg, #72bf44 0%, #5da632 100%);"""
    ),
    # 823
    (
        """/* Fix Text in Dark Mode */
body.dark-mode .hero-section h1 {
  color: #f8fafc; /* Crisp white for premium feel */
  text-shadow: 0 4px 10px rgba(0, 0, 0, 0.4);
}""",
        """/* Fix Gradient Text in Dark Mode */
body.dark-mode .hero-section h1 {
  background: linear-gradient(135deg, #ffffff 0%, #cbd5e1 100%);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  text-shadow: none;
}"""
    ),
    (
        """/* 5. Highlight Text in Dark Mode */
body.dark-mode .highlight,
body.dark-mode .section-header .highlight {
  color: #4ade80; /* Premium bright green */
  text-shadow: 0 0 15px rgba(74, 222, 128, 0.2);
}""",
        """/* 5. Highlight Text in Dark Mode (Brighter Gradients) */
body.dark-mode .highlight,
body.dark-mode .section-header .highlight {
  background: linear-gradient(135deg, #a3e635 0%, #60a5fa 100%);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  text-shadow: 0 0 20px rgba(163, 230, 53, 0.2);
}"""
    ),
    # 816
    (
        """.booking-badge {
  background: #3b82f6; /* Blue for Booking */
  box-shadow: 0 4px 10px rgba(59, 130, 246, 0.3);
}
.ofd-badge {
  background: #14b8a6; /* Teal for OFD */
  box-shadow: 0 4px 10px rgba(20, 184, 166, 0.3);
}""",
        """.booking-badge {
  background: linear-gradient(135deg, #ff6b6b 0%, #ee5253 100%);
  box-shadow: 0 4px 10px rgba(238, 82, 83, 0.3);
}
.ofd-badge {
  background: linear-gradient(135deg, #4ecdc4 0%, #26a69a 100%);
  box-shadow: 0 4px 10px rgba(38, 166, 154, 0.3);
}"""
    ),
    (
        """.stat-number {
  display: block;
  font-size: 3.5rem;
  font-weight: 800;
  color: #16a34a; /* Solid green for impact stats */
  line-height: 1;
  margin-bottom: 10px;
}""",
        """.stat-number {
  display: block;
  font-size: 3.5rem;
  font-weight: 800;
  background: linear-gradient(135deg, #72bf44 0%, #3b82f6 100%);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  line-height: 1;
  margin-bottom: 10px;
}"""
    ),
    (
        """.tech-icon {
  font-size: 3rem;
  margin-bottom: 15px;
  color: #16a34a; /* Premium darker green */
  transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}""",
        """.tech-icon {
  font-size: 3rem;
  margin-bottom: 15px;
  color: #72bf44; /* Farmkart Green */
  transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}"""
    ),
    (
        """.general-icon {
  background: #64748b; /* Slate */
}
.auto-icon {
  background: #f59e0b; /* Amber */
}
.data-icon {
  background: #10b981; /* Emerald */
}""",
        """.general-icon {
  background: linear-gradient(135deg, #a8c0ff 0%, #3f2b96 100%);
}
.auto-icon {
  background: linear-gradient(135deg, #fce38a 0%, #f38181 100%);
}
.data-icon {
  background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%);
}"""
    ),
    # 807
    (
        """.hero-section .highlight {
  color: #16a34a; /* Premium Farmkart Green */
}""",
        """.hero-section .highlight {
  background: linear-gradient(135deg, #72bf44 0%, #3b82f6 100%);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
}"""
    ),
    (
        """.divider {
  height: 4px;
  width: 80px;
  background: #16a34a; /* Unified green */
  margin: 25px auto;
  border-radius: 20px;
}""",
        """.divider {
  height: 4px;
  width: 80px;
  background: linear-gradient(90deg, #72bf44, #3b82f6);
  margin: 25px auto;
  border-radius: 20px;
}"""
    ),
    (
        """.card::before {
  content: "";
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 5px;
  background: linear-gradient(90deg, rgba(255,255,255,0.8), rgba(255,255,255,0.1));
  opacity: 0;
  transition: opacity 0.3s;
}""",
        """.card::before {
  content: "";
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 5px;
  background: linear-gradient(90deg, #72bf44, #3b82f6);
  opacity: 0;
  transition: opacity 0.3s;
}"""
    ),
    (
        """.about-container::after {
  content: "";
  position: absolute;
  top: 0;
  right: 0;
  width: 200px;
  height: 200px;
  background: linear-gradient(
    135deg,
    rgba(22, 163, 74, 0.1) 0%,
    rgba(15, 23, 42, 0.05) 100%
  );
  border-radius: 0 0 0 100%;
  pointer-events: none;
}""",
        """.about-container::after {
  content: "";
  position: absolute;
  top: 0;
  right: 0;
  width: 200px;
  height: 200px;
  background: linear-gradient(
    135deg,
    rgba(114, 191, 68, 0.15) 0%,
    rgba(59, 130, 246, 0.15) 100%
  );
  border-radius: 0 0 0 100%;
  pointer-events: none;
}"""
    ),
    (
        """#start-btn {
  width: 100%;
  padding: 16px;
  background: #16a34a;
  color: white;
  border: none;
  border-radius: 12px;
  font-size: 16px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.3s;
  box-shadow: 0 4px 12px rgba(22, 163, 74, 0.3);
  margin-top: 10px;
}""",
        """#start-btn {
  width: 100%;
  padding: 16px;
  background: linear-gradient(135deg, #72bf44 0%, #5da632 100%);
  color: white;
  border: none;
  border-radius: 12px;
  font-size: 16px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.3s;
  box-shadow: 0 4px 12px rgba(114, 191, 68, 0.3);
  margin-top: 10px;
}"""
    ),
    (
        """.section-header .highlight {
  color: #16a34a; /* Premium minimal green text instead of gradient */
}""",
        """.section-header .highlight {
  background: linear-gradient(135deg, #72bf44 0%, #3b82f6 100%);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
}"""
    ),
    (
        """.step-num {
  width: 50px;
  height: 50px;
  background: #16a34a;
  color: white;
  font-weight: 800;
  font-size: 1.2rem;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 15px;
  box-shadow: 0 4px 15px rgba(22, 163, 74, 0.3);
}""",
        """.step-num {
  width: 50px;
  height: 50px;
  background: linear-gradient(135deg, #72bf44 0%, #3b82f6 100%);
  color: white;
  font-weight: 800;
  font-size: 1.2rem;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 15px;
  box-shadow: 0 4px 15px rgba(114, 191, 68, 0.3);
}"""
    )
]

for target, replacement in replacements:
    if target in content:
        content = content.replace(target, replacement)
        print(f"Replaced a chunk...")
    else:
        print(f"WARNING: Target not found:\n{target[:50]}...")

with open(file_path, "w") as f:
    f.write(content)
