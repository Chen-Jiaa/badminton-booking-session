// Server-only: receipt storage. Uses the service-role key, which bypasses Storage
// policies, so import this only from server routes and server-function handlers.
// The `receipts` bucket is private (2 MB, images only); admins see a receipt through
// a short-lived signed URL from /api/receipts/$id.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { RECEIPT_TYPES } from "@/features/topup/receipt";

const BUCKET = "receipts";

let supabaseClient: SupabaseClient | null = null;

function getSupabase(): SupabaseClient {
  if (!supabaseClient) {
    const supabaseUrl = process.env.VITE_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error("VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set for receipts");
    }

    supabaseClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return supabaseClient;
}

/** Stores the receipt and returns its storage path (what the top-up row keeps). */
export async function uploadReceipt(file: File, userId: string): Promise<string> {
  const path = `${userId}/${Date.now()}.${RECEIPT_TYPES[file.type]}`;
  const { error } = await getSupabase()
    .storage.from(BUCKET)
    .upload(path, file, { contentType: file.type });
  if (error) throw error;
  return path;
}

/** A link to the receipt that stops working after `seconds`. */
export async function signedReceiptUrl(path: string, seconds = 60): Promise<string> {
  const { data, error } = await getSupabase().storage.from(BUCKET).createSignedUrl(path, seconds);
  if (error) throw error;
  return data.signedUrl;
}

export async function deleteReceipts(paths: string[]): Promise<void> {
  if (paths.length === 0) return;
  const { error } = await getSupabase().storage.from(BUCKET).remove(paths);
  if (error) throw error;
}
