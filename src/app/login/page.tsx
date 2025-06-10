'use client';

import LoginForm from '@/components/auth/LoginForm';
import Navbar from '@/components/Navbar';

export default function LoginPage() {
  return (
    <>
      <Navbar />
      <main className="container mx-auto flex min-h-screen flex-col items-center justify-center px-4">
        <div className="w-full max-w-md">
          <h1 className="mb-8 text-center text-4xl font-bold">Login</h1>
          <LoginForm />
        </div>
      </main>
    </>
  );
} 