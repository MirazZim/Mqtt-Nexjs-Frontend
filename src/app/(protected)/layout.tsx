'use client'

//import Navbar from '@/components/Navbar/Navbar';
import ProtectedRoute from '@/components/ProtectedRoute';

export default function ProtectedLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <ProtectedRoute>
            <div>
                {/* <Navbar /> */}
                {children}
            </div>
        </ProtectedRoute>
    );
}
