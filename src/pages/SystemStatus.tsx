import { HealthCheckPanel } from '@/components/HealthCheckPanel';

const SystemStatus = () => (
  <div className="p-6 max-w-3xl mx-auto space-y-4">
    <div>
      <h1 className="text-3xl font-bold text-foreground">System Status</h1>
      <p className="text-muted-foreground mt-1">Diagnose the backend services that power your dashboard.</p>
    </div>
    <HealthCheckPanel />
  </div>
);

export default SystemStatus;
