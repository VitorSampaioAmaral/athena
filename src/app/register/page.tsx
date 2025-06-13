'use client';

import RegisterForm from '@/components/auth/RegisterForm';
import Navbar from '@/components/Navbar';

export default function RegisterPage() {
  return (
    <>
      <Navbar />
      <main className="container mx-auto flex min-h-screen flex-col items-center justify-center px-4">
        <div className="w-full max-w-md">
          <h1 className="mb-8 text-center text-4xl font-bold">Criar Conta</h1>
          <RegisterForm />
        </div>
      </main>
    </>
  );
} 