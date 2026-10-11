import { createClient } from '@supabase/supabase-js';
import type { UserSession } from '../types';
const url = import.meta.env?.VITE_SUPABASE_URL;
const key = import.meta.env?.VITE_SUPABASE_ANON_KEY;
export const cloudConfigured = Boolean(url && key);
export const supabase = cloudConfigured ? createClient(url, key) : null;
async function profile(): Promise<UserSession | null> {
  if (!supabase) return null;
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return null;
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error) throw error;
  if (!user) return null;
  const { data, error: profileError } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (profileError) throw new Error('Cannot load profile. Apply the database migration and check the connection.');
  return { userId: user.id, email: user.email, role: data.role, authMode: 'cloud' };
}
export const authService = {
  restore: profile,
  async login(email: string, password: string) {
    if (!supabase) throw new Error('Cloud login is not configured.');
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    const user = await profile();
    if (!user) throw new Error('Sign-in did not create a session.');
    return user;
  },
  async register(email: string, password: string) {
    if (!supabase) throw new Error('Cloud login is not configured.');
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) throw error;
  },
  async logout() {
    if (supabase) {
      const { error } = await supabase.auth.signOut({ scope: 'local' });
      if (error) throw error;
    }
  }
};
