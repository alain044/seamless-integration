import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { motion } from "framer-motion";
import { Sparkles, Lock, Feather, Target, Eye, Brain, Receipt, Utensils, Car, Tv, Home, ShoppingBag, HeartPulse } from "lucide-react";

const values = [
  {
    icon: Sparkles,
    title: "Innovation",
    description: "We push the boundaries of AI to reimagine how people interact with their money.",
  },
  {
    icon: Lock,
    title: "Security",
    description: "Your financial data is sacred. We protect it with bank-grade encryption and strict privacy.",
  },
  {
    icon: Feather,
    title: "Simplicity",
    description: "Finance shouldn't be complicated. We make powerful tools that anyone can use.",
  },
];

const team = [
  { name: "Alex Chen", role: "CEO & Co-Founder", initials: "AC" },
  { name: "Maya Patel", role: "Head of AI", initials: "MP" },
  { name: "Jordan Kim", role: "Head of Product", initials: "JK" },
  { name: "Sam Rivera", role: "Lead Engineer", initials: "SR" },
];

export default function About() {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1 pt-24 pb-20">
        <section className="container mx-auto px-4">
          {/* Hero */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="text-center max-w-3xl mx-auto mb-20"
          >
            <h1 className="font-heading text-4xl sm:text-5xl font-bold tracking-tight">
              About <span className="gradient-text">SavvyAI</span>
            </h1>
            <p className="mt-5 text-lg text-muted-foreground leading-relaxed">
              We're on a mission to make smart financial decisions accessible to everyone.
              By combining cutting-edge AI with intuitive design, we're transforming how people
              understand, manage, and grow their money.
            </p>
          </motion.div>

          {/* Mission & Vision */}
          <div className="grid md:grid-cols-2 gap-6 max-w-5xl mx-auto mb-20">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
              className="glass-card rounded-2xl p-8"
            >
              <div className="gradient-primary rounded-lg p-3 w-fit mb-4">
                <Target className="h-6 w-6 text-primary-foreground" />
              </div>
              <h2 className="font-heading text-2xl font-bold mb-3">Our Mission</h2>
              <p className="text-muted-foreground leading-relaxed">
                To simplify financial decision-making for everyone through accessible, intelligent,
                and trustworthy AI-powered tools.
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
              className="glass-card rounded-2xl p-8"
            >
              <div className="gradient-primary rounded-lg p-3 w-fit mb-4">
                <Eye className="h-6 w-6 text-primary-foreground" />
              </div>
              <h2 className="font-heading text-2xl font-bold mb-3">Our Vision</h2>
              <p className="text-muted-foreground leading-relaxed">
                A world where financial literacy is universal and every person has a personal AI advisor
                helping them build a secure, prosperous future.
              </p>
            </motion.div>
          </div>

          {/* AI Insights & Expenses */}
          <div className="grid md:grid-cols-2 gap-6 max-w-5xl mx-auto mb-20">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
              className="glass-card rounded-2xl p-8 hover:shadow-glow transition-shadow"
            >
              <div className="gradient-primary rounded-lg p-3 w-fit mb-4">
                <Brain className="h-6 w-6 text-primary-foreground" />
              </div>
              <h2 className="font-heading text-2xl font-bold mb-3">AI Insights</h2>
              <p className="text-muted-foreground leading-relaxed mb-6">
                Our AI continuously analyzes your financial behavior to surface personalized insights,
                detect patterns, and recommend smarter decisions in real time.
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-secondary/50 rounded-lg p-3">
                  <div className="font-heading font-bold text-lg text-primary">2.4M</div>
                  <div className="text-xs text-muted-foreground">Signals Analyzed</div>
                </div>
                <div className="bg-secondary/50 rounded-lg p-3">
                  <div className="font-heading font-bold text-lg text-primary">94.7%</div>
                  <div className="text-xs text-muted-foreground">Accuracy Score</div>
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="glass-card rounded-2xl p-8 hover:shadow-glow transition-shadow"
            >
              <div className="gradient-primary rounded-lg p-3 w-fit mb-4">
                <Receipt className="h-6 w-6 text-primary-foreground" />
              </div>
              <h2 className="font-heading text-2xl font-bold mb-3">Expenses</h2>
              <p className="text-muted-foreground leading-relaxed mb-6">
                Track every transaction effortlessly. Savvy auto-categorizes your expenses
                so you always know where your money goes — and how to save more.
              </p>
              {(() => {
                const categories = [
                  { label: "Food", value: 28, icon: Utensils, color: "hsl(var(--primary))" },
                  { label: "Transport", value: 18, icon: Car, color: "hsl(var(--accent))" },
                  { label: "Housing", value: 22, icon: Home, color: "hsl(199 89% 60%)" },
                  { label: "Subscriptions", value: 10, icon: Tv, color: "hsl(280 80% 65%)" },
                  { label: "Shopping", value: 14, icon: ShoppingBag, color: "hsl(330 80% 60%)" },
                  { label: "Health", value: 8, icon: HeartPulse, color: "hsl(150 70% 50%)" },
                ];
                const gradientStops: string[] = [];
                let acc = 0;
                categories.forEach((c) => {
                  const start = acc;
                  acc += c.value;
                  gradientStops.push(`${c.color} ${start}% ${acc}%`);
                });
                return (
                  <div className="flex flex-col sm:flex-row items-center gap-6">
                    <div
                      className="relative shrink-0 w-32 h-32 rounded-full"
                      style={{ background: `conic-gradient(${gradientStops.join(", ")})` }}
                    >
                      <div className="absolute inset-3 rounded-full bg-card flex flex-col items-center justify-center">
                        <span className="font-heading font-bold text-xl">100%</span>
                        <span className="text-[10px] text-muted-foreground">Tracked</span>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 flex-1 w-full">
                      {categories.map((c) => (
                        <div
                          key={c.label}
                          className="flex items-center gap-2 bg-secondary/50 rounded-lg p-2"
                        >
                          <div
                            className="rounded-md p-1.5 shrink-0"
                            style={{ backgroundColor: `${c.color}` }}
                          >
                            <c.icon className="h-3.5 w-3.5 text-primary-foreground" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="text-xs font-medium truncate">{c.label}</div>
                            <div className="text-[10px] text-muted-foreground">{c.value}%</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </motion.div>
          </div>

          {/* Core Values */}
          <div className="max-w-5xl mx-auto mb-20">
            <h2 className="font-heading text-3xl font-bold text-center mb-10">Our Core Values</h2>
            <div className="grid md:grid-cols-3 gap-6">
              {values.map((v, i) => (
                <motion.div
                  key={v.title}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: i * 0.1 }}
                  className="glass-card rounded-xl p-6 text-center hover:shadow-glow transition-shadow"
                >
                  <div className="gradient-primary rounded-full p-3 w-fit mx-auto mb-4">
                    <v.icon className="h-6 w-6 text-primary-foreground" />
                  </div>
                  <h3 className="font-heading font-semibold text-lg mb-2">{v.title}</h3>
                  <p className="text-sm text-muted-foreground">{v.description}</p>
                </motion.div>
              ))}
            </div>
          </div>

          {/* Team */}
          <div className="max-w-5xl mx-auto">
            <h2 className="font-heading text-3xl font-bold text-center mb-10">Meet the Team</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              {team.map((m, i) => (
                <motion.div
                  key={m.name}
                  initial={{ opacity: 0, scale: 0.9 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: i * 0.1 }}
                  className="text-center"
                >
                  <div className="gradient-primary rounded-full w-24 h-24 mx-auto mb-3 flex items-center justify-center font-heading text-2xl font-bold text-primary-foreground shadow-glow">
                    {m.initials}
                  </div>
                  <h4 className="font-semibold">{m.name}</h4>
                  <p className="text-sm text-muted-foreground">{m.role}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
