import { Link, useLocation } from "react-router-dom";
import { MessageCircle } from "lucide-react";
import { motion } from "framer-motion";

export function AskSavvyButton() {
  const location = useLocation();

  // Hide on the chat page and in the dashboard (where AI Insights lives)
  if (location.pathname === "/chat" || location.pathname.startsWith("/dashboard")) return null;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ delay: 0.3, type: "spring", stiffness: 200 }}
      className="fixed bottom-6 right-6 z-50"
    >
      <Link
        to="/chat"
        aria-label="Ask Savvy AI"
        className="group flex items-center gap-2 gradient-primary text-primary-foreground rounded-full pl-4 pr-5 py-3 shadow-glow hover:shadow-xl transition-all hover:scale-105"
      >
        <MessageCircle className="h-5 w-5" />
        <span className="font-medium text-sm">Ask Savvy</span>
        <span className="absolute inset-0 rounded-full gradient-primary opacity-0 group-hover:opacity-30 blur-xl -z-10 transition-opacity" />
      </Link>
    </motion.div>
  );
}
