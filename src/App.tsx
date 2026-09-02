import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { ThemeProvider } from './contexts/ThemeContext'
import RequireAuth from './components/RequireAuth'
import AppLayout from './components/AppLayout'
import HomePage from './pages/HomePage'
import LoginPage from './pages/LoginPage'
import GenresPage from './pages/GenresPage'
import NewGenrePage from './pages/NewGenrePage'
import GenreFormulasPage from './pages/GenreFormulasPage'
import NewEntryPage from './pages/NewEntryPage'
import EntriesPage from './pages/EntriesPage'
import PublicPage from './pages/PublicPage'

function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route element={<RequireAuth />}>
              <Route element={<AppLayout />}>
                <Route path="/" element={<HomePage />} />
                <Route path="/genres" element={<GenresPage />} />
                <Route path="/genres/new" element={<NewGenrePage />} />
                <Route
                  path="/genres/:genreId/formulas"
                  element={<GenreFormulasPage />}
                />
                <Route path="/entries" element={<EntriesPage />} />
                <Route path="/entries/new" element={<NewEntryPage />} />
                <Route path="/public" element={<PublicPage />} />
              </Route>
            </Route>
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </ThemeProvider>
  )
}

export default App
