import { Brain, LineChart, Shield, Zap, PieChart, Bell } from "lucide-react";
import { motion } from "framer-motion";

const features = [
  {
    icon: Brain,
    title: "AI Market Analysis",
    description: "Deep learning models analyze thousands of data points to identify market opportunities.",
  },
  {
    icon: LineChart,
    title: "Predictive Analytics",
    description: "Forecast market trends with machine learning algorithms trained on decades of financial data.",
  },
  {
    icon: Shield,
    title: "Risk Assessment",
    description: "Automated risk scoring and portfolio stress testing powered by neural networks.",
  },
  {
    icon: Zap,
    title: "Real-Time Insights",
    description: "Get instant AI-generated insights on market movements and portfolio performance.",
  },
  {
    icon: PieChart,
    title: "Smart Portfolio",
    description: "AI-optimized portfolio allocation that adapts to changing market conditions.",
  },
  {
    icon: Bell,
    title: "Intelligent Alerts",
    description: "Custom alerts powered by NLP that filter noise and surface what matters.",
  },
];

export function FeaturesSection() {
  return (
    <section className="py-24 bg-background" id="features">
      <div className="container mx-auto px-4">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <h2 className="font-heading text-3xl sm:text-4xl font-bold">
            Powered by <span className="gradient-text">Intelligence</span>
          </h2>
          <p className="mt-4 text-muted-foreground">
            Our AI engine processes millions of data points to give you an edge in financial decision making.
          </p>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature, i) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: i * 0.1 }}
              className="glass-card rounded-xl p-6 hover:shadow-glow transition-shadow duration-300 group"
            >
              <div className="gradient-primary rounded-lg p-2.5 w-fit mb-4 group-hover:scale-110 transition-transform">
                <feature.icon className="h-5 w-5 text-primary-foreground" />
              </div>
              <h3 className="font-heading font-semibold text-lg mb-2">{feature.title}</h3>
              <p className="text-sm text-muted-foreground">{feature.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
