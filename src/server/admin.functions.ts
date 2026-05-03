import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const ADMIN_EMAIL = "admin@cognivus.local";
const ADMIN_PASSWORD = "admin123";

/**
 * Ensures the default admin user exists with the admin role.
 * Idempotent: safe to call on every login page load.
 */
export const ensureDefaultAdmin = createServerFn({ method: "POST" }).handler(async () => {
  // Look up existing user by email
  const { data: list, error: listErr } = await supabaseAdmin.auth.admin.listUsers();
  if (listErr) throw listErr;

  let user = list.users.find((u) => u.email?.toLowerCase() === ADMIN_EMAIL);

  if (!user) {
    const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
      email_confirm: true,
    });
    if (createErr) throw createErr;
    user = created.user!;
  }

  // Ensure admin role
  const { data: existingRole } = await supabaseAdmin
    .from("user_roles")
    .select("id")
    .eq("user_id", user.id)
    .eq("role", "admin")
    .maybeSingle();

  if (!existingRole) {
    const { error: roleErr } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: user.id, role: "admin" });
    if (roleErr) throw roleErr;
  }

  return { ok: true, email: ADMIN_EMAIL };
});
