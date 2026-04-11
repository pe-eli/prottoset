import { useEffect, useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Header } from './components/layout/Header';
import { Footer } from './components/layout/Footer';
import { WaBlastProvider } from './contexts/WaBlastContext';
import { WaBlastIndicator } from './components/WaBlastIndicator';
import { authAPI } from './features/auth/auth.api';
import { LandingPage } from './pages/LandingPage';
import { HomePage } from './pages/HomePage';
import { NewQuotePage } from './pages/NewQuotePage';
import { PackagesQuotePage } from './pages/PackagesQuotePage';
import { LeadsHub } from './pages/LeadsHub';
import { LeadsDashboard } from './pages/LeadsDashboard';
import { EmailBlastPage } from './pages/EmailBlastPage';
import { WhatsAppBlastPage } from './pages/WhatsAppBlastPage';
import { ContactsPage } from './pages/ContactsPage';
import { ProductivityDashboard } from './pages/ProductivityDashboard';
import { DailyEntryPage } from './pages/DailyEntryPage';
import { WeeklyViewPage } from './pages/WeeklyViewPage';
import { SchedulePage } from './pages/SchedulePage';
import { LoginPage } from './pages/LoginPage';

function App() {
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);

  useEffect(() => {
    let mounted = true;
    authAPI
      .me()
      .then(() => {
        if (!mounted) return;
        setAuthenticated(true);
      })
      .catch(() => {
        if (!mounted) return;
        setAuthenticated(false);
      })
      .finally(() => {
        if (!mounted) return;
        setCheckingAuth(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  if (checkingAuth) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center animate-fade-in">
          <div className="mx-auto h-9 w-9 rounded-full border-2 border-brand-200 border-t-brand-500 animate-spin" />
          <p className="mt-3 text-sm text-brand-500">Verificando acesso...</p>
        </div>
      </div>
    );
  }

  if (!authenticated) {
    return <LoginPage onAuthenticated={() => setAuthenticated(true)} />;
  }

  return (
    <BrowserRouter>
      <WaBlastProvider>
        <div className="min-h-screen flex flex-col bg-background">
          <Routes>
            <Route index element={<LandingPage />} />
            <Route path="/login" element={<Navigate to="/" replace />} />
            {/* Landing sem Header/Footer */}
            <Route path="/landing" element={<Navigate to="/" replace />} />

            {/* App com layout completo */}
            <Route path="*" element={
              <>
                <Header />
                <main className="flex-1 px-4 py-8">
                  <Routes>
                    <Route path="/home" element={<HomePage />} />
                    <Route path="/novo" element={<NewQuotePage />} />
                    <Route path="/pacotes" element={<PackagesQuotePage />} />
                    <Route path="/leads" element={<LeadsHub />} />
                    <Route path="/leads/prospeccao" element={<LeadsDashboard />} />
                    <Route path="/leads/disparos" element={<EmailBlastPage />} />
                    <Route path="/leads/whatsapp" element={<WhatsAppBlastPage />} />
                    <Route path="/leads/contatos" element={<ContactsPage />} />
                    <Route path="/produtividade" element={<ProductivityDashboard />} />
                    <Route path="/produtividade/novo" element={<DailyEntryPage />} />
                    <Route path="/produtividade/editar/:id" element={<DailyEntryPage />} />
                    <Route path="/produtividade/semanal" element={<WeeklyViewPage />} />
                    <Route path="/produtividade/agenda" element={<SchedulePage />} />
                  </Routes>
                </main>
                <Footer />
                <WaBlastIndicator />
              </>
            } />
          </Routes>
        </div>
      </WaBlastProvider>
    </BrowserRouter>
  );
}

export default App;
