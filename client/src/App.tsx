import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";

import Sales from "./pages/Sales";
import Expenses from "./pages/Expenses";
import Receipts from "./pages/Receipts";
import Reports from "./pages/Reports";
import Profile from "./pages/Profile";
import ReceiptScan from "./pages/ReceiptScan";
import CategoryGuide from "./pages/CategoryGuide";
import BatchScan from "./pages/BatchScan";
import ReviewExtracted from "./pages/ReviewExtracted";
import ReceiptDetails from "./pages/ReceiptDetails";
import Login from "./pages/Login";
import Register from "./pages/Register";
import AIAssistant from "./pages/AIAssistant";
import Ledger from "./pages/Ledger";
import GeneralLedger from "./pages/GeneralLedger";
import InvoiceImport from "./pages/InvoiceImport";
import FilingCheck from "./pages/FilingCheck";
import MonthlyClose from "./pages/MonthlyClose";
import FinalReview from "./pages/FinalReview";
import SubmissionPack from "./pages/SubmissionPack";
import OperationsSetup from "./pages/OperationsSetup";
import GoLiveChecklist from "./pages/GoLiveChecklist";
import DeploymentDiagnostics from "./pages/DeploymentDiagnostics";
import { useAuth } from "./_core/hooks/useAuth";
import { DashboardLayoutSkeleton } from "./components/DashboardLayoutSkeleton";

function Router() {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return <DashboardLayoutSkeleton />;
  }

  if (!isAuthenticated) {
    return (
      <Switch>
        <Route path={"/"} component={Home} />
        <Route path={"/login"} component={Login} />
        <Route path={"/register"} component={Register} />
        <Route path={"/404"} component={NotFound} />
        <Route component={NotFound} />
      </Switch>
    );
  }

  return (
    <Switch>
      <Route path={"/"} component={Home} />
      <Route path={"/sales"} component={Sales} />
      <Route path={"/expenses"} component={Expenses} />
      <Route path={"/receipts"} component={Receipts} />
      <Route path={"/batch-scan"} component={BatchScan} />
      <Route path={"/review-extracted"} component={ReviewExtracted} />
      <Route path={"/receipt-details/:id"} component={ReceiptDetails} />
      <Route path={"/reports"} component={Reports} />
      <Route path={"/ledger"} component={Ledger} />
      <Route path={"/general-ledger"} component={GeneralLedger} />
      <Route path={"/profile"} component={Profile} />
      <Route path={"/assistant"} component={AIAssistant} />
      <Route path={"/receipt-scan"} component={ReceiptScan} />
      <Route path={"/invoice-import"} component={InvoiceImport} />
      <Route path={"/filing-check"} component={FilingCheck} />
      <Route path={"/monthly-close"} component={MonthlyClose} />
      <Route path={"/final-review"} component={FinalReview} />
      <Route path={"/submission-pack"} component={SubmissionPack} />
      <Route path={"/operations-setup"} component={OperationsSetup} />
      <Route path={"/go-live-checklist"} component={GoLiveChecklist} />
      <Route path={"/deployment-diagnostics"} component={DeploymentDiagnostics} />
      <Route path={"/category-guide"} component={CategoryGuide} />
      <Route path={"/404"} component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider
        defaultTheme="light"
      >
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
