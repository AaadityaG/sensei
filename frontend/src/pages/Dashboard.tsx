import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDispatch } from 'react-redux'
import { api } from '../services/api'
import {
  errorMessage,
  useGetMeQuery,
  useLogoutMutation,
  useSetPasswordMutation,
} from '../services/authApi'

export default function Dashboard() {
  const navigate = useNavigate()
  const dispatch = useDispatch()
  const { data } = useGetMeQuery()
  const [logout] = useLogoutMutation()
  const [setPassword, { isLoading: isSettingPassword }] = useSetPasswordMutation()
  const [newPassword, setNewPassword] = useState('')
  const [passwordError, setPasswordError] = useState<string | null>(null)

  const user = data?.user

  const handleLogout = async () => {
    await logout().unwrap().catch(() => {})
    dispatch(api.util.resetApiState())
    navigate('/login')
  }

  const handleSetPassword = async (e: FormEvent) => {
    e.preventDefault()
    setPasswordError(null)
    try {
      await setPassword({ password: newPassword }).unwrap()
      setNewPassword('')
    } catch (err) {
      setPasswordError(errorMessage(err))
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 flex flex-col items-center justify-center p-8">
      <div className="max-w-lg w-full space-y-8">
        <div className="text-center">
          <h1 className="text-4xl font-bold tracking-tight text-white">
            Dashboard
          </h1>
          <p className="mt-2 text-gray-400">
            You're signed in — this route is protected.
          </p>
        </div>

        {user && (
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
            <div className="flex items-center gap-4">
              {user.picture ? (
                <img
                  src={user.picture}
                  alt=""
                  className="h-12 w-12 rounded-full"
                />
              ) : (
                <div className="h-12 w-12 rounded-full bg-gray-800 flex items-center justify-center text-lg font-semibold text-gray-300">
                  {user.name.charAt(0).toUpperCase()}
                </div>
              )}
              <div className="min-w-0">
                <p className="font-medium text-white truncate">{user.name}</p>
                <p className="text-sm text-gray-400 truncate">{user.email}</p>
              </div>
            </div>
          </div>
        )}

        {user && !user.has_password && (
          <form
            onSubmit={handleSetPassword}
            className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-3"
          >
            <h2 className="font-medium text-white">Add a password</h2>
            <p className="text-sm text-gray-400">
              You signed up with Google. Set a password to also log in with
              your email.
            </p>
            {passwordError && (
              <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                {passwordError}
              </p>
            )}
            <div className="flex gap-2">
              <input
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="At least 8 characters"
                className="flex-1 bg-gray-950 border border-gray-800 rounded-lg px-3 py-2 text-sm placeholder:text-gray-600 focus:outline-none focus:border-gray-500"
              />
              <button
                type="submit"
                disabled={isSettingPassword}
                className="px-4 py-2 rounded-lg bg-white text-gray-950 text-sm font-medium hover:bg-gray-200 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSettingPassword ? 'Saving…' : 'Save'}
              </button>
            </div>
          </form>
        )}

        <div className="flex justify-center">
          <button
            onClick={handleLogout}
            className="px-5 py-2.5 rounded-lg border border-gray-700 text-gray-200 hover:bg-gray-900 transition"
          >
            Log out
          </button>
        </div>
      </div>
    </div>
  )
}
