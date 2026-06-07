import { supabase } from '@/integrations/supabase/client';

export type SecurityEventType =
  | 'login_success'
  | 'login_failed'
  | 'logout'
  | 'password_changed'
  | 'mfa_verified'
  | 'mfa_failed'
  | 'unauthorized_admin'
  | 'session_expired';

export async function logSecurityEvent(
  event_type: SecurityEventType,
  opts: { user_id?: string | null; route?: string | null; metadata?: Record<string, unknown> } = {},
) {
  try {
    await supabase.from('security_events').insert({
      user_id: opts.user_id ?? null,
      event_type,
      route: opts.route ?? (typeof window !== 'undefined' ? window.location.pathname : null),
      user_agent: typeof navigator !== 'undefined' ? navigator.userAgent.slice(0, 500) : null,
      metadata: opts.metadata ?? {},
    });
  } catch (e) {
    // Logging must never block flow
    console.warn('security log failed', e);
  }
}
