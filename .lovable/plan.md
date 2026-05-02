## Cognivus — AI Company Website + Admin Dashboard

A modern, minimal corporate site for Cognivus with a public marketing site and a secure admin panel for managing dynamic content. Built on the project's TanStack Start + Lovable Cloud stack (Cloud replaces the separate FastAPI/Postgres setup — same capabilities, integrated auth, database, and serverless functions).

### Design language
- Clean, minimal, enterprise tech feel (think Linear / Vercel / Anthropic)
- Light background, deep navy + electric blue accents, near-black text
- Modern sans-serif (Inter), generous spacing, subtle fade/slide animations on scroll
- Fully responsive

---

### Public website (separate routes, SSR + SEO friendly)

**`/` — Home**
- Hero: "Cognivus" wordmark, tagline *"The mind behind every solution."*, short description, CTAs → Explore Solutions / View Projects
- Highlights strip (services teaser), featured projects preview, CTA footer

**`/about`**
- Company narrative: AI-driven technology company building scalable real-world solutions; pillars of Innovation, Automation, Intelligent Systems
- Values grid, mission statement (no personal names)
- Editable from admin

**`/services`**
- Cards for: AI Automation Systems · RAG-based Knowledge Assistants · Custom AI Chatbots · Business Workflow Automation
- Icon + title + short description on each
- Optionally editable from admin

**`/projects`**
- Responsive grid of project cards pulled live from database
- Each card: title, description, tech stack chips, optional demo link
- Filter by tech tag (nice-to-have)

**`/contact`**
- Professional contact form (name, email, message) with zod validation
- Submissions stored in DB; admin can view them

**Shared header/footer** with nav links and Cognivus branding.

---

### Admin dashboard (`/admin/*`, auth-gated)

- **`/admin/login`** — email + password sign-in (Lovable Cloud auth)
- **`/admin`** — overview: total projects, total services, recent contact messages, recent updates
- **`/admin/projects`** — table view; create / edit / delete projects (title, description, tech stack array, demo URL, display order, published toggle)
- **`/admin/services`** — create / edit / delete services (icon name, title, description, order)
- **`/admin/content`** — edit homepage tagline + hero description, About section text
- **`/admin/messages`** — view contact form submissions

Only users with the `admin` role can access. Role checked via `has_role()` security-definer function.

---

### Data model (Lovable Cloud / Postgres)

- `projects` — id, title, description, tech_stack text[], demo_url, display_order, published, timestamps
- `services` — id, icon, title, description, display_order, timestamps
- `site_content` — key/value store for editable copy (hero_tagline, hero_description, about_body, etc.)
- `contact_messages` — id, name, email, message, created_at
- `user_roles` — (user_id, role) with `app_role` enum + `has_role()` function

RLS:
- Public SELECT on `projects` (where published), `services`, `site_content`
- INSERT on `contact_messages` open to anon; SELECT restricted to admins
- All write ops on content tables restricted to `has_role(auth.uid(),'admin')`

Seed data: 4 default services, 3 sample projects, default site_content rows.

---

### Tech notes (for reference)
- Framework: TanStack Start (React 19) — already set up
- Backend: TanStack server functions (`createServerFn`) for admin mutations; public reads via Supabase client
- DB + Auth: Lovable Cloud (Supabase under the hood) — replaces FastAPI/Postgres requirement with the same capabilities, fully integrated
- Styling: Tailwind v4 + shadcn/ui (already installed)
- Forms: react-hook-form + zod
- Admin auth: Supabase email/password + `user_roles` table (no roles on profiles)
- First admin user: created manually after signup by inserting into `user_roles`

---

### Deliverables
1. Public routes: `/`, `/about`, `/services`, `/projects`, `/contact` with per-route SEO meta
2. Admin routes under `/admin/*` with login + role guard
3. Database schema, RLS policies, `has_role` function, seed data
4. Server functions for all admin CRUD
5. Responsive UI, smooth scroll-in animations, polished typography
