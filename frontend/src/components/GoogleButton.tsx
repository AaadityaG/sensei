import { GoogleLogin, type CredentialResponse } from '@react-oauth/google'
import {
  errorMessage,
  useGoogleAuthMutation,
} from '../services/authApi'

export default function GoogleButton({
  onSuccess,
  onError,
}: {
  onSuccess: () => void
  onError: (msg: string) => void
}) {
  const [googleAuth] = useGoogleAuthMutation()
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined

  if (!clientId) return null

  return (
    <>
      <div className="flex items-center gap-3 text-xs uppercase tracking-wide text-gray-500">
        <span className="h-px flex-1 bg-gray-800" />
        or
        <span className="h-px flex-1 bg-gray-800" />
      </div>
      <div className="flex justify-center">
        <GoogleLogin
          theme="filled_black"
          size="large"
          shape="pill"
          text="continue_with"
          onSuccess={(res: CredentialResponse) => {
            if (!res.credential) return
            googleAuth({ credential: res.credential })
              .unwrap()
              .then(onSuccess)
              .catch((err) => onError(errorMessage(err)))
          }}
          onError={() => onError('Google sign-in failed')}
        />
      </div>
    </>
  )
}
