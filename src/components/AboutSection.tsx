import { motion } from "framer-motion";
import { CheckCircle } from "lucide-react";

const points = [
  "Founded by ex-Wall Street quants and AI researchers",
  "Processing over 10 million data points daily",
  "SOC 2 Type II certified and bank-level encryption",
  "Trusted by 500+ financial institutions worldwide",
];

export function AboutSection() {
  return (
    <section className="py-24 bg-card" id="about">
      <div className="container mx-auto px-4">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <h2 className="font-heading text-3xl sm:text-4xl font-bold mb-6">
              The Future of Finance is <span className="gradient-text">Intelligent</span>
            </h2>
            <p className="text-muted-foreground mb-8">
              SavvyAI combines cutting-edge artificial intelligence with deep financial expertise to democratize access to institutional-grade analytics. Our platform empowers everyone from individual investors to enterprise teams.
            </p>
            <ul className="space-y-4">
              {points.map((point) => (
                <li key={point} className="flex items-start gap-3">
                  <CheckCircle className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                  <span className="text-sm">{point}</span>
                </li>
              ))}
            </ul>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="relative"
          >
            <div className="glass-card rounded-2xl p-8 shadow-glow">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">AI Confidence Score</span>
                  <span className="font-heading font-bold text-primary">94.7%</span>
                </div>
                <div className="h-2 rounded-full bg-secondary overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    whileInView={{ width: "94.7%" }}
                    viewport={{ once: true }}
                    transition={{ duration: 1.2, delay: 0.5 }}
                    className="h-full gradient-primary rounded-full"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4 pt-4">
                  {[
                    { label: "Signals Analyzed", value: "2.4M" },
                    { label: "Avg. Response", value: "< 50ms" },
                    { label: "Models Active", value: "127" },
                    { label: "Uptime", value: "99.99%" },
                  ].map((item) => (
                    <div key={item.label} className="bg-secondary/50 rounded-lg p-3">
                      <div className="font-heading font-bold text-lg">{item.value}</div>
                      <div className="text-xs text-muted-foreground">{item.label}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
