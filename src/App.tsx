import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import RequireAuth from './components/RequireAuth'
import HomePage from './pages/HomePage'
import LoginPage from './pages/LoginPage'
import GenresPage from './pages/GenresPage'
import NewGenrePage from './pages/NewGenrePage'
import NewEntryPage from './pages/NewEntryPage'

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route element={<RequireAuth />}>
            <Route path="/" element={<HomePage />} />
            <Route path="/genres" element={<GenresPage />} />
            <Route path="/genres/new" element={<NewGenrePage />} />
            <Route path="/entries/new" element={<NewEntryPage />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
