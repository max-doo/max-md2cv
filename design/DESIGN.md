# Design System Document

## 1. Overview & Creative North Star: "The Digital Curator"

This design system is built to transform the often-stressful process of resume building into a serene, guided experience. Our Creative North Star is **"The Digital Curator"**—an aesthetic that feels less like a database and more like a high-end personal assistant. 

To achieve this, we move beyond "standard" UI. We utilize a **Soft Minimalist** approach where depth is created through tonal shifts rather than rigid lines. We embrace breathing room (whitespace) as a functional tool, using intentional asymmetry and floating, organic layers to lead the user’s eye. The goal is a "Zen-like" efficiency: approachable enough for a first-time job seeker, yet professional enough for a C-suite executive.

---

## 2. Colors

The palette is a sophisticated interplay of lavender and cool-toned purples, designed to reduce cognitive load while maintaining a premium, "digital-first" feel.

### Surface Hierarchy & The "No-Line" Rule
The most critical rule of this system: **Prohibit 1px solid borders for sectioning.** 
Boundaries must be defined through background color shifts or subtle tonal transitions. For example, a main workspace on `surface` (#f8f9ff) should be distinguished from a sidebar using `surface-container-low` (#f2f3f9). 

*   **Primary (#4c49cc):** Used for key actions and focus states.
*   **Surface-Container Tiers:** 
    *   `surface-container-lowest` (#ffffff): Use for cards or inputs that need to "pop" against a background.
    *   `surface-container-high` (#e7e8ee): Use for secondary navigation or subtle grouping.
*   **The "Glass & Gradient" Rule:** Floating elements should utilize `surface-container-lowest` with a 70% opacity and a `backdrop-blur(20px)` to create a frosted glass effect. 
*   **Signature Textures:** Apply a subtle linear gradient from `primary` (#4c49cc) to `primary_container` (#6564e7) on main CTA buttons to provide a "soulful" depth that flat colors cannot mimic.

---

## 3. Typography

We use **Manrope** for its modern, geometric structure and friendly open terminals. It strikes the perfect balance between tech-forward and human-centric.

*   **Display & Headline (3.5rem - 1.5rem):** Used sparingly to celebrate milestones (e.g., "你的简历已就绪"). These should feel editorial—bold, with ample tracking (0.02em).
*   **Title (1.375rem - 1rem):** Used for section headers within the resume builder.
*   **Body (1rem - 0.75rem):** Set in `on_surface_variant` (#464554) for long-form guidance to keep the interface feeling light and airy.
*   **Labels (0.75rem - 0.6875rem):** Used for metadata and micro-copy.

**Language Note:** All UI labels (e.g., "姓名", "工作经历") and placeholders (e.g., "请输入您的职业目标...") must be in Chinese, ensuring the typography maintains its clean, vertical rhythm.

---

## 4. Elevation & Depth

We reject the "boxed-in" look. Depth is achieved through **Tonal Layering**.

*   **The Layering Principle:** Instead of shadows, stack containers. A white card (`surface-container-lowest`) placed on a light lavender section (`surface-container-low`) creates a natural lift.
*   **Ambient Shadows:** For "floating" items like modals or dropdowns, use an extra-diffused shadow: `box-shadow: 0 20px 40px rgba(76, 73, 204, 0.06);`. Note the tint—we use a hint of our primary color in the shadow to mimic natural light reflecting off purple surfaces.
*   **The "Ghost Border" Fallback:** If a divider is mandatory for accessibility, use the `outline_variant` (#c7c4d6) at **15% opacity**. Never use a 100% opaque border.

---

## 5. Components

### Buttons
*   **Primary:** Rounded `lg` (2rem), gradient background (`primary` to `primary_container`), `on_primary` (#ffffff) text.
*   **Secondary:** Rounded `lg`, `surface-container-high` background, `primary` text. No border.

### Input Fields (输入框)
*   **Style:** `surface-container-lowest` background with a soft `md` (1.5rem) rounding. 
*   **State:** On focus, transition the background to `surface` and apply a 1px "Ghost Border" using `primary` at 30% opacity.
*   **Labels:** Floating or top-aligned using `label-md` in `on_surface_variant`.

### Cards & Lists
*   **Cards:** Use `DEFAULT` (1rem) or `lg` (2rem) corner radius. Forbid divider lines. Use `2.5rem` of vertical whitespace to separate entries like "Education" and "Experience".
*   **Resume Preview Card:** A high-elevation element using the **Ambient Shadow** and a subtle `surface-tint` to draw the eye as the final output.

### Digital Assistant "Bubbles"
*   **Context:** Use specialized tooltips that appear as speech bubbles with `ROUND_TWELVE` corners to offer suggestions (e.g., "建议增加具体的项目数据").

---

## 6. Do's and Don'ts

### Do
*   **Do** use asymmetrical layouts. For example, left-aligning the editor while the resume preview floats slightly off-center to the right.
*   **Do** use Manrope's medium weight for Chinese characters to maintain legibility against the lavender backgrounds.
*   **Do** use `2rem` and `2.5rem` values frequently to ensure the "Airy" feel.

### Don't
*   **Don't** use pure black (#000000). Always use `on_surface` (#191c20) or `on_surface_variant` (#464554) for text.
*   **Don't** use sharp corners. Everything must feel soft to the touch; even the smallest checkbox should have a `sm` (0.5rem) radius.
*   **Don't** use standard grey shadows. They will make the soft lavender palette feel "dirty." Always tint shadows with the primary purple.