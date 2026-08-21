import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  errorMessage,
  useLoginMutation,
} from '../services/authApi'
import GoogleButton from '../components/GoogleButton'

export default function Login() {
  const navigate = useNavigate()
  const [login, { isLoading }] = useLoginMutation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    try {
      await login({ email, password }).unwrap()
      navigate('/dashboard')
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 flex flex-col items-center justify-center p-8">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold tracking-tight text-white">
            Welcome back
          </h1>
          <p className="mt-1 text-sm text-gray-400">
            Log in to your Sensei account
          </p>
        </div>

        <form
          onSubmit={onSubmit}
          className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-4"
        >
          {error && (
            <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <div className="space-y-1.5">
            <label htmlFor="email" className="text-sm text-gray-300">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              className="w-full bg-gray-950 border border-gray-800 rounded-lg px-3 py-2 text-sm placeholder:text-gray-600 focus:outline-none focus:border-gray-500"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="password" className="text-sm text-gray-300">
              Password
            </label>
            <input
              id="password"
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full bg-gray-950 border border-gray-800 rounded-lg px-3 py-2 text-sm placeholder:text-gray-600 focus:outline-none focus:border-gray-500"
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-2.5 rounded-lg bg-white text-gray-950 font-medium hover:bg-gray-200 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Logging in…' : 'Log in'}
          </button>

          <GoogleButton
            onSuccess={() => navigate('/dashboard')}
            onError={setError}
          />
        </form>

        <p className="text-center text-sm text-gray-400">
          No account?{' '}
          <Link to="/register" className="text-white underline underline-offset-4">
            Sign up
          </Link>
        </p>
      </div>
    </div>
  )
}
