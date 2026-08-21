import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useGetMeQuery } from '../services/authApi'
import { Spinner } from './Spinner'

export default function ProtectedRoute({ children }: { children: ReactNode }) {
  const { data, isLoading, isError } = useGetMeQuery()

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <Spinner />
      </div>
    )
  }

  if (isError || !data?.user) {
    return <Navigate to="/login" replace />
  }

  return <>{children}</>
}
