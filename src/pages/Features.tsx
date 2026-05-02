import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { motion } from "framer-motion";
import { TrendingUp, Wallet, BarChart3, Tags, Lightbulb, ShieldCheck } from "lucide-react";

const features = [
  {
    icon: TrendingUp,
    title: "AI Market Predictions",
    description: "Forecast market movements with deep-learning models trained on decades of financial data.",
  },
  {
    icon: Wallet,
    title: "Smart Budget Tracking",
    description: "Automatically track your spending and stay on top of your financial goals every month.",
  },
  {
    icon: BarChart3,
    title: "Real-time Analytics Dashboard",
    description: "Beautiful, live dashboards that surface what matters about your money — instantly.",
  },
  {
    icon: Tags,
    title: "Expense Categorization",
    description: "AI auto-categorizes every transaction so you always know where your money goes.",
  },
  {
    icon: Lightbulb,
    title: "Investment Insights",
    description: "Personalized investment ideas powered by your goals, risk tolerance, and market signals.",
  },
  {
    icon: ShieldCheck,
    title: "Secure Data Encryption",
    description: "Bank-grade encryption and zero-knowledge architecture keep your data fully private.",
  },
];

export default function Features() {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1 pt-24 pb-20">
        <section className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="text-center max-w-3xl mx-auto mb-16"
          >
            <h1 className="font-heading text-4xl sm:text-5xl font-bold tracking-tight">
              Powerful Features for <span className="gradient-text">Smarter Finance</span>
            </h1>
            <p className="mt-5 text-lg text-muted-foreground">
              Everything you need to manage, grow, and understand your money — powered by AI.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, i) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.08 }}
                className="glass-card rounded-xl p-6 hover:shadow-glow hover:-translate-y-1 transition-all duration-300 group"
              >
                <div className="gradient-primary rounded-lg p-3 w-fit mb-4 group-hover:scale-110 transition-transform">
                  <feature.icon className="h-6 w-6 text-primary-foreground" />
                </div>
                <h3 className="font-heading font-semibold text-xl mb-2">{feature.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{feature.description}</p>
              </motion.div>
            ))}
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
