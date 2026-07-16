import { createClient, SupabaseClient } from "@supabase/supabase-js";

let supabaseClient: SupabaseClient | null = null;

function getSupabase(): SupabaseClient {
  if (!supabaseClient) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    
    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error("Supabase environment variables are not configured");
    }
    
    supabaseClient = createClient(supabaseUrl, supabaseAnonKey);
  }
  return supabaseClient;
}

// Extracts the storage path from a full Supabase public URL
export function receiptUrlToPath(url: string): string | null {
  try {
    const u = new URL(url);
    // path format: /storage/v1/object/public/receipts/<userId>/<file>
    const match = u.pathname.match(/\/receipts\/(.+)$/);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

export async function deleteReceipts(paths: string[]): Promise<void> {
  if (paths.length === 0) return;
  const supabase = getSupabase();
  const { error } = await supabase.storage.from("receipts").remove(paths);
  if (error) throw error;
}

export async function uploadReceipt(file: File, userId: string): Promise<string> {
  const supabase = getSupabase();
  const fileExt = file.name.split(".").pop();
  const fileName = `${userId}/${Date.now()}.${fileExt}`;
  
  const { error } = await supabase.storage
    .from("receipts")
    .upload(fileName, file);

  if (error) throw error;

  const { data } = supabase.storage
    .from("receipts")
    .getPublicUrl(fileName);

  return data.publicUrl;
}
