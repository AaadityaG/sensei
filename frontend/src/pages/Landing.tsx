import { Link } from 'react-router-dom'

export default function Landing() {
  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 flex flex-col items-center justify-center p-8">
      <div className="max-w-lg w-full space-y-8">
        <div className="text-center">
          <h1 className="text-4xl font-bold tracking-tight text-white">
            Sensei
          </h1>
          <p className="mt-2 text-gray-400">
            Permission-aware project context platform
          </p>
        </div>

        <div className="flex items-center justify-center gap-3">
          <Link
            to="/login"
            className="px-5 py-2.5 rounded-lg border border-gray-700 text-gray-200 hover:bg-gray-900 transition"
          >
            Log in
          </Link>
          <Link
            to="/register"
            className="px-5 py-2.5 rounded-lg bg-white text-gray-950 font-medium hover:bg-gray-200 transition"
          >
            Get started
          </Link>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-4">
          <h2 className="text-lg font-semibold text-white">Backend Status</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { title: 'Sources', desc: 'Confluence, GitHub, Jira, Teams' },
              { title: 'Memory', desc: 'Project context & decisions' },
              { title: 'Chat', desc: 'Cited, grounded answers' },
            ].map((card) => (
              <div
                key={card.title}
                className="bg-gray-900 border border-gray-800 rounded-lg p-4 text-center"
              >
                <h3 className="font-medium text-white">{card.title}</h3>
                <p className="mt-1 text-sm text-gray-400">{card.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
