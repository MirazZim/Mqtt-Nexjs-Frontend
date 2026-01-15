
import { Suspense, lazy } from 'react';

const DashboardComponent = lazy(() => import('../../../../components/DashBoard.jsx'));

const LoadingFallback = () => (
    <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100%',
        fontSize: '1.5rem',
        color: '#555',
    }}>
        Loading...
    </div>
);

export default function DashboardPage() {
    return (
        <div className="h-full">
            <Suspense fallback={<LoadingFallback />}>
                <DashboardComponent />
            </Suspense>
        </div>
    );
}
