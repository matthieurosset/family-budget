import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Layout } from "./components/Layout";
import { CategoriesPage } from "./pages/CategoriesPage";
import { DashboardPage } from "./pages/DashboardPage";
import { EnvelopesPage } from "./pages/EnvelopesPage";
import { ImportPage } from "./pages/ImportPage";
import { RulesPage } from "./pages/RulesPage";
import { SettingsPage } from "./pages/SettingsPage";
import { TransactionsPage } from "./pages/TransactionsPage";

const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/transactions" element={<TransactionsPage />} />
            <Route path="/import" element={<ImportPage />} />
            <Route path="/categories" element={<CategoriesPage />} />
            <Route path="/rules" element={<RulesPage />} />
            <Route path="/envelopes" element={<EnvelopesPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
