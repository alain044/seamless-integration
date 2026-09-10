import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ShieldAlert } from 'lucide-react';

export const UNAUTHORIZED_ADMIN_COPY =
  'Unauthorized Access: You do not have permission to access administrative resources.';

export const UnauthorizedAdmin = () => (
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
