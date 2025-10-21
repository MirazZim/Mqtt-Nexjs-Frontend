'use client'

import { useState, useContext, lazy, Suspense } from 'react';
import AuthContext from '@/context/AuthContext';

// Lazy load tab content
const SystemHealthDashboard = lazy(() => import('../../../components/admin/system-Health-Dashboard/system-health-dashboard.jsx'));
const UserManagement = lazy(() => import('../../../components/admin/user-management/user-management.jsx'));

const TabLoader = () => (
    <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-3">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600"></div>
            <p className="text-gray-600">Loading...</p>
        </div>
    </div>
);

export default function AdminDashboard() {
    const { user, socket } = useContext(AuthContext);
    const [activeTab, setActiveTab] = useState('health');

    // Check admin access
    if (user?.role !== 'admin') {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-100">
                <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full text-center">
                    <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <span className="text-4xl">🚫</span>
                    </div>
                    <h2 className="text-2xl font-bold text-gray-800 mb-2">Access Denied</h2>
                    <p className="text-gray-600 mb-6">
                        You need admin privileges to access this page.
                    </p>
                    <button
                        onClick={() => window.history.back()}
                        className="px-6 py-3 bg-gradient-to-r from-teal-600 to-blue-600 text-white rounded-lg font-medium hover:from-teal-700 hover:to-blue-700 transition-all"
                    >
                        Go Back
                    </button>
                </div>
            </div>
        );
    }

    const tabs = [
        { id: 'health', label: 'System Health', icon: '📊' },
        { id: 'users', label: 'Users', icon: '👥' }
    ];

    return (
        <div className="min-h-screen bg-gray-100">
            {/* Header */}
            <div className="bg-gradient-to-r from-teal-700 via-teal-600 to-blue-600 shadow-lg">
                <div className="max-w-7xl mx-auto px-6 py-6">
                    <div className="flex items-center justify-between">
                        {/* Title Section */}
                        <div>
                            <h1 className="text-3xl font-bold text-white mb-1">
                                🛠️ Admin Dashboard
                            </h1>
                            <p className="text-teal-100 text-sm">
                                System management and monitoring
                            </p>
                        </div>

                        {/* User Info */}
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center text-white font-bold text-lg border-2 border-white/30">
                                {user.username.charAt(0).toUpperCase()}
                            </div>
                            <div className="text-right">
                                <p className="text-white font-medium">{user.username}</p>
                                <p className="text-teal-100 text-sm">Administrator</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Navigation Tabs */}
            <div className="bg-white shadow-md border-b border-gray-200 sticky top-0 z-10">
                <div className="max-w-7xl mx-auto px-6">
                    <div className="flex items-center gap-2">
                        {tabs.map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`flex items-center gap-2 px-6 py-4 font-medium transition-all relative ${activeTab === tab.id
                                    ? 'text-teal-600'
                                    : 'text-gray-600 hover:text-gray-800 hover:bg-gray-50'
                                    }`}
                            >
                                <span className="text-xl">{tab.icon}</span>
                                <span>{tab.label}</span>

                                {/* Active indicator */}
                                {activeTab === tab.id && (
                                    <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-teal-600 to-blue-600"></div>
                                )}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Content Area */}
            <div className="max-w-7xl mx-auto px-6 py-8">
                <Suspense fallback={<TabLoader />}>
                    {activeTab === 'health' && <SystemHealthDashboard socket={socket} />}
                    {activeTab === 'users' && <UserManagement />}
                </Suspense>
            </div>
        </div>
    );
}
