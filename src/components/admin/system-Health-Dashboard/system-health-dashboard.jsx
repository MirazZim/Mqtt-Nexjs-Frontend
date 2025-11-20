import { useState, useEffect, useContext } from 'react';
import AuthContext from '../../../context/AuthContext';
import API_BASE_URL from '../../../config/api.js';
import { usePathname } from 'next/navigation';
import { useTranslation } from '../../../app/i18n/client.js';

const SystemHealthDashboard = ({ socket }) => {
    const { user } = useContext(AuthContext);

    // i18n setup
    const pathname = usePathname();
    const lng = pathname.split("/")[1];
    const { t } = useTranslation(lng, "health");

    const [healthData, setHealthData] = useState(null);
    const [auditData, setAuditData] = useState([]);
    const [auditStats, setAuditStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [auditFilter, setAuditFilter] = useState('ALL');
    const [auditTimeframe, setAuditTimeframe] = useState('today');
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(5);

    // ✅ FIX #1: Separate useEffect for Socket.IO listeners (doesn't depend on filters)
    useEffect(() => {
        if (!socket) return;

        console.log('🔌 Setting up Socket.IO listeners...');

        // System health updates
        socket.on('systemHealthUpdate', (data) => {
            console.log('📊 System health update received:', data);
            setHealthData(data);
        });

        // Legacy user action audit (keep for compatibility)
        socket.on('userActionAudit', (newAction) => {
            console.log('📋 User action audit received:', newAction);
            setAuditData(prev => [newAction, ...prev.slice(0, 49)]);
        });

        // ✅ FIX #1: NEW - Listen for fan speed and other admin audit logs
        socket.on('adminAuditLog', (data) => {
            console.log('🔔 Admin audit log received:', data);

            // Format the data to match audit trail structure
            const formattedAction = {
                id: Date.now(),
                user_id: data.userId,
                username: data.user,
                room_id: data.roomId,
                location: data.roomCode,
                action_type: data.type,
                action_description: data.type === 'fan_speed_change'
                    ? `changed fan speed in ${data.roomCode}`
                    : data.description || 'performed an action',
                old_value: data.oldValue,
                new_value: data.newValue,
                created_at: data.timestamp
            };

            setAuditData(prev => [formattedAction, ...prev.slice(0, 49)]);
        });

        // Join admin dashboard room
        socket.emit('join', 'admin_dashboard');
        console.log('✅ Joined admin_dashboard room');

        // Cleanup
        return () => {
            console.log('🔌 Cleaning up Socket.IO listeners...');
            socket.off('systemHealthUpdate');
            socket.off('userActionAudit');
            socket.off('adminAuditLog');
            socket.emit('leave', 'admin_dashboard');
        };
    }, [socket]); // Only re-run when socket changes

    // ✅ FIX #2: Separate useEffect for data fetching with filters
    useEffect(() => {
        if (!user?.token) return;

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
                const response = await fetch(
                    `${API_BASE_URL}/api/admin/audit-trail?type=${auditFilter}&limit=50`,
                    {
                        headers: { 'Authorization': `Bearer ${user.token}` }
                    }
                );

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
                const response = await fetch(
                    `${API_BASE_URL}/api/admin/audit-statistics?timeframe=${auditTimeframe}`,
                    {
                        headers: { 'Authorization': `Bearer ${user.token}` }
                    }
                );
                const data = await response.json();
                if (data.status === 'success') {
                    setAuditStats(data.data);
                }
            } catch (error) {
                console.error('Error fetching audit statistics:', error);
            }
        };

        // Initial fetch
        fetchSystemHealth();
        fetchAuditTrail();
        fetchAuditStatistics();

        // ✅ FIX #3: Increased polling interval from 5s to 10s
        const interval = setInterval(() => {
            fetchSystemHealth();
            fetchAuditTrail();
            fetchAuditStatistics();
        }, 10000); // 10 seconds instead of 5

        return () => {
            clearInterval(interval);
        };
    }, [user?.token, auditFilter, auditTimeframe]); // Dependencies for data fetching only

    const formatTimestamp = (timestamp) => {
        return new Date(timestamp).toLocaleString();
    };

    const getActionIcon = (actionType) => {
        switch (actionType) {
            case 'TEMPERATURE_SET':
                return '🌡️';
            case 'HUMIDITY_SET':
                return '💧';
            case 'AIRFLOW_SET':
                return '💨';
            case 'fan_speed_change':
                return '🌀';
            default:
                return '⚙️';
        }
    };

    const getActionColor = (actionType) => {
        switch (actionType) {
            case 'TEMPERATURE_SET':
                return '#f72585';
            case 'HUMIDITY_SET':
                return '#4361ee';
            case 'AIRFLOW_SET':
                return '#4cc9f0';
            case 'fan_speed_change':
                return '#06b6d4';
            default:
                return '#6c757d';
        }
    };

    const getUnitSuffix = (actionType) => {
        switch (actionType) {
            case 'TEMPERATURE_SET':
                return '°C';
            case 'HUMIDITY_SET':
                return '%';
            case 'AIRFLOW_SET':
                return ' m/s';
            case 'fan_speed_change':
                return '%';
            default:
                return '';
        }
    };

    const indexOfLastItem = currentPage * itemsPerPage;
    const indexOfFirstItem = indexOfLastItem - itemsPerPage;
    const currentItems = auditData.slice(indexOfFirstItem, indexOfLastItem);
    const totalPages = Math.ceil(auditData.length / itemsPerPage);

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

    if (loading) {
        return (
            <div className="loading-container">
                <div className="loading-spinner"></div>
                <p>{t('Loading system health...')}</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Dashboard Header */}
            <div className="bg-gradient-to-r from-teal-600 to-blue-600 rounded-xl shadow-lg p-6">
                <div className="flex items-center justify-between">
                    <h2 className="text-2xl font-bold text-white">{t('System Health Monitor')}</h2>
                    <div className="flex items-center gap-2 bg-white/20 backdrop-blur-sm rounded-lg px-4 py-2">
                        <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
                        <span className="text-white text-sm">
                            {t('Last updated')}: {healthData?.timestamp ? new Date(healthData.timestamp).toLocaleTimeString() : t('Never')}
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
                                <h3 className="text-white font-bold text-lg">{t('Device Status')}</h3>
                                <p className="text-blue-100 text-sm">{t('IoT Sensors')}</p>
                            </div>
                        </div>
                        <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse"></div>
                    </div>
                    <div className="p-4">
                        <div className="grid grid-cols-3 gap-4 text-center">
                            <div>
                                <div className="text-2xl font-bold text-green-600">{healthData?.devices.active || 0}</div>
                                <div className="text-xs text-gray-500">{t('Active')}</div>
                            </div>
                            <div>
                                <div className="text-2xl font-bold text-red-600">{healthData?.devices.offline || 0}</div>
                                <div className="text-xs text-gray-500">{t('Offline')}</div>
                            </div>
                            <div>
                                <div className="text-2xl font-bold text-gray-600">{healthData?.devices.total || 0}</div>
                                <div className="text-xs text-gray-500">{t('Total')}</div>
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
                                <h3 className="text-white font-bold text-lg">{t('User Activity')}</h3>
                                <p className="text-purple-100 text-sm">{t('Connected Users')}</p>
                            </div>
                        </div>
                        <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse"></div>
                    </div>
                    <div className="p-4">
                        <div className="grid grid-cols-2 gap-4 text-center">
                            <div>
                                <div className="text-2xl font-bold text-green-600">{healthData?.users.active || 0}</div>
                                <div className="text-xs text-gray-500">{t('Online')}</div>
                            </div>
                            <div>
                                <div className="text-2xl font-bold text-gray-600">{healthData?.users.total || 0}</div>
                                <div className="text-xs text-gray-500">{t('Total')}</div>
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
                                <h3 className="text-white font-bold text-lg">{t('Audit Trail')}</h3>
                                <p className="text-orange-100 text-sm">{t('User Actions')}</p>
                            </div>
                        </div>
                        <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse"></div>
                    </div>
                    <div className="p-4">
                        <div className="text-center mb-3">
                            <div className="text-3xl font-bold text-orange-600">{healthData?.audit?.recent_actions || 0}</div>
                            <div className="text-xs text-gray-500">{t('Recent Actions')}</div>
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
                                <h3 className="text-white font-bold text-lg">{t('System Status')}</h3>
                                <p className="text-green-100 text-sm">{t('Monitoring')}</p>
                            </div>
                        </div>
                        <div className={`w-3 h-3 rounded-full animate-pulse ${healthData?.anomalies > 0 ? 'bg-yellow-400' : 'bg-green-400'}`}></div>
                    </div>
                    <div className="p-4 flex items-center justify-center">
                        <div className="flex items-center gap-2 bg-green-50 px-4 py-2 rounded-lg">
                            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                            <span className="text-green-700 font-medium">{t('System Healthy')}</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* User Action Audit Trail Section - REFINED STANDARD SIZE */}
            <div className="bg-white rounded-xl shadow-md overflow-hidden border border-gray-100">
                {/* Header */}
                <div className="bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-500 p-6">
                    <div className="flex items-center justify-between flex-wrap gap-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-white/20 backdrop-blur-lg rounded-lg flex items-center justify-center text-xl shadow-lg">
                                📋
                            </div>
                            <div>
                                <h3 className="text-xl font-bold text-white tracking-tight">
                                    {t('User Action Audit Trail')}
                                </h3>
                                <p className="text-indigo-100 text-xs font-medium">
                                    {t('Real-time monitoring of user control changes')}
                                </p>
                            </div>
                        </div>

                        {/* Filters */}
                        <div className="flex gap-2">
                            <select
                                value={auditFilter}
                                onChange={(e) => {
                                    setAuditFilter(e.target.value);
                                    setCurrentPage(1);
                                }}
                                className="px-3 py-2 text-sm bg-white/95 backdrop-blur-sm rounded-lg border border-white/20 text-gray-700 font-medium shadow-md hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-white/50 transition-all cursor-pointer"
                            >
                                <option value="ALL">🔍 {t('All Actions')}</option>
                                <option value="TEMPERATURE_SET">🌡️ {t('Temperature')}</option>
                                <option value="HUMIDITY_SET">💧 {t('Humidity')}</option>
                                <option value="AIRFLOW_SET">💨 {t('Airflow')}</option>
                                <option value="fan_speed_change">🌀 {t('Fan Speed')}</option>
                            </select>
                            <select
                                value={auditTimeframe}
                                onChange={(e) => {
                                    setAuditTimeframe(e.target.value);
                                    setCurrentPage(1);
                                }}
                                className="px-3 py-2 text-sm bg-white/20 backdrop-blur-sm text-white font-medium rounded-lg border border-white/30 shadow-md hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-white/50 transition-all cursor-pointer"
                            >
                                <option value="today" className="text-gray-800">📅 {t('Today')}</option>
                                <option value="week" className="text-gray-800">📆 {t('This Week')}</option>
                                <option value="month" className="text-gray-800">📊 {t('This Month')}</option>
                            </select>
                        </div>
                    </div>
                </div>

                <div className="p-6">
                    {auditData.length > 0 ? (
                        <>
                            {/* Results Info Bar */}
                            <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-200">
                                <div className="px-3 py-1.5 bg-indigo-50 rounded-md border border-indigo-100">
                                    <span className="text-xs font-semibold text-indigo-600">
                                        {t('Showing')} {indexOfFirstItem + 1}-{Math.min(indexOfLastItem, auditData.length)} {t('of')} {auditData.length}
                                    </span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-xs text-gray-500 font-medium">{t('Per page')}:</span>
                                    <select
                                        value={itemsPerPage}
                                        onChange={(e) => {
                                            setItemsPerPage(Number(e.target.value));
                                            setCurrentPage(1);
                                        }}
                                        className="px-3 py-1.5 text-xs font-semibold border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none hover:border-purple-300 transition-colors cursor-pointer bg-white"
                                    >
                                        <option value={5}>5</option>
                                        <option value={10}>10</option>
                                        <option value={20}>20</option>
                                        <option value={50}>50</option>
                                    </select>
                                </div>
                            </div>

                            {/* Audit Items */}
                            <div className="space-y-3 mb-6">
                                {currentItems.map((action, index) => (
                                    <div
                                        key={action.id || index}
                                        className="group bg-gray-50 hover:bg-white rounded-lg border border-gray-200 hover:border-gray-300 p-4 transition-all duration-200 hover:shadow-md"
                                        style={{
                                            borderLeftWidth: '4px',
                                            borderLeftColor: getActionColor(action.action_type)
                                        }}
                                    >
                                        <div className="flex items-start gap-3">
                                            {/* Action Icon */}
                                            <div
                                                className="w-10 h-10 rounded-lg flex items-center justify-center text-lg flex-shrink-0 shadow-sm"
                                                style={{
                                                    backgroundColor: `${getActionColor(action.action_type)}15`,
                                                    border: `2px solid ${getActionColor(action.action_type)}30`
                                                }}
                                            >
                                                <span style={{ color: getActionColor(action.action_type) }}>
                                                    {getActionIcon(action.action_type)}
                                                </span>
                                            </div>

                                            {/* Content */}
                                            <div className="flex-1 min-w-0">
                                                {/* User and Action */}
                                                <div className="flex items-center justify-between gap-3 mb-2">
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        {/* User Badge */}
                                                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-md shadow-sm">
                                                            <span className="text-white text-xs">👤</span>
                                                            <span className="font-bold text-white text-sm">
                                                                {action.username}
                                                            </span>
                                                        </span>

                                                        {/* Action Description */}
                                                        <span className="text-gray-700 font-medium text-sm">
                                                            {action.action_description}
                                                        </span>
                                                    </div>

                                                    {/* Live Indicator */}
                                                    <div className="flex items-center gap-1.5 px-2 py-1 bg-green-50 rounded-full border border-green-200">
                                                        <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></div>
                                                        <span className="text-xs font-semibold text-green-700">LIVE</span>
                                                    </div>
                                                </div>

                                                {/* Value Change */}
                                                <div className="flex items-center gap-2 mb-3 p-2.5 bg-white rounded-md border border-gray-200 shadow-sm">
                                                    {action.old_value !== null && action.old_value !== undefined && (
                                                        <>
                                                            <span className="px-2.5 py-1 bg-gray-100 rounded text-gray-600 font-semibold text-sm">
                                                                {action.old_value}{getUnitSuffix(action.action_type)}
                                                            </span>
                                                            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                                                            </svg>
                                                        </>
                                                    )}
                                                    <span
                                                        className="px-3 py-1 rounded-md shadow-sm font-bold text-base"
                                                        style={{
                                                            backgroundColor: `${getActionColor(action.action_type)}20`,
                                                            color: getActionColor(action.action_type),
                                                            border: `1.5px solid ${getActionColor(action.action_type)}40`
                                                        }}
                                                    >
                                                        {action.new_value}{getUnitSuffix(action.action_type)}
                                                    </span>
                                                </div>

                                                {/* Room and Timestamp */}
                                                <div className="flex items-center gap-3 flex-wrap">
                                                    {/* Room Badge */}
                                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-gradient-to-r from-cyan-500 to-blue-500 rounded-md shadow-sm">
                                                        <span className="text-white text-xs">📍</span>
                                                        <span className="font-bold text-white text-xs">
                                                            {action.location}
                                                        </span>
                                                    </span>

                                                    {/* Timestamp */}
                                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-gray-100 rounded-md">
                                                        <span className="text-gray-600 text-xs">🕒</span>
                                                        <span className="font-semibold text-gray-700 text-xs">
                                                            {formatTimestamp(action.created_at)}
                                                        </span>
                                                    </span>

                                                    {/* Action Type Tag */}
                                                    <span
                                                        className="px-2 py-0.5 rounded-full text-xs font-bold uppercase tracking-wide"
                                                        style={{
                                                            backgroundColor: `${getActionColor(action.action_type)}15`,
                                                            color: getActionColor(action.action_type),
                                                            border: `1px solid ${getActionColor(action.action_type)}30`
                                                        }}
                                                    >
                                                        {action.action_type.replace('_', ' ')}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Pagination */}
                            {totalPages > 1 && (
                                <div className="flex items-center justify-center gap-2 pt-4 border-t border-gray-200">
                                    <button
                                        onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                                        disabled={currentPage === 1}
                                        className="group flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-gray-700 bg-white border border-gray-300 rounded-lg hover:border-indigo-300 hover:bg-indigo-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm"
                                    >
                                        <svg className="w-3 h-3 group-hover:-translate-x-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                                        </svg>
                                        {t('Previous')}
                                    </button>

                                    <div className="flex items-center gap-1">
                                        {getPageNumbers().map((page, index) => (
                                            page === '...' ? (
                                                <span key={`ellipsis-${index}`} className="px-2 py-1 text-gray-400 font-bold text-xs">
                                                    ...
                                                </span>
                                            ) : (
                                                <button
                                                    key={page}
                                                    onClick={() => setCurrentPage(page)}
                                                    className={`min-w-[32px] px-3 py-2 text-xs font-bold rounded-lg transition-all ${currentPage === page
                                                            ? 'bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 text-white shadow-md scale-105'
                                                            : 'text-gray-700 bg-white border border-gray-300 hover:border-indigo-300 hover:bg-indigo-50'
                                                        }`}
                                                >
                                                    {page}
                                                </button>
                                            )
                                        ))}
                                    </div>

                                    <button
                                        onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                                        disabled={currentPage === totalPages}
                                        className="group flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-gray-700 bg-white border border-gray-300 rounded-lg hover:border-indigo-300 hover:bg-indigo-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm"
                                    >
                                        {t('Next')}
                                        <svg className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                        </svg>
                                    </button>
                                </div>
                            )}
                        </>
                    ) : (
                        /* Empty State */
                        <div className="flex flex-col items-center justify-center py-12 text-center">
                            <div className="relative mb-4">
                                <div className="w-20 h-20 bg-gradient-to-br from-indigo-100 to-purple-100 rounded-full flex items-center justify-center text-4xl shadow-lg">
                                    📋
                                </div>
                                <div className="absolute -bottom-1 -right-1 w-8 h-8 bg-gradient-to-r from-green-400 to-emerald-400 rounded-full flex items-center justify-center text-lg shadow-md">
                                    ✨
                                </div>
                            </div>
                            <h4 className="text-lg font-bold text-gray-800 mb-2">
                                {t('No user actions recorded')}
                            </h4>
                            <p className="text-gray-600 text-sm max-w-md leading-relaxed mb-4">
                                {t('Control changes will appear here in real-time')}
                            </p>
                            <div className="px-4 py-2 bg-gradient-to-r from-indigo-500 to-purple-500 text-white text-xs font-semibold rounded-lg shadow-md">
                                {t('Waiting for actions...')}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* MQTT Activity Summary */}
            <div className="bg-white rounded-xl shadow-md overflow-hidden">
                <div className="bg-gradient-to-r from-cyan-500 to-blue-500 p-6">
                    <h3 className="text-2xl font-bold text-white mb-1">{t('MQTT Activity Summary')}</h3>
                    <p className="text-cyan-100 text-sm">{t('Real-time message statistics')}</p>
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
                                <div className="text-sm text-green-600">{t('Connections')}</div>
                            </div>
                        </div>

                        {/* Publications */}
                        <div className="flex items-center gap-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                            <div className="w-14 h-14 bg-blue-500 rounded-lg flex items-center justify-center text-2xl text-white">
                                📤
                            </div>
                            <div>
                                <div className="text-3xl font-bold text-blue-700">{healthData?.mqtt.publish || 0}</div>
                                <div className="text-sm text-blue-600">{t('Publications')}</div>
                            </div>
                        </div>

                        {/* Subscriptions */}
                        <div className="flex items-center gap-4 p-4 bg-purple-50 rounded-lg border border-purple-200">
                            <div className="w-14 h-14 bg-purple-500 rounded-lg flex items-center justify-center text-2xl text-white">
                                📥
                            </div>
                            <div>
                                <div className="text-3xl font-bold text-purple-700">{healthData?.mqtt.subscribe || 0}</div>
                                <div className="text-sm text-purple-600">{t('Subscriptions')}</div>
                            </div>
                        </div>

                        {/* Disconnections */}
                        <div className="flex items-center gap-4 p-4 bg-orange-50 rounded-lg border border-orange-200">
                            <div className="w-14 h-14 bg-orange-500 rounded-lg flex items-center justify-center text-2xl text-white">
                                🔌
                            </div>
                            <div>
                                <div className="text-3xl font-bold text-orange-700">{healthData?.mqtt.disconnect || 0}</div>
                                <div className="text-sm text-orange-600">{t('Disconnections')}</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SystemHealthDashboard;
