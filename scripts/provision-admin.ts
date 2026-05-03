/**
 * One-time admin provisioning script.
 *
 * Run ONCE after deploying to create the first admin account:
 *
 *   SUPABASE_URL=https://xxx.supabase.co \
 *   SUPABASE_SERVICE_ROLE_KEY=eyJ... \
 *   ADMIN_EMAIL=you@yourdomain.com \
 *   ADMIN_PASSWORD=YourStr0ng!Pass \
 *   npx tsx scripts/provision-admin.ts
 *
 * Requirements:
 *   - ADMIN_PASSWORD must be ≥12 chars with upper, lower, digit, and special character.
 *   - Run this from your local machine or a secure CI environment — never in the browser.
 *   - After running, delete or rotate any shell history that may contain the password.
 *   - Sign in at /admin/login and change the password immediately from the Account page.
 */

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !ADMIN_EMAIL || !ADMIN_PASSWORD) {
  console.error(
    "Missing required env vars: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ADMIN_EMAIL, ADMIN_PASSWORD"
  );
  process.exit(1);
}

// Password policy
const pwOk =
  ADMIN_PASSWORD.length >= 12 &&
  /[A-Z]/.test(ADMIN_PASSWORD) &&
  /[a-z]/.test(ADMIN_PASSWORD) &&
  /\d/.test(ADMIN_PASSWORD) &&
  /[^A-Za-z0-9]/.test(ADMIN_PASSWORD);

if (!pwOk) {
  console.error(
    "ADMIN_PASSWORD does not meet policy: ≥12 chars, uppercase, lowercase, digit, special character."
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function main() {
  console.log(`Provisioning admin account for ${ADMIN_EMAIL}…`);

  // Check if user already exists
  const { data: list, error: listErr } = await supabase.auth.admin.listUsers();
  if (listErr) {
    console.error("Failed to list users:", listErr.message);
    process.exit(1);
  }

  let userId: string;
  const existing = list.users.find(
    (u) => u.email?.toLowerCase() === ADMIN_EMAIL!.toLowerCase()
  );

  if (existing) {
    console.log("User already exists. Updating password…");
    const { error: updateErr } = await supabase.auth.admin.updateUserById(existing.id, {
      password: ADMIN_PASSWORD,
    });
    if (updateErr) {
      console.error("Failed to update password:", updateErr.message);
      process.exit(1);
    }
    userId = existing.id;
  } else {
    const { data: created, error: createErr } = await supabase.auth.admin.createUser({
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
      email_confirm: true,
    });
    if (createErr || !created.user) {
      console.error("Failed to create user:", createErr?.message);
      process.exit(1);
    }
    userId = created.user.id;
    console.log("User created.");
  }

  // Ensure admin role
  const { data: roleRow } = await supabase
    .from("user_roles")
    .select("id")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();

  if (!roleRow) {
    const { error: roleErr } = await supabase
      .from("user_roles")
      .insert({ user_id: userId, role: "admin", must_change_password: true });
    if (roleErr) {
      console.error("Failed to assign admin role:", roleErr.message);
      process.exit(1);
    }
    console.log("Admin role assigned (must_change_password = true).");
  } else {
    // Mark that password should be changed on next login
    await supabase
      .from("user_roles")
      .update({ must_change_password: true })
      .eq("user_id", userId)
      .eq("role", "admin");
    console.log("Admin role already present. must_change_password set to true.");
  }

  console.log("\n✓ Done. Sign in at /admin/login and change your password immediately.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
