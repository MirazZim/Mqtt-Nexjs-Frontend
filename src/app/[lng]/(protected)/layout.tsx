
import Navbar from '@/components/Navbar/Navbar';
//import Navbar from '@/components/Navbar/Navbar';
import ProtectedRoute from '@/components/ProtectedRoute';

export default function ProtectedLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <ProtectedRoute>
                       <div className="h-screen flex flex-col overflow-hidden">
                <Navbar />
                <main className="flex-1 overflow-auto">
                    {children}
                </main>
            </div>
        </ProtectedRoute>
    );
}
