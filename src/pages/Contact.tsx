import { useState } from "react";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Mail, Phone, MapPin, Send, CheckCircle2 } from "lucide-react";
import { motion } from "framer-motion";
import { z } from "zod";
import { toast } from "sonner";

const contactSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100, "Name must be under 100 characters"),
  email: z.string().trim().email("Please enter a valid email").max(255),
  message: z.string().trim().min(10, "Message must be at least 10 characters").max(1000, "Message must be under 1000 characters"),
});

type FormErrors = Partial<Record<keyof z.infer<typeof contactSchema>, string>>;

export default function Contact() {
  const [form, setForm] = useState({ name: "", email: "", message: "" });
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const result = contactSchema.safeParse(form);
    if (!result.success) {
      const fieldErrors: FormErrors = {};
      result.error.issues.forEach((issue) => {
        const key = issue.path[0] as keyof FormErrors;
        if (key) fieldErrors[key] = issue.message;
      });
      setErrors(fieldErrors);
      return;
    }
    setErrors({});
    setSubmitted(true);
    toast.success("Message sent! We'll get back to you soon.");
    setForm({ name: "", email: "", message: "" });
    setTimeout(() => setSubmitted(false), 5000);
  };

  const contactInfo = [
    { icon: Mail, label: "Email", value: "hello@savvyai.com" },
    { icon: Phone, label: "Phone", value: "+(250) 780 407 924" },
    { icon: MapPin, label: "Location", value: "Kigali, Rwanda" },
  ];

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1 pt-24 pb-20">
        <section className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="text-center max-w-2xl mx-auto mb-16"
          >
            <h1 className="font-heading text-4xl sm:text-5xl font-bold tracking-tight">
              Get in <span className="gradient-text">Touch</span>
            </h1>
            <p className="mt-5 text-lg text-muted-foreground">
              Questions, feedback, or partnership ideas? We'd love to hear from you.
            </p>
          </motion.div>

          <div className="grid lg:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {/* Contact Info */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="space-y-4"
            >
              {contactInfo.map((info) => (
                <div key={info.label} className="glass-card rounded-xl p-5 flex items-start gap-4">
                  <div className="gradient-primary rounded-lg p-2.5 shrink-0">
                    <info.icon className="h-5 w-5 text-primary-foreground" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">{info.label}</p>
                    <p className="font-medium mt-0.5">{info.value}</p>
                  </div>
                </div>
              ))}
            </motion.div>

            {/* Form */}
            <motion.form
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              onSubmit={handleSubmit}
              className="glass-card rounded-2xl p-8 space-y-5 lg:col-span-2"
              noValidate
            >
              {submitted && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center gap-2 p-3 rounded-lg bg-primary/10 border border-primary/30 text-sm"
                >
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                  <span>Thanks! Your message has been sent successfully.</span>
                </motion.div>
              )}

              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Your full name"
                  aria-invalid={!!errors.name}
                />
                {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="you@example.com"
                  aria-invalid={!!errors.email}
                />
                {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="message">Message</Label>
                <Textarea
                  id="message"
                  rows={6}
                  value={form.message}
                  onChange={(e) => setForm({ ...form, message: e.target.value })}
                  placeholder="How can we help?"
                  aria-invalid={!!errors.message}
                />
                {errors.message && <p className="text-xs text-destructive">{errors.message}</p>}
              </div>

              <Button
                type="submit"
                className="w-full gradient-primary text-primary-foreground border-0 shadow-glow hover:scale-[1.02] transition-transform"
                size="lg"
              >
                <Send className="h-4 w-4 mr-2" /> Send Message
              </Button>
            </motion.form>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
