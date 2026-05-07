import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { FileSpreadsheet, Download, Loader2, ShieldAlert, FileText } from 'lucide-react';
import { useOrganization } from '@/contexts/OrganizationContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/components/ui/sonner';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

type ReportType = 'tasks' | 'holdings' | 'expenses_summary';

const today = () => new Date().toISOString().slice(0, 10);
const monthAgo = () => {
  const d = new Date();
  d.setMonth(d.getMonth() - 1);
  return d.toISOString().slice(0, 10);
};

const toCSV = (rows: Record<string, any>[]): string => {
  if (!rows.length) return '';
  const headers = Object.keys(rows[0]);
  const escape = (v: any) => {
    if (v === null || v === undefined) return '';
    const s = String(v).replace(/"/g, '""');
    return /[",\n]/.test(s) ? `"${s}"` : s;
  };
  return [headers.join(','), ...rows.map((r) => headers.map((h) => escape(r[h])).join(','))].join('\n');
};

const download = (filename: string, content: string) => {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};

const ReportsPage = () => {
  const { organization, role, canManageTasks } = useOrganization();
  const [type, setType] = useState<ReportType>('tasks');
  const [from, setFrom] = useState(monthAgo());
  const [to, setTo] = useState(today());
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<Record<string, any>[]>([]);

  if (!canManageTasks) {
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <Card>
          <CardHeader className="text-center">
            <div className="mx-auto w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center mb-2">
              <ShieldAlert className="w-6 h-6 text-destructive" />
            </div>
            <CardTitle>Access Restricted</CardTitle>
            <CardDescription>
              Reports are available to <strong>Owners</strong> and <strong>Accountants</strong> only.
              Your current role is <Badge variant="secondary" className="ml-1 capitalize">{role ?? 'none'}</Badge>
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const generate = async (): Promise<Record<string, any>[]> => {
    if (!organization) return [];
    if (type === 'tasks') {
      const { data, error } = await supabase
        .from('tasks')
        .select('title, category, status, priority, amount, currency, due_date, assigned_to, approved_by, approved_at, completed_at, created_at')
        .eq('organization_id', organization.id)
        .gte('created_at', `${from}T00:00:00Z`)
        .lte('created_at', `${to}T23:59:59Z`)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    }
    if (type === 'holdings') {
      const { data, error } = await supabase
        .from('holdings')
        .select('symbol, name, asset_type, shares, avg_price, notes, updated_at')
        .eq('organization_id', organization.id)
        .order('symbol');
      if (error) throw error;
      return (data ?? []).map((h: any) => ({
        ...h,
        cost_basis: Number(h.shares) * Number(h.avg_price),
      }));
    }
    // expenses_summary: aggregate tasks with amount by category
    const { data, error } = await supabase
      .from('tasks')
      .select('category, amount, currency, status')
      .eq('organization_id', organization.id)
      .gte('created_at', `${from}T00:00:00Z`)
      .lte('created_at', `${to}T23:59:59Z`);
    if (error) throw error;
    const buckets: Record<string, { category: string; total: number; count: number; completed: number }> = {};
    for (const r of data ?? []) {
      const k = r.category ?? 'general';
      if (!buckets[k]) buckets[k] = { category: k, total: 0, count: 0, completed: 0 };
      buckets[k].total += Number(r.amount ?? 0);
      buckets[k].count += 1;
      if (r.status === 'completed') buckets[k].completed += 1;
    }
    return Object.values(buckets);
  };

  const handlePreview = async () => {
    setLoading(true);
    try {
      const rows = await generate();
      setPreview(rows);
      if (!rows.length) toast.info('No data for the selected range.');
      else toast.success(`Loaded ${rows.length} rows.`);
    } catch (e: any) {
      toast.error(e.message ?? 'Failed to generate report');
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async () => {
    setLoading(true);
    try {
      const rows = preview.length ? preview : await generate();
      if (!rows.length) {
        toast.info('No data to export.');
        return;
      }
      const stamp = new Date().toISOString().slice(0, 10);
      download(`${type}-${stamp}.csv`, toCSV(rows));
      toast.success('Report downloaded.');
    } catch (e: any) {
      toast.error(e.message ?? 'Failed to export report');
    } finally {
      setLoading(false);
    }
  };

  const cols = preview[0] ? Object.keys(preview[0]) : [];

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <FileSpreadsheet className="w-7 h-7 text-primary" />
          Reports
        </h1>
        <p className="text-muted-foreground mt-1">
          Pull financial reports for <span className="font-medium text-foreground">{organization?.name}</span>.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Generate a Report</CardTitle>
          <CardDescription>Select a report type and date range, preview the data, then export to CSV.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label>Report Type</Label>
              <Select value={type} onValueChange={(v) => { setType(v as ReportType); setPreview([]); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="tasks">Tasks &amp; Approvals</SelectItem>
                  <SelectItem value="expenses_summary">Expenses Summary by Category</SelectItem>
                  <SelectItem value="holdings">Portfolio Holdings</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>From</Label>
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} disabled={type === 'holdings'} />
            </div>
            <div className="space-y-2">
              <Label>To</Label>
              <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} disabled={type === 'holdings'} />
            </div>
            <div className="flex items-end gap-2">
              <Button onClick={handlePreview} disabled={loading} variant="outline" className="flex-1">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Preview'}
              </Button>
              <Button onClick={handleDownload} disabled={loading} className="flex-1">
                <Download className="w-4 h-4 mr-1" /> CSV
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {preview.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Preview</CardTitle>
            <CardDescription>{preview.length} rows</CardDescription>
          </CardHeader>
          <CardContent className="overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  {cols.map((c) => <TableHead key={c}>{c}</TableHead>)}
                </TableRow>
              </TableHeader>
              <TableBody>
                {preview.slice(0, 50).map((row, i) => (
                  <TableRow key={i}>
                    {cols.map((c) => (
                      <TableCell key={c} className="text-xs">
                        {row[c] === null || row[c] === undefined ? '—' : String(row[c])}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {preview.length > 50 && (
              <p className="text-xs text-muted-foreground mt-2">Showing first 50 rows. Download CSV for full data.</p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default ReportsPage;
