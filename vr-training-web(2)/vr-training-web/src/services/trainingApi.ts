import { supabase } from './authService';
import type { SessionResult } from '../types';
export const trainingApi = {
  async save(session: SessionResult) {
    if (!supabase) throw new Error('Cloud storage is not configured.');
    const { error } = await supabase.rpc('save_training_session', { p_session: session });
    if (error) throw error;
  },
  async list(): Promise<SessionResult[]> {
    if (!supabase) throw new Error('Cloud storage is not configured.');
    const sessions: SessionResult[] = [];
    for (let start = 0; ; start += 500) {
      const { data, error } = await supabase.from('training_sessions').select('payload').order('id').range(start, start + 499);
      if (error) throw error;
      sessions.push(...data.map(row => row.payload as SessionResult));
      if (data.length < 500) return sessions;
    }
  }
};
