import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';

export default function Navbar() {
  const { user, loading, logout, isAuthenticated } = useAuth();

  return (
    <nav className="fixed top-0 left-0 right-0 bg-white shadow-sm z-50 px-4 py-3">
      <div className="max-w-7xl mx-auto flex justify-between items-center">
        <Link href="/" className="text-lg font-semibold text-gray-800 hover:text-blue-600 transition-colors">
          IA Vision
        </Link>

        <div className="flex items-center space-x-4">
          {loading ? (
            <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          ) : isAuthenticated ? (
            <>
              <div className="text-sm text-gray-600">
                Olá, {user?.name}
              </div>
              <button
                onClick={logout}
                className="px-4 py-2 text-sm text-red-600 bg-white border border-red-600 rounded-lg hover:bg-red-50 transition-colors"
              >
                Sair
              </button>
            </>
          ) : null}
        </div>
      </div>
    </nav>
  );
} 