import { Bot } from "lucide-react";
import { Link } from "react-router-dom";

const footerLinks = {
  Product: ["Features", "Pricing", "Security", "Integrations"],
  Company: ["About", "Careers", "Blog", "Press"],
  Resources: ["Documentation", "API Reference", "Community", "Support"],
  Legal: ["Privacy Policy", "Terms of Service", "Cookie Policy"],
};

export function Footer() {
  return (
    <footer className="border-t border-border bg-card" id="contact">
      <div className="container mx-auto px-4 py-16">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-8">
          <div className="col-span-2 md:col-span-1">
            <Link to="/" className="flex items-center gap-2 mb-4">
              <div className="gradient-primary rounded-lg p-1.5">
                <Bot className="h-5 w-5 text-primary-foreground" />
              </div>
              <span className="font-heading text-lg font-bold">SavvyAI</span>
            </Link>
            <p className="text-sm text-muted-foreground">
              AI-powered finance intelligence for smarter decisions.
            </p>
          </div>
          {Object.entries(footerLinks).map(([category, links]) => (
            <div key={category}>
              <h4 className="font-heading font-semibold text-sm mb-3">{category}</h4>
              <ul className="space-y-2">
                {links.map((link) => (
                  <li key={link}>
                    <a href="#" className="text-sm text-muted-foreground hover:text-primary transition-colors">
                      {link}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-12 pt-8 border-t border-border flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-sm text-muted-foreground">
            © 2026 SavvyAI. All rights reserved.
          </p>
          <div className="flex gap-6">
            <a href="#" className="text-sm text-muted-foreground hover:text-primary transition-colors">Twitter</a>
            <a href="#" className="text-sm text-muted-foreground hover:text-primary transition-colors">LinkedIn</a>
            <a href="#" className="text-sm text-muted-foreground hover:text-primary transition-colors">GitHub</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
