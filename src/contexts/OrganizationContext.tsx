import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './AuthContext';

export type AppRole = 'owner' | 'accountant' | 'analyst' | 'viewer';

export interface Organization {
  id: string;
  name: string;
  type: string;
  description: string | null;
  created_by: string;
}

export interface Membership {
  organization: Organization;
  role: AppRole;
}

interface OrgContextValue {
  organization: Organization | null;
  role: AppRole | null;
  memberships: Membership[];
  loading: boolean;
  refresh: () => Promise<void>;
  switchOrganization: (orgId: string) => Promise<void>;
  canManageTasks: boolean;
  canEditFinance: boolean;
  isOwner: boolean;
  isViewer: boolean;
  canEdit: boolean;
}

const OrganizationContext = createContext<OrgContextValue>({
  organization: null,
  role: null,
  memberships: [],
  loading: true,
  refresh: async () => {},
  switchOrganization: async () => {},
  canManageTasks: false,
  canEditFinance: false,
  isOwner: false,
  isViewer: false,
  canEdit: false,
});

export const useOrganization = () => useContext(OrganizationContext);

export const OrganizationProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user) {
      setMemberships([]);
      setActiveId(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const [{ data: rows }, { data: settings }] = await Promise.all([
      supabase
        .from('organization_members')
        .select('role, organizations(*)')
        .eq('user_id', user.id),
      supabase
        .from('user_settings')
        .select('active_organization_id')
        .eq('user_id', user.id)
        .maybeSingle(),
    ]);

    const list: Membership[] = (rows ?? [])
      .filter((r: any) => r.organizations)
      .map((r: any) => ({ organization: r.organizations, role: r.role }));
    setMemberships(list);

    const stored = (settings as any)?.active_organization_id ?? null;
    const valid = list.find((m) => m.organization.id === stored);
    setActiveId(valid ? stored : list[0]?.organization.id ?? null);
    setLoading(false);
  }, [user]);

  useEffect(() => { refresh(); }, [refresh]);

  const switchOrganization = useCallback(async (orgId: string) => {
    if (!user) return;
    setActiveId(orgId);
    await supabase
      .from('user_settings')
      .upsert({ user_id: user.id, active_organization_id: orgId } as any, { onConflict: 'user_id' });
  }, [user]);

  const active = memberships.find((m) => m.organization.id === activeId) ?? null;
  const organization = active?.organization ?? null;
  const role = active?.role ?? null;

  const canManageTasks = role === 'owner' || role === 'accountant';
  const canEditFinance = role === 'owner' || role === 'accountant' || role === 'analyst';
  const isOwner = role === 'owner';
  const isViewer = role === 'viewer';
  const canEdit = role !== 'viewer' && role !== null;

  return (
    <OrganizationContext.Provider
      value={{ organization, role, memberships, loading, refresh, switchOrganization, canManageTasks, canEditFinance, isOwner, isViewer, canEdit }}
    >
      {children}
    </OrganizationContext.Provider>
  );
};
