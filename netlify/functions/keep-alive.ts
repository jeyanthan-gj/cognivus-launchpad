import type { Config } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";

export default async (req: Request) => {
  console.log("[Keep Alive] Scheduled database ping initiated.");

  const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error("[Keep Alive] Error: Missing required environment variables SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
    return new Response("Missing configuration environment variables.", { status: 500 });
  }

  // Create privileged Supabase client using the service-role key (bypasses RLS)
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    const startTime = Date.now();

    // 1. Insert a temporary keep-alive record
    console.log("[Keep Alive] Performing INSERT operation...");
    const { data: insertData, error: insertError } = await supabase
      .from("keep_alive")
      .insert({})
      .select("id")
      .single();

    if (insertError) {
      throw new Error(`INSERT failed: ${insertError.message}`);
    }

    const insertedId = insertData?.id;
    if (!insertedId) {
      throw new Error("INSERT succeeded but did not return a row ID.");
    }
    console.log(`[Keep Alive] Successfully inserted temporary row with ID: ${insertedId}`);

    // 2. Immediately delete the temporary keep-alive record
    console.log("[Keep Alive] Performing DELETE operation...");
    const { error: deleteError } = await supabase
      .from("keep_alive")
      .delete()
      .eq("id", insertedId);

    if (deleteError) {
      throw new Error(`DELETE failed: ${deleteError.message}`);
    }
    console.log(`[Keep Alive] Successfully deleted temporary row with ID: ${insertedId}`);

    const duration = Date.now() - startTime;
    const msg = `✓ Supabase database keep-alive successful! Complete cycle completed in ${duration}ms.`;
    console.log(msg);

    return new Response(msg, { status: 200 });
  } catch (err: any) {
    const errMsg = `❌ Supabase database keep-alive failed: ${err.message || err}`;
    console.error(errMsg);
    return new Response(errMsg, { status: 500 });
  }
};

// Netlify Cron schedule: Daily at 00:00 UTC
export const config: Config = {
  schedule: "@daily",
};
