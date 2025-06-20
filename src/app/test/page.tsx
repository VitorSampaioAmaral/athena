export default function TestPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-900">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-white mb-4">
          Página de Teste
        </h1>
        <p className="text-gray-300 mb-4">
          Se você consegue ver esta página, o problema não está no Next.js básico.
        </p>
        <div className="bg-green-900/50 p-4 rounded-md">
          <p className="text-green-300">
            ✅ Next.js está funcionando corretamente!
          </p>
        </div>
      </div>
    </div>
  );
} 