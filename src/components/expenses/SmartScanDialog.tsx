import { useRef, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScanLine, Loader2, Upload } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const fileToDataUrl = (file: File) => new Promise<string>((res, rej) => {
  const r = new FileReader();
  r.onload = () => res(r.result as string);
  r.onerror = rej;
  r.readAsDataURL(file);
});

const extractPdfText = async (file: File): Promise<string> => {
  const pdfjs: any = await import('pdfjs-dist');
  pdfjs.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;
  const buf = await file.arrayBuffer();
  const doc = await pdfjs.getDocument({ data: buf }).promise;
  let out = '';
  const max = Math.min(doc.numPages, 20);
  for (let i = 1; i <= max; i++) {
    const page = await doc.getPage(i);
    const tc = await page.getTextContent();
    out += tc.items.map((it: any) => it.str).join(' ') + '\n\n';
  }
  return out.trim();
};

export const SmartScanDialog = ({ onImported }: { onImported?: () => void }) => {
  const [open, setOpen] = useState(false);
  const [scanning, setScanning] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    setScanning(true);
    try {
      const body: any = { fileName: file.name };
      if (file.type === 'application/pdf') {
        toast.info('Reading PDF…');
        body.pdfText = await extractPdfText(file);
      } else if (file.type.startsWith('image/')) {
        body.imageBase64 = await fileToDataUrl(file);
      } else {
        toast.error('Unsupported file type. Use an image or PDF.');
        setScanning(false);
        return;
      }
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/smartscan-extract`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token ?? import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'SmartScan failed');
      toast.success(`Imported ${json.inserted} transaction${json.inserted === 1 ? '' : 's'}`);
      setOpen(false);
      onImported?.();
    } catch (e: any) {
      toast.error(e.message || 'Scan failed');
    } finally {
      setScanning(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline"><ScanLine className="w-4 h-4 mr-2" /> SmartScan</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><ScanLine className="w-5 h-5 text-primary" /> SmartScan AI</DialogTitle>
          <DialogDescription>
            Upload a receipt, invoice, bill, bank statement (PDF or image). AI extracts and categorizes transactions automatically.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <label className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-border rounded-xl p-8 cursor-pointer hover:border-primary transition-colors">
            {scanning ? (
              <>
                <Loader2 className="w-8 h-8 text-primary animate-spin" />
                <p className="text-sm text-muted-foreground">Analyzing document…</p>
              </>
            ) : (
              <>
                <Upload className="w-8 h-8 text-muted-foreground" />
                <p className="text-sm font-medium">Click to choose a file</p>
                <p className="text-xs text-muted-foreground">PDF, JPG, PNG · up to 10MB</p>
              </>
            )}
            <input
              ref={inputRef}
              type="file"
              accept="image/*,application/pdf"
              className="hidden"
              disabled={scanning}
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
            />
          </label>
        </div>
      </DialogContent>
    </Dialog>
  );
};
