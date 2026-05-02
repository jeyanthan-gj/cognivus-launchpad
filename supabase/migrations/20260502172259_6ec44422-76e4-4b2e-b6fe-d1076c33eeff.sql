
-- Roles enum + table
create type public.app_role as enum ('admin', 'editor');

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);

alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = _user_id and role = _role
  )
$$;

create policy "Admins can view all roles" on public.user_roles
  for select using (public.has_role(auth.uid(), 'admin'));

create policy "Admins can manage roles" on public.user_roles
  for all using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

-- updated_at trigger
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Projects
create table public.projects (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null,
  tech_stack text[] not null default '{}',
  demo_url text,
  display_order int not null default 0,
  published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.projects enable row level security;
create trigger projects_updated_at before update on public.projects
  for each row execute function public.set_updated_at();

create policy "Anyone can view published projects" on public.projects
  for select using (published = true or public.has_role(auth.uid(), 'admin'));
create policy "Admins manage projects" on public.projects
  for all using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

-- Services
create table public.services (
  id uuid primary key default gen_random_uuid(),
  icon text not null default 'Sparkles',
  title text not null,
  description text not null,
  display_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.services enable row level security;
create trigger services_updated_at before update on public.services
  for each row execute function public.set_updated_at();

create policy "Anyone can view services" on public.services
  for select using (true);
create policy "Admins manage services" on public.services
  for all using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

-- Site content (key/value)
create table public.site_content (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);
alter table public.site_content enable row level security;
create trigger site_content_updated_at before update on public.site_content
  for each row execute function public.set_updated_at();

create policy "Anyone can view site content" on public.site_content
  for select using (true);
create policy "Admins manage site content" on public.site_content
  for all using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

-- Contact messages
create table public.contact_messages (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  message text not null,
  created_at timestamptz not null default now()
);
alter table public.contact_messages enable row level security;

create policy "Anyone can submit a message" on public.contact_messages
  for insert with check (true);
create policy "Admins view messages" on public.contact_messages
  for select using (public.has_role(auth.uid(), 'admin'));
create policy "Admins delete messages" on public.contact_messages
  for delete using (public.has_role(auth.uid(), 'admin'));

-- Seed services
insert into public.services (icon, title, description, display_order) values
  ('Workflow', 'AI Automation Systems', 'End-to-end intelligent automation that connects your tools, eliminates repetitive work, and scales with your business.', 1),
  ('BookOpen', 'RAG-based Knowledge Assistants', 'Context-aware assistants that turn your documents and internal data into instant, accurate answers.', 2),
  ('MessageSquare', 'Custom AI Chatbots', 'Tailored conversational agents trained on your brand, products, and workflows for support, sales, and operations.', 3),
  ('Cog', 'Business Workflow Automation', 'AI-driven process orchestration that streamlines operations across departments and systems.', 4);

-- Seed projects
insert into public.projects (title, description, tech_stack, demo_url, display_order) values
  ('Atlas — Enterprise Knowledge Assistant', 'A RAG-powered assistant that lets enterprise teams query thousands of internal documents in natural language with cited sources.', ARRAY['Python','LangChain','PostgreSQL','OpenAI'], null, 1),
  ('Flowline — Workflow Automation Platform', 'No-code AI workflow builder that connects 100+ business tools and triggers intelligent actions in real time.', ARRAY['Node.js','React','Temporal','Redis'], null, 2),
  ('Nimbus — Customer Support Copilot', 'A custom chatbot that handles 70% of tier-1 support requests and seamlessly escalates complex issues to humans.', ARRAY['TypeScript','Next.js','Supabase','GPT-5'], null, 3);

-- Seed site content
insert into public.site_content (key, value) values
  ('hero_tagline', 'The mind behind every solution.'),
  ('hero_description', 'We build intelligent AI-powered solutions that solve real-world business problems.'),
  ('about_body', 'Cognivus is an AI-driven technology company focused on building scalable, real-world solutions. We combine cutting-edge research with pragmatic engineering to deliver intelligent systems that automate operations, surface insights, and unlock new capabilities for modern businesses. Our work spans automation platforms, knowledge assistants, and conversational AI — always engineered for reliability, security, and measurable impact.');
