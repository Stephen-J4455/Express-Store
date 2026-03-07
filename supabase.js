import { createClient } from "@supabase/supabase-js";
import AsyncStorage from "@react-native-async-storage/async-storage";

const supabaseUrl = "https://meiljgoztnhnyvtfkzuh.supabase.co";
const supabaseAnonKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1laWxqZ296dG5obnl2dGZrenVoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUxMTI0OTksImV4cCI6MjA4MDY4ODQ5OX0.X7zve3MSvaoplAHl45BpC57h9G4IY5suhBBteIoEU3I";

export const supabase =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        storage: AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
      realtime: {
        params: {
          eventsPerSecond: 10,
        },
      },
    })
    : null;

// Edge function helper
export const invokeEdgeFunction = async (functionName, body) => {
  if (!supabase) throw new Error("Supabase not initialized");
  // Call edge function URL directly so we can capture non-2xx response bodies
  const url = `${supabaseUrl}/functions/v1/${functionName}`;
  // Try to get a current access token for Authorization header
  let token = null;
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    token = session?.access_token ?? null;
  } catch (e) {
    // ignore
  }

  const headers = {
    "Content-Type": "application/json",
    apikey: supabaseAnonKey,
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const resp = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  const text = await resp.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch (e) {
    // not JSON
  }

  if (!resp.ok) {
    const errBody = json ?? text ?? `HTTP ${resp.status}`;
    const bodyText = typeof errBody === "string" ? errBody : JSON.stringify(errBody);
    const err = new Error(`Edge function ${functionName} failed: ${bodyText}`);
    // attach body for downstream inspection
    err.body = errBody;
    throw err;
  }

  return json ?? text;
};

