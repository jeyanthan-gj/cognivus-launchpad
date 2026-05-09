-- Add thumbnail and video URL columns to projects table
alter table public.projects
  add column if not exists thumbnail_url text,
  add column if not exists video_url text;
