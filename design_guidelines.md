# AI网络小说创作工作台 - 设计指南

## Design Approach: Professional Writing Tool System

**Selected Approach**: Design System (Linear + Notion + VS Code inspired)
**Justification**: This is a complex, utility-focused productivity application where efficiency, clarity, and long-term usability are paramount. Writers need distraction-free environments with instant access to powerful tools.

**Core Design Principles**:
1. **Clarity over decoration** - Every element serves a functional purpose
2. **Efficiency first** - Minimize clicks, maximize keyboard shortcuts
3. **Focus-friendly** - Support deep work with minimal visual noise
4. **Information density** - Pack features without overwhelming
5. **Dark mode native** - Designed for extended writing sessions

---

## Color Palette

**Primary Colors**:
- Primary: 250 80% 60% (deep purple-blue, professional and creative)
- Primary Light: 250 70% 70%
- Primary Dark: 250 80% 50%

**Neutral Scale** (Dark Mode First):
- Background: 222 20% 11% (deep charcoal)
- Surface: 222 15% 15% (elevated panels)
- Surface Hover: 222 15% 18%
- Border: 222 10% 25%
- Border Subtle: 222 10% 20%

**Text Colors**:
- Text Primary: 0 0% 95%
- Text Secondary: 0 0% 70%
- Text Muted: 0 0% 50%

**Semantic Colors**:
- Success: 142 70% 55% (AI generation success)
- Warning: 38 92% 60% (word count milestones)
- Danger: 0 70% 60% (deletion, conflicts)
- Info: 210 80% 60% (tips, suggestions)

**Accent Colors** (Use sparingly):
- AI Accent: 280 60% 65% (AI-related features)
- Chapter Progress: 142 60% 50%

---

## Typography

**Font Families**:
- Primary (UI): 'Inter', system-ui, sans-serif (clean, readable)
- Editor (Content): 'Noto Serif SC', 'Source Han Serif SC', serif (优化中文长文阅读)
- Monospace (Code/Stats): 'JetBrains Mono', monospace

**Type Scale**:
- Display: text-4xl font-bold (32px) - Project titles
- Heading 1: text-2xl font-semibold (24px) - Section headers
- Heading 2: text-xl font-semibold (20px) - Panel titles
- Heading 3: text-lg font-medium (18px) - Subsections
- Body: text-base (16px) - Default UI text
- Body Small: text-sm (14px) - Secondary info
- Caption: text-xs (12px) - Metadata, stats

**Chinese Text Optimization**:
- Line height: 1.8 for editor content (comfortable reading)
- Letter spacing: tracking-wide for headings
- Font weight: Use 500 (medium) instead of 400 for Chinese text clarity

---

## Layout System

**Spacing Primitives**: Use tailwind units of 1, 2, 3, 4, 6, 8, 12, 16
- Tight spacing: p-1, p-2, gap-2 (compact lists, tags)
- Standard spacing: p-4, gap-4, m-4 (panels, cards)
- Generous spacing: p-6, p-8, gap-6 (main sections)
- Large separation: p-12, p-16 (page sections)

**Grid System**:
- Main workspace: Three-column layout
  - Left sidebar (章节目录): w-64 (256px)
  - Center editor: flex-1 max-w-4xl (flexible, capped at 896px)
  - Right AI panel: w-80 (320px)
- Responsive breakpoints: Stack to single column on < lg (1024px)

**Container Strategy**:
- Full app container: max-w-screen-2xl mx-auto
- Editor max width: max-w-4xl (optimal reading width)
- Settings panels: max-w-2xl
- Modal dialogs: max-w-lg to max-w-2xl based on content

---

## Component Library

### Navigation
- **Top App Bar**: Fixed header with project switcher, sync status, user menu
  - Height: h-14, dark background, subtle border-b
  - Logo/Project name left, actions right
  
- **Sidebar Navigation**: Collapsible left sidebar
  - Chapter tree with expand/collapse
  - Drag handles for reordering
  - Icons + text labels
  - Active state: subtle background + border-l accent

### Panels & Cards
- **Surface Cards**: Elevated panels with subtle borders
  - Background: bg-surface, border border-subtle
  - Rounded: rounded-lg
  - Shadow: shadow-sm on hover
  
- **AI Panel**: Right-side assistant
  - Sticky position, scroll independently
  - Section headers with collapse
  - Quick action buttons stacked vertically

### Forms & Inputs
- **Text Inputs**: Dark mode optimized
  - Background: bg-surface-hover
  - Border: border-border, focus:border-primary
  - Padding: px-3 py-2
  - Rounded: rounded-md
  
- **Rich Text Editor**: Full-featured writing area
  - Minimal toolbar (appears on selection)
  - Focus mode: dim sidebars
  - Line numbers optional
  - Syntax highlighting for dialogue (「」)

### Buttons
- **Primary**: bg-primary hover:bg-primary-dark, white text
- **Secondary**: border border-border hover:bg-surface-hover
- **Ghost**: hover:bg-surface-hover (sidebar actions)
- **Icon Buttons**: Square, 36px × 36px, rounded-md
- **AI Generate**: Special styling with AI accent color + icon

### Data Display
- **Stats Cards**: Compact metrics display
  - Large number + small label
  - Grid layout: grid-cols-3 gap-4
  - Border-l accent for visual interest
  
- **Progress Bars**: Chapter and word count progress
  - Thin (h-1), rounded-full
  - Gradient for milestones (3万/8万/20万)
  
- **Chapter List**: Tree structure
  - Indent with pl-4 per level
  - Hover state reveals actions
  - Status indicators (dot notation)

### Modals & Overlays
- **Dialog Modals**: Centered overlay
  - Backdrop: bg-black/50 backdrop-blur-sm
  - Content: max-w-lg to max-w-2xl
  - Rounded: rounded-xl
  
- **Side Panels**: Slide-in from right
  - Full height, w-96 to w-1/2
  - For settings, AI history, character sheets

### Special Components
- **Outline Editor**: Nested tree with visual hierarchy
  - Indentation lines connecting levels
  - Drag handles, collapse icons
  - Inline editing on click
  
- **AI Generation History**: Timeline view
  - Chronological list with timestamps
  - Compare versions side-by-side
  - Restore previous generation button
  
- **Word Count Dashboard**: Visual statistics
  - Daily writing streak calendar
  - Line chart for progress
  - Milestone markers at key points

---

## Interaction Patterns

**Hover States**: Subtle bg-surface-hover transition
**Active States**: Slightly darker background + scale-[0.98]
**Focus**: 2px ring-primary ring-offset-2 ring-offset-background
**Disabled**: opacity-50 cursor-not-allowed
**Loading**: Skeleton screens with pulse animation
**Transitions**: transition-colors duration-150 (subtle, fast)

---

## Animations

**Minimal Animation Philosophy**: Use sparingly to reduce distraction

**Allowed Animations**:
- Sidebar collapse/expand: transform duration-200
- Modal fade in: opacity + scale from 95% to 100%
- AI generation: Subtle pulse on generate button
- Success feedback: Brief checkmark animation
- Dropdown menus: slideDown 150ms

**Forbidden**:
- Page transitions
- Decorative animations
- Parallax effects
- Continuous animations (except loading states)

---

## Images

**No Hero Images**: This is a utility application, not a marketing site

**Icon Usage**:
- Heroicons for UI (outline style for navigation, solid for actions)
- AI-specific icon for generation features
- Chapter status icons (draft, completed, published)

**Avatar/Placeholder Usage**:
- User avatar in top-right
- Character profile placeholders in settings
- Empty state illustrations (minimal, line-art style)

---

## Accessibility & Dark Mode

- **Dark Mode**: Default and primary design, light mode optional
- **Contrast**: WCAG AA minimum for all text
- **Keyboard Navigation**: Full keyboard support, visible focus indicators
- **Screen Readers**: Proper ARIA labels on all interactive elements
- **Font Scaling**: Support browser font size adjustment

---

## Platform-Specific Features

**番茄小说 Integration**:
- Milestone markers at 30k, 80k, 200k words (warning color)
- One-click copy formatted for platform
- Character/word count matching platform requirements
- Chapter number formatting adherence

**Multi-Panel Workspace**:
- Resizable panels with drag handles
- Panel visibility toggles (hide sidebar for focus mode)
- Remember panel sizes in localStorage

**AI Model Switcher**:
- Dropdown in AI panel header
- Model icons/logos for quick recognition
- API usage counter (small, unobtrusive)

This design creates a professional, efficient workspace optimized for long writing sessions, with clear visual hierarchy and minimal distractions while maintaining quick access to powerful AI tools.