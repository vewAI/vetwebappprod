import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/app/api/_lib/auth";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

export async function GET(request: NextRequest) {
  const auth = await requireUser(request);
  if ("error" in auth) return auth.error;
  if (auth.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const adminClient = getSupabaseAdminClient();
  if (!adminClient) {
    return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
  }

  // Fetch profiles
  const { data: profiles, error } = await adminClient
    .from("profiles")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ users: profiles });
}

export async function POST(request: NextRequest) {
  const auth = await requireUser(request);
  if ("error" in auth) return auth.error;
  if (auth.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { email, password, role, fullName } = await request.json();
  if (!email || !password) {
    return NextResponse.json({ error: "Email and password required" }, { status: 400 });
  }

  const adminClient = getSupabaseAdminClient();
  if (!adminClient) {
    return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
  }

  // Create user in Auth
  const { data: userData, error: createError } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });

  if (createError) {
    console.error("Failed to create user:", createError);
    // Check for common errors
    if (createError.message?.includes("already registered")) {
        return NextResponse.json({ error: "Email is already registered" }, { status: 409 });
    }
    return NextResponse.json({ error: createError.message }, { status: 500 });
  }

  // Update profile role if needed (trigger creates profile with default 'student')
  // We might need to wait or update explicitly.
  if (role && role !== "student") {
    // Wait a bit for trigger? Or just upsert.
    // Upsert is safer.
    const { error: profileError } = await adminClient
      .from("profiles")
      .update({ role })
      .eq("user_id", userData.user.id);
      
    if (profileError) {
        // If update fails, it might be because profile doesn't exist yet (trigger lag).
        // We can try inserting.
        const { error: insertError } = await adminClient
            .from("profiles")
            .upsert({ user_id: userData.user.id, email, role });
            
        if (insertError) {
             console.error("Failed to set role:", insertError);
        }
    }
  }

  return NextResponse.json({ user: userData.user });
}

export async function PUT(request: NextRequest) {
  const auth = await requireUser(request);
  if ("error" in auth) return auth.error;
  if (auth.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { userId, role, email, password, fullName } = await request.json();
  if (!userId) {
    return NextResponse.json({ error: "User ID required" }, { status: 400 });
  }

  const adminClient = getSupabaseAdminClient();
  if (!adminClient) {
    return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
  }

  // 1. Update Auth User (email, password, metadata)
  const authUpdates: Record<string, unknown> = {};
  if (email) authUpdates.email = email;
  if (password) authUpdates.password = password;
  if (fullName !== undefined) authUpdates.user_metadata = { full_name: fullName };

  if (Object.keys(authUpdates).length > 0) {
    const { error: authError } = await adminClient.auth.admin.updateUserById(
      userId,
      authUpdates
    );
    if (authError) {
      return NextResponse.json({ error: authError.message }, { status: 500 });
    }
  }

  // 2. Update Profile (role, email)
  const profileUpdates: Record<string, unknown> = {};
  if (role) profileUpdates.role = role;
  if (email) profileUpdates.email = email;

  if (Object.keys(profileUpdates).length > 0) {
    const { error: profileError } = await adminClient
      .from("profiles")
      .update(profileUpdates)
      .eq("user_id", userId);

    if (profileError) {
      if (profileError.code === '23505') {
        return NextResponse.json({ error: "Email already in use by another profile" }, { status: 409 });
      }
      return NextResponse.json({ error: profileError.message }, { status: 500 });
    }
  }

  return NextResponse.json({ success: true });
}

export async function DELETE(request: NextRequest) {
  const auth = await requireUser(request);
  if ("error" in auth) return auth.error;
  if (auth.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId");

  if (!userId) {
    return NextResponse.json({ error: "User ID required" }, { status: 400 });
  }

  const adminClient = getSupabaseAdminClient();
  if (!adminClient) {
    return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
  }

  const { error } = await adminClient.auth.admin.deleteUser(userId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Profile should be deleted by cascade if configured, or we delete manually
  await adminClient.from("profiles").delete().eq("user_id", userId);

  return NextResponse.json({ success: true });
}
