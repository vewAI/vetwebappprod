import { NextResponse } from "next/server";
import {
  createClient,
  type SupabaseClient,
  type User,
} from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? null;

type AuthSuccess = {
  supabase: SupabaseClient;
  user: User;
  role: string | null;
  accessToken: string;
  userSupabase?: SupabaseClient;
  adminSupabase?: SupabaseClient;
};

type AuthFailure = {
  error: NextResponse;
};

function extractBearerToken(req: Request): string | null {
  const authHeader = req.headers.get("authorization") ?? req.headers.get("Authorization");
  if (authHeader && authHeader.startsWith("Bearer ")) {
    return authHeader.slice("Bearer ".length).trim();
  }
  return null;
}

async function fetchProfileRoleViaService(userId: string): Promise<string | null> {
  if (!supabaseServiceKey) return null;
  try {
    const restUrl = new URL("/rest/v1/profiles", supabaseUrl);
    restUrl.searchParams.set("select", "role");
    restUrl.searchParams.set("user_id", `eq.${userId}`);
    restUrl.searchParams.set("limit", "1");

    const response = await fetch(restUrl.toString(), {
      headers: {
        apikey: supabaseServiceKey,
        Authorization: `Bearer ${supabaseServiceKey}`,
        Accept: "application/json",
        Prefer: "count=none",
      },
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      console.error("Service role profile REST fetch failed", response.status, detail);
      return null;
    }

    const payload = (await response.json()) as Array<{ role?: string | null }>;
    if (Array.isArray(payload) && payload.length > 0) {
      const role = payload[0]?.role;
      return typeof role === "string" && role.trim() !== "" ? role : null;
    }
    return null;
  } catch (err) {
    console.error("Service role profile REST fetch threw", err);
    return null;
  }
}

export async function requireUser(
  req: Request,
  options: { requireAdmin?: boolean } = {}
): Promise<AuthSuccess | AuthFailure> {
  const token = extractBearerToken(req);
  if (!token) {
    return {
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  const userSupabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
    auth: { persistSession: false },
  });

  const {
    data: { user },
    error: userError,
  } = await userSupabase.auth.getUser(token);

  if (userError || !user) {
    return {
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  let adminSupabase: SupabaseClient | undefined;
  if (supabaseServiceKey) {
    adminSupabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false },
    });
  }

  let role: string | null = null;
  if (adminSupabase) {
    const { data: profile, error: profileError } = await adminSupabase
      .from("profiles")
      .select("role")
      .eq("user_id", user.id)
      .maybeSingle();

    if (profileError) {
      console.warn(
        "Primary profile lookup failed during authorization",
        profileError
      );
      role = await fetchProfileRoleViaService(user.id);
      if (role === null) {
        console.error(
          "Unable to determine user role after fallback profile lookup"
        );
        return {
          error: NextResponse.json(
            { error: "Failed to verify permissions" },
            { status: 500 }
          ),
        };
      }
    }

    if (role === null) {
      role = profile?.role ?? null;
    }
  } else {
    // Fallback: attempt user-context fetch (may be limited by RLS)
    const { data: profile, error: profileError } = await userSupabase
      .from("profiles")
      .select("role")
      .eq("user_id", user.id)
      .maybeSingle();

    if (profileError) {
      console.error(
        "Failed to read profile while authorizing request (anon fallback)",
        profileError
      );
      return {
        error: NextResponse.json(
          { error: "Failed to verify permissions" },
          { status: 500 }
        ),
      };
    }

    role = profile?.role ?? null;
  }

  if (!role) {
    const appMetaRole =
      typeof user.app_metadata?.role === "string"
        ? (user.app_metadata.role as string)
        : null;
    const userMetaRole =
      typeof user.user_metadata?.role === "string"
        ? (user.user_metadata.role as string)
        : null;
    role = appMetaRole ?? userMetaRole ?? null;
  }

  if (options.requireAdmin && role !== "admin") {
    return {
      error: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }

  return {
    supabase: userSupabase,
    userSupabase,
    adminSupabase,
    user,
    role,
    accessToken: token,
  };
}

export async function requireAdmin(req: Request) {
  const result = await requireUser(req, { requireAdmin: true });
  if ("error" in result) {
    return result;
  }

  if (!supabaseServiceKey) {
    return {
      error: NextResponse.json(
        { error: "Admin operations unavailable" },
        { status: 500 }
      ),
    };
  }

  const adminSupabase =
    result.adminSupabase ??
    createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false },
    });

  return {
    ...result,
    supabase: adminSupabase,
    adminSupabase,
    userSupabase: result.userSupabase ?? result.supabase,
  };
}