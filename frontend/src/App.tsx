import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Header } from './components/layout/Header';
import { Footer } from './components/layout/Footer';
import { WaBlastProvider } from './contexts/WaBlastContext';
import { WaBlastIndicator } from './components/WaBlastIndicator';
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

function App() {
  return (
    <BrowserRouter>
      <WaBlastProvider>
        <div className="min-h-screen flex flex-col bg-background">
          <Routes>
            {/* Landing sem Header/Footer */}
            <Route path="/landing" element={<LandingPage />} />

            {/* App com layout completo */}
            <Route path="*" element={
              <>
                <Header />
                <main className="flex-1 px-4 py-8">
                  <Routes>
                    <Route path="/" element={<HomePage />} />
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
