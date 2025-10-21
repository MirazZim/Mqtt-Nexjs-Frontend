'use client'

import { useContext, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import AuthContext from '@/context/AuthContext';

export default function ProtectedRoute({
    children,
    roles = []
}: {
    children: React.ReactNode;
    roles?: string[];
}) {
    const { user, loading } = useContext(AuthContext);
    const router = useRouter();

    useEffect(() => {
        if (!loading && !user) {
            router.push('/login');
        }

        if (user && roles.length > 0 && !roles.includes(user.role)) {
            router.push('/unauthorized');
        }
    }, [user, loading, router, roles]);

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600"></div>
            </div>
        );
    }

    if (!user) return null;

    if (roles.length > 0 && !roles.includes(user.role)) {
        return null;
    }

    return <>{children}</>;
}
