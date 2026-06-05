import { useEffect, useState, ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/contexts/OrganizationContext';
import { Loader2, ShieldAlert } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { UNAUTHORIZED_ADMIN_COPY } from './UnauthorizedAdmin';

export const AdminGuard = ({ children }: { children: ReactNode }) => {
  const { organization, isOwner, loading: orgLoading } = useOrganization();
  const location = useLocation();
  const [state, setState] = useState<'checking' | 'verified' | 'unverified' | 'denied'>('checking');

  useEffect(() => {
    if (orgLoading || !organization) return;
    if (!isOwner) { setState('denied'); return; }
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(
        `https://svixhxkbroelwmpxynjy.supabase.co/functions/v1/admin-check?organization_id=${organization.id}`,
        { headers: { Authorization: `Bearer ${session?.access_token}` } },
      );
      const json = await res.json();
      setState(json.verified ? 'verified' : 'unverified');
    })();
  }, [organization, isOwner, orgLoading, location.pathname]);

  if (orgLoading || state === 'checking') {
    return <div className="flex items-center justify-center h-96"><Loader2 className="w-6 h-6 animate-spin" /></div>;
  }

  if (state === 'denied') {
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <Card>
          <CardHeader className="text-center">
            <div className="mx-auto w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center mb-2">
              <ShieldAlert className="w-6 h-6 text-destructive" />
            </div>
            <CardTitle>Unauthorized Access</CardTitle>
            <CardDescription>{UNAUTHORIZED_ADMIN_COPY}</CardDescription>
          </CardHeader>
          <CardContent />
        </Card>
      </div>
    );
  }

  if (state === 'unverified') {
    return <Navigate to="/dashboard/admin/verify" replace state={{ from: location.pathname }} />;
  }

  return <>{children}</>;
};
