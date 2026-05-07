import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { ShieldCheck, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/contexts/OrganizationContext';
import { toast } from '@/components/ui/sonner';

const AdminVerifyPage = () => {
  const { organization, isOwner } = useOrganization();
  const navigate = useNavigate();
  const location = useLocation() as any;
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!organization || !isOwner) { toast.error('Unauthorized'); return; }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('admin-stepup', {
        body: { password, organization_id: organization.id },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast.success('Admin access granted (15 min)');
      navigate(location.state?.from || '/dashboard/admin', { replace: true });
    } catch (err: any) {
      toast.error(err.message || 'Verification failed');
    } finally {
      setLoading(false);
      setPassword('');
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-2">
            <ShieldCheck className="w-6 h-6 text-primary" />
          </div>
          <CardTitle>Admin verification</CardTitle>
          <CardDescription>
            Re-enter your account password to access the admin dashboard. Access expires after 15 minutes.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="admin-pw">Password</Label>
              <Input id="admin-pw" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoFocus />
            </div>
            <Button type="submit" className="w-full" disabled={loading || !password}>
              {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Verify &amp; continue
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminVerifyPage;
