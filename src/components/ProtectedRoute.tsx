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

    if (loading) return <div>Loading...</div>;
    if (!user) return null;

    return <>{children}</>;
}
