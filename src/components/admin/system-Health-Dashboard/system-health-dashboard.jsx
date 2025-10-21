import { useState, useEffect, useContext } from 'react';
import AuthContext from '../../../context/AuthContext';
import API_BASE_URL from '../../../config/api.js';

const SystemHealthDashboard = ({ socket }) => {
    const { user } = useContext(AuthContext);
    const [healthData, setHealthData] = useState(null);
    const [auditData, setAuditData] = useState([]);
    const [auditStats, setAuditStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [auditFilter, setAuditFilter] = useState('ALL');
    const [auditTimeframe, setAuditTimeframe] = useState('today');
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(5);



    useEffect(() => {
        const fetchSystemHealth = async () => {
            try {
                const response = await fetch(`${API_BASE_URL}/api/admin/system-health`, {
                    headers: { 'Authorization': `Bearer ${user.token}` }
                });
                const data = await response.json();
                if (data.status === 'success') {
                    setHealthData(data.data);
                }
                setLoading(false);
            } catch (error) {
                console.error('Error fetching system health:', error);
                setLoading(false);
            }
        };

        const fetchAuditTrail = async () => {
            try {
                console.log('🔍 Fetching audit trail...');
                const response = await fetch(`${API_BASE_URL}/api/admin/audit-trail?type=${auditFilter}&limit=50`, {
                    headers: { 'Authorization': `Bearer ${user.token}` }
                });

                console.log('📡 Audit trail response status:', response.status);
                const data = await response.json();
                console.log('📊 Audit trail response data:', data);

                if (data.status === 'success') {
                    console.log('✅ Setting audit data:', data.data);
                    setAuditData(data.data);
                } else {
                    console.log('⚠️ Audit trail request failed:', data.message);
                }
            } catch (error) {
                console.error('❌ Error fetching audit trail:', error);
            }
        };
        const fetchAuditStatistics = async () => {
            try {
                const response = await fetch(`${API_BASE_URL}/api/admin/audit-statistics?timeframe=${auditTimeframe}`, {
                    headers: { 'Authorization': `Bearer ${user.token}` }
                });
                const data = await response.json();
                if (data.status === 'success') {
                    setAuditStats(data.data);
                }
            } catch (error) {
                console.error('Error fetching audit statistics:', error);
            }
        };

        const interval = setInterval(() => {
            fetchSystemHealth();
            fetchAuditTrail();
            fetchAuditStatistics();
        }, 5000); // Update every 5 seconds

        // Initial fetch
        fetchSystemHealth();
        fetchAuditTrail();
        fetchAuditStatistics();

        // Socket listeners for real-time updates
        if (socket) {
            socket.on('systemHealthUpdate', setHealthData);

            // Real-time audit updates
            socket.on('userActionAudit', (newAction) => {
                setAuditData(prev => [newAction, ...prev.slice(0, 49)]);
            });

            // Join admin dashboard room for audit updates
            socket.emit('join', 'admin_dashboard');
        }

        return () => {
            clearInterval(interval);
            if (socket) {
                socket.off('systemHealthUpdate');
                socket.off('userActionAudit');
                socket.emit('leave', 'admin_dashboard');
            }
        };
    }, [socket, user.token, auditFilter, auditTimeframe]);

    const formatTimestamp = (timestamp) => {
        return new Date(timestamp).toLocaleString();
    };

    const getActionIcon = (actionType) => {
        switch (actionType) {
            case 'TEMPERATURE_SET': return '🌡️';
            case 'HUMIDITY_SET': return '💧';
            case 'AIRFLOW_SET': return '💨';
            default: return '⚙️';
        }
    };

    const getActionColor = (actionType) => {
        switch (actionType) {
            case 'TEMPERATURE_SET': return '#f72585';
            case 'HUMIDITY_SET': return '#4361ee';
            case 'AIRFLOW_SET': return '#4cc9f0';
            default: return '#6c757d';
        }
    };

    // Calculate pagination
    const indexOfLastItem = currentPage * itemsPerPage;
    const indexOfFirstItem = indexOfLastItem - itemsPerPage;
    const currentItems = auditData.slice(indexOfFirstItem, indexOfLastItem);
    const totalPages = Math.ceil(auditData.length / itemsPerPage);

    // Page numbers to show
    const getPageNumbers = () => {
        const pages = [];
        const maxVisible = 5;

        if (totalPages <= maxVisible) {
            for (let i = 1; i <= totalPages; i++) {
                pages.push(i);
            }
        } else {
            if (currentPage <= 3) {
                pages.push(1, 2, 3, 4, '...', totalPages);
            } else if (currentPage >= totalPages - 2) {
                pages.push(1, '...', totalPages - 3, totalPages - 2, totalPages - 1, totalPages);
            } else {
                pages.push(1, '...', currentPage - 1, currentPage, currentPage + 1, '...', totalPages);
            }
        }

        return pages;
    };

    const getUnitSuffix = (actionType) => {
        switch (actionType) {
            case 'TEMPERATURE_SET': return '°C';
            case 'HUMIDITY_SET': return '%';
            case 'AIRFLOW_SET': return 'm/s';
            default: return '';
        }
    };

    if (loading) {
        return (
            <div className="loading-container">
                <div className="loading-spinner"></div>
                <p>Loading system health...</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Dashboard Header */}
            <div className="bg-gradient-to-r from-teal-600 to-blue-600 rounded-xl shadow-lg p-6">
                <div className="flex items-center justify-between">
                    <h2 className="text-2xl font-bold text-white">System Health Monitor</h2>
                    <div className="flex items-center gap-2 bg-white/20 backdrop-blur-sm rounded-lg px-4 py-2">
                        <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
                        <span className="text-white text-sm">
                            Last updated: {healthData?.timestamp ? new Date(healthData.timestamp).toLocaleTimeString() : 'Never'}
                        </span>
                    </div>
                </div>
            </div>

            {/* Health Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {/* Device Status Card */}
                <div className="bg-white rounded-xl shadow-md overflow-hidden hover:shadow-lg transition-shadow">
                    <div className="bg-gradient-to-r from-blue-500 to-cyan-500 p-4 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-lg flex items-center justify-center text-2xl">
                                📱
                            </div>
                            <div>
                                <h3 className="text-white font-bold text-lg">Device Status</h3>
                                <p className="text-blue-100 text-sm">IoT Sensors</p>
                            </div>
                        </div>
                        <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse"></div>
                    </div>
                    <div className="p-4">
                        <div className="grid grid-cols-3 gap-4 text-center">
                            <div>
                                <div className="text-2xl font-bold text-green-600">{healthData?.devices.active || 0}</div>
                                <div className="text-xs text-gray-500">Active</div>
                            </div>
                            <div>
                                <div className="text-2xl font-bold text-red-600">{healthData?.devices.offline || 0}</div>
                                <div className="text-xs text-gray-500">Offline</div>
                            </div>
                            <div>
                                <div className="text-2xl font-bold text-gray-600">{healthData?.devices.total || 0}</div>
                                <div className="text-xs text-gray-500">Total</div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* User Activity Card */}
                <div className="bg-white rounded-xl shadow-md overflow-hidden hover:shadow-lg transition-shadow">
                    <div className="bg-gradient-to-r from-purple-500 to-pink-500 p-4 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-lg flex items-center justify-center text-2xl">
                                👥
                            </div>
                            <div>
                                <h3 className="text-white font-bold text-lg">User Activity</h3>
                                <p className="text-purple-100 text-sm">Connected Users</p>
                            </div>
                        </div>
                        <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse"></div>
                    </div>
                    <div className="p-4">
                        <div className="grid grid-cols-2 gap-4 text-center">
                            <div>
                                <div className="text-2xl font-bold text-green-600">{healthData?.users.active || 0}</div>
                                <div className="text-xs text-gray-500">Online</div>
                            </div>
                            <div>
                                <div className="text-2xl font-bold text-gray-600">{healthData?.users.total || 0}</div>
                                <div className="text-xs text-gray-500">Total</div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Audit Trail Summary Card */}
                <div className="bg-white rounded-xl shadow-md overflow-hidden hover:shadow-lg transition-shadow">
                    <div className="bg-gradient-to-r from-orange-500 to-amber-500 p-4 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-lg flex items-center justify-center text-2xl">
                                📋
                            </div>
                            <div>
                                <h3 className="text-white font-bold text-lg">Audit Trail</h3>
                                <p className="text-orange-100 text-sm">User Actions</p>
                            </div>
                        </div>
                        <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse"></div>
                    </div>
                    <div className="p-4">
                        <div className="text-center mb-3">
                            <div className="text-3xl font-bold text-orange-600">{healthData?.audit?.recent_actions || 0}</div>
                            <div className="text-xs text-gray-500">Recent Actions</div>
                        </div>
                        <div className="flex justify-center gap-2">
                            {auditStats?.byActionType?.slice(0, 3).map((stat, index) => (
                                <div key={index} className="flex items-center gap-1 bg-orange-50 px-2 py-1 rounded-lg">
                                    <span className="text-lg">{getActionIcon(stat.action_type)}</span>
                                    <span className="text-sm font-medium text-orange-700">{stat.action_count}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* System Alerts Card */}
                <div className="bg-white rounded-xl shadow-md overflow-hidden hover:shadow-lg transition-shadow">
                    <div className="bg-gradient-to-r from-green-500 to-emerald-500 p-4 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-lg flex items-center justify-center text-2xl">
                                ⚠️
                            </div>
                            <div>
                                <h3 className="text-white font-bold text-lg">System Status</h3>
                                <p className="text-green-100 text-sm">Monitoring</p>
                            </div>
                        </div>
                        <div className={`w-3 h-3 rounded-full animate-pulse ${healthData?.anomalies > 0 ? 'bg-yellow-400' : 'bg-green-400'
                            }`}></div>
                    </div>
                    <div className="p-4 flex items-center justify-center">
                        <div className="flex items-center gap-2 bg-green-50 px-4 py-2 rounded-lg">
                            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                            <span className="text-green-700 font-medium">System Healthy</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* User Action Audit Trail Section */}
            {/* User Action Audit Trail Section */}
            <div className="bg-white rounded-xl shadow-md overflow-hidden">
                <div className="bg-gradient-to-r from-indigo-500 to-purple-500 p-6">
                    <div className="flex items-center justify-between flex-wrap gap-4">
                        <div>
                            <h3 className="text-2xl font-bold text-white mb-1">🔍 User Action Audit Trail</h3>
                            <p className="text-indigo-100 text-sm">Real-time monitoring of user temperature changes</p>
                        </div>
                        <div className="flex gap-2">
                            <select
                                value={auditFilter}
                                onChange={(e) => {
                                    setAuditFilter(e.target.value);
                                    setCurrentPage(1); // Reset to first page on filter change
                                }}
                                className="px-4 py-2 bg-white/20 backdrop-blur-sm text-white rounded-lg border border-white/30 focus:outline-none focus:ring-2 focus:ring-white/50"
                            >
                                <option value="ALL" className="text-gray-800">All Actions</option>
                                <option value="TEMPERATURE_SET" className="text-gray-800">Temperature Changes</option>
                                <option value="HUMIDITY_SET" className="text-gray-800">Humidity Changes</option>
                                <option value="AIRFLOW_SET" className="text-gray-800">Airflow Changes</option>
                            </select>
                            <select
                                value={auditTimeframe}
                                onChange={(e) => {
                                    setAuditTimeframe(e.target.value);
                                    setCurrentPage(1); // Reset to first page on timeframe change
                                }}
                                className="px-4 py-2 bg-white/20 backdrop-blur-sm text-white rounded-lg border border-white/30 focus:outline-none focus:ring-2 focus:ring-white/50"
                            >
                                <option value="today" className="text-gray-800">Today</option>
                                <option value="week" className="text-gray-800">This Week</option>
                                <option value="month" className="text-gray-800">This Month</option>
                            </select>
                        </div>
                    </div>
                </div>

                <div className="p-6">
                    {auditData.length > 0 ? (
                        <>
                            {/* Showing X of Y results + Items per page */}
                            <div className="flex items-center justify-between mb-4">
                                <div className="text-sm text-gray-600">
                                    Showing <span className="font-semibold text-gray-800">{indexOfFirstItem + 1}</span> to{' '}
                                    <span className="font-semibold text-gray-800">{Math.min(indexOfLastItem, auditData.length)}</span> of{' '}
                                    <span className="font-semibold text-gray-800">{auditData.length}</span> results
                                </div>
                                <select
                                    value={itemsPerPage}
                                    onChange={(e) => {
                                        setItemsPerPage(Number(e.target.value));
                                        setCurrentPage(1);
                                    }}
                                    className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
                                >
                                    <option value={5}>5 per page</option>
                                    <option value={10}>10 per page</option>
                                    <option value={20}>20 per page</option>
                                    <option value={50}>50 per page</option>
                                </select>
                            </div>

                            {/* Audit Items */}
                            <div className="space-y-3 mb-6">
                                {currentItems.map((action, index) => (
                                    <div
                                        key={index}
                                        className="flex items-start gap-4 p-4 bg-gray-50 hover:bg-gray-100 rounded-lg border-l-4 transition-colors"
                                        style={{ borderLeftColor: getActionColor(action.action_type) }}
                                    >
                                        <div
                                            className="w-10 h-10 rounded-lg flex items-center justify-center text-xl flex-shrink-0"
                                            style={{
                                                backgroundColor: `${getActionColor(action.action_type)}20`,
                                                color: getActionColor(action.action_type)
                                            }}
                                        >
                                            {getActionIcon(action.action_type)}
                                        </div>

                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap mb-1">
                                                <span className="font-bold text-gray-800">{action.username}</span>
                                                <span className="text-gray-600">{action.action_description}</span>
                                                <span
                                                    className="font-bold text-lg"
                                                    style={{ color: getActionColor(action.action_type) }}
                                                >
                                                    {action.old_value !== null && `${action.old_value} → `}
                                                    {action.new_value}{getUnitSuffix(action.action_type)}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-4 text-sm text-gray-500">
                                                <span className="flex items-center gap-1">
                                                    <span>📍</span>
                                                    {action.location}
                                                </span>
                                                <span className="flex items-center gap-1">
                                                    <span>🕒</span>
                                                    {formatTimestamp(action.created_at)}
                                                </span>
                                            </div>
                                        </div>

                                        <div className="flex items-center flex-shrink-0">
                                            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Pagination Controls */}
                            {totalPages > 1 && (
                                <div className="flex items-center justify-center gap-2">
                                    {/* Previous Button */}
                                    <button
                                        onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                                        disabled={currentPage === 1}
                                        className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                    >
                                        ← Previous
                                    </button>

                                    {/* Page Numbers */}
                                    <div className="flex items-center gap-1">
                                        {getPageNumbers().map((page, index) => (
                                            page === '...' ? (
                                                <span key={`ellipsis-${index}`} className="px-3 py-2 text-gray-400">
                                                    ...
                                                </span>
                                            ) : (
                                                <button
                                                    key={page}
                                                    onClick={() => setCurrentPage(page)}
                                                    className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${currentPage === page
                                                        ? 'bg-gradient-to-r from-indigo-500 to-purple-500 text-white shadow-md'
                                                        : 'text-gray-700 bg-white border border-gray-300 hover:bg-gray-50'
                                                        }`}
                                                >
                                                    {page}
                                                </button>
                                            )
                                        ))}
                                    </div>

                                    {/* Next Button */}
                                    <button
                                        onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                                        disabled={currentPage === totalPages}
                                        className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                    >
                                        Next →
                                    </button>
                                </div>
                            )}
                        </>
                    ) : (
                        <div className="flex flex-col items-center justify-center py-16 text-center">
                            <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center text-4xl mb-4">
                                📋
                            </div>
                            <h4 className="text-xl font-bold text-gray-800 mb-2">No user actions recorded</h4>
                            <p className="text-gray-600 max-w-md">
                                Temperature changes will appear here in real-time when users make adjustments.
                            </p>
                        </div>
                    )}
                </div>
            </div>


            {/* MQTT Activity Summary */}
            <div className="bg-white rounded-xl shadow-md overflow-hidden">
                <div className="bg-gradient-to-r from-cyan-500 to-blue-500 p-6">
                    <h3 className="text-2xl font-bold text-white mb-1">📡 MQTT Activity Summary</h3>
                    <p className="text-cyan-100 text-sm">Real-time message statistics</p>
                </div>

                <div className="p-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        {/* Connections */}
                        <div className="flex items-center gap-4 p-4 bg-green-50 rounded-lg border border-green-200">
                            <div className="w-14 h-14 bg-green-500 rounded-lg flex items-center justify-center text-2xl text-white">
                                🔗
                            </div>
                            <div>
                                <div className="text-3xl font-bold text-green-700">{healthData?.mqtt.connect || 0}</div>
                                <div className="text-sm text-green-600">Connections</div>
                            </div>
                        </div>

                        {/* Publications */}
                        <div className="flex items-center gap-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                            <div className="w-14 h-14 bg-blue-500 rounded-lg flex items-center justify-center text-2xl text-white">
                                📤
                            </div>
                            <div>
                                <div className="text-3xl font-bold text-blue-700">{healthData?.mqtt.publish || 0}</div>
                                <div className="text-sm text-blue-600">Publications</div>
                            </div>
                        </div>

                        {/* Subscriptions */}
                        <div className="flex items-center gap-4 p-4 bg-purple-50 rounded-lg border border-purple-200">
                            <div className="w-14 h-14 bg-purple-500 rounded-lg flex items-center justify-center text-2xl text-white">
                                📥
                            </div>
                            <div>
                                <div className="text-3xl font-bold text-purple-700">{healthData?.mqtt.subscribe || 0}</div>
                                <div className="text-sm text-purple-600">Subscriptions</div>
                            </div>
                        </div>

                        {/* Disconnections */}
                        <div className="flex items-center gap-4 p-4 bg-orange-50 rounded-lg border border-orange-200">
                            <div className="w-14 h-14 bg-orange-500 rounded-lg flex items-center justify-center text-2xl text-white">
                                🔌
                            </div>
                            <div>
                                <div className="text-3xl font-bold text-orange-700">{healthData?.mqtt.disconnect || 0}</div>
                                <div className="text-sm text-orange-600">Disconnections</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SystemHealthDashboard;
