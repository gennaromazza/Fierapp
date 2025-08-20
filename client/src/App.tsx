import { Switch, Route } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "./hooks/useAuth";
import { CartProvider } from "./hooks/useCart";
import { useBrandColors } from "./hooks/useBrandColors";
import { useABFlag } from "./hooks/useABFlag";
import Home from "./pages/Home";
import Admin from "./pages/Admin";
import AdminLogin from "./pages/AdminLogin";
import QuoteView from "./pages/QuoteView";
import NotFound from "@/pages/not-found";

function Router() {
  const abFlag = useABFlag();
  
  const HomeWithFlags = () => <Home enableGuide={abFlag.isEnabled('guide_v1')} />;
  
  return (
    <Switch>
      {/* Root routes */}
      <Route path="/" component={HomeWithFlags} />
      <Route path="/admin/login" component={AdminLogin} />
      <Route path="/admin" component={Admin} />
      <Route path="/quote/:id" component={QuoteView} />
      
      {/* Fiera prefixed routes */}
      <Route path="/fiera/" component={HomeWithFlags} />
      <Route path="/fiera/admin/login" component={AdminLogin} />
      <Route path="/fiera/admin" component={Admin} />
      <Route path="/fiera/quote/:id" component={QuoteView} />
      
      <Route component={NotFound} />
    </Switch>
  );
}

function AppContent() {
  // Apply dynamic brand colors from Firebase settings
  useBrandColors();

  return (
    <AuthProvider>
      <CartProvider>
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </CartProvider>
    </AuthProvider>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppContent />
    </QueryClientProvider>
  );
}

export default App;
