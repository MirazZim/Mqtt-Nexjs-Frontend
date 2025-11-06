"use client";
import dynamic from 'next/dynamic';

const Login = dynamic(() => import('../../../components/Authentication/login'), {
    ssr: false,
    loading: () => (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
    ),
});

export default function LoginPage() {
    return <Login />;
}
