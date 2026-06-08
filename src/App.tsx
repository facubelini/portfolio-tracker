import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useAuth } from './hooks/useAuth'
import { LoginPage } from './pages/Login'
import { DashboardPage } from './pages/Dashboard'
import { TransaccionesPage } from './pages/Transacciones'
import { ComposicionPage } from './pages/Composicion'
import { BenchmarkPage } from './pages/Benchmark'
import { DividendosPage } from './pages/Dividendos'
import { Navbar } from './components/layout/Navbar'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})

function AppRoutes() {
  const { session, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-950">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
      </div>
    )
  }

  if (!session) return <LoginPage />

  return (
    <div className="min-h-screen bg-gray-950">
      <Navbar />
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/transacciones" element={<TransaccionesPage />} />
        <Route path="/composicion" element={<ComposicionPage />} />
        <Route path="/benchmark" element={<BenchmarkPage />} />
        <Route path="/dividendos" element={<DividendosPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  )
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <HashRouter>
        <AppRoutes />
      </HashRouter>
    </QueryClientProvider>
  )
}
