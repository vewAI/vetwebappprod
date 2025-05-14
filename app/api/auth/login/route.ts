import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    // Initialize Supabase client
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    // Get request body
    const { email, password } = await request.json();

    // Validate inputs
    if (!email || !password) {
      return NextResponse.json(
        { error: { message: 'Email and password are required' } },
        { status: 400 }
      );
    }

    // Sign in with Supabase
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      return NextResponse.json(
        { error: { message: error.message } },
        { status: 401 }
      );
    }

    // Return success response
    return NextResponse.json({ data }, { status: 200 });
  } catch (error: any) {
    console.error('Login error:', error);
    return NextResponse.json(
      { error: { message: 'An unexpected error occurred' } },
      { status: 500 }
    );
  }
}
