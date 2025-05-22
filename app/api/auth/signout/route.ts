import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(request: Request) {
  try {
    // Sign out the user
    const { error } = await supabase.auth.signOut();
    
    if (error) {
      console.error('Error signing out:', error);
      return NextResponse.json(
        { error: 'Failed to sign out' },
        { status: 500 }
      );
    }
    
    return NextResponse.json({ success: true });
    
  } catch (err) {
    console.error('Sign out error:', err);
    
    return NextResponse.json(
      { error: 'Sign out failed' },
      { status: 500 }
    );
  }
}
