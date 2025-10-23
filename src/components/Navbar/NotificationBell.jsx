import { useNotifications } from '../../context/NotificationContext.jsx';
import { useRef, useState, useEffect } from 'react';
import { FaBell, FaCheckCircle, FaInfoCircle, FaExclamationTriangle, FaTimes } from 'react-icons/fa';

const NotificationBell = () => {
    const { unreadCount, notifications, markAllAsRead } = useNotifications();
    const [isOpen, setIsOpen] = useState(false);
    const bellRef = useRef(null);

    const handleBellClick = () => {
        setIsOpen(!isOpen);
        if (!isOpen) {
            markAllAsRead();
        }
    };

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (bellRef.current && !bellRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    const getNotificationIcon = (type) => {
        switch (type) {
            case 'success': return <FaCheckCircle className="text-emerald-500" />;
            case 'warning': return <FaExclamationTriangle className="text-amber-500" />;
            case 'error': return <FaTimes className="text-red-500" />;
            default: return <FaInfoCircle className="text-blue-500" />;
        }
    };

    return (
        <div className="relative" ref={bellRef}>
            {/* Modern Bell Button */}
            <button
                className="relative p-2.5 rounded-xl bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900 hover:from-gray-100 hover:to-gray-200 dark:hover:from-gray-700 dark:hover:to-gray-800 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-teal-500/50 shadow-sm hover:shadow-md group"
                onClick={handleBellClick}
                aria-label="Notifications"
            >
                <FaBell
                    className={`text-gray-700 dark:text-gray-300 text-lg transition-all duration-300 ${unreadCount > 0 ? 'animate-wiggle' : ''
                        } group-hover:scale-110`}
                />

                {/* Pulsing Badge */}
                {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 inline-flex">
                        <span className="absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75 animate-ping"></span>
                        <span className="relative inline-flex items-center justify-center min-w-[20px] h-[20px] px-1.5 text-[10px] font-bold text-white bg-gradient-to-br from-red-500 to-red-600 rounded-full shadow-lg">
                            {unreadCount > 99 ? '99+' : unreadCount}
                        </span>
                    </span>
                )}
            </button>

            {/* Sleek Dropdown Menu with Glassmorphism */}
            {isOpen && (
                <>
                    {/* Backdrop blur */}
                    <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)}></div>

                    <div className="absolute right-0 top-full mt-3 w-96 max-w-[calc(100vw-1rem)] z-50 animate-in slide-in-from-top-3 fade-in duration-200">
                        <div className="bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-gray-200/50 dark:border-gray-700/50 overflow-hidden">
                            {/* Modern Header with Gradient */}
                            <div className="relative px-5 py-4 bg-gradient-to-r from-teal-500 via-blue-500 to-purple-500 overflow-hidden">
                                <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent"></div>
                                <div className="relative flex items-center justify-between">
                                    <div>
                                        <h3 className="text-base font-bold text-white flex items-center gap-2">
                                            <FaBell className="text-sm" />
                                            Notifications
                                        </h3>
                                        {unreadCount > 0 && (
                                            <p className="text-xs text-white/90 mt-1 font-medium">
                                                {unreadCount} new notification{unreadCount !== 1 ? 's' : ''}
                                            </p>
                                        )}
                                    </div>
                                    <button
                                        onClick={() => setIsOpen(false)}
                                        className="p-1.5 rounded-lg bg-white/20 hover:bg-white/30 transition-colors"
                                    >
                                        <FaTimes className="text-white text-sm" />
                                    </button>
                                </div>
                            </div>

                            {/* Notification List with Custom Scrollbar */}
                            <div className="max-h-[450px] overflow-y-auto custom-scrollbar">
                                {notifications.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center py-16 px-4">
                                        <div className="relative">
                                            <div className="absolute inset-0 bg-gradient-to-br from-teal-500/20 to-blue-500/20 rounded-full blur-2xl"></div>
                                            <div className="relative w-20 h-20 rounded-full bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-700 flex items-center justify-center mb-4">
                                                <FaBell className="w-8 h-8 text-gray-400 dark:text-gray-500" />
                                            </div>
                                        </div>
                                        <p className="text-sm font-medium text-gray-700 dark:text-gray-300 text-center">
                                            All caught up!
                                        </p>
                                        <p className="text-xs text-gray-500 dark:text-gray-400 text-center mt-1">
                                            No new notifications at the moment
                                        </p>
                                    </div>
                                ) : (
                                    <div className="divide-y divide-gray-100 dark:divide-gray-800">
                                        {notifications.map((notification, index) => (
                                            <div
                                                key={index}
                                                className={`group px-5 py-4 hover:bg-gradient-to-r hover:from-gray-50/50 hover:to-transparent dark:hover:from-gray-800/50 dark:hover:to-transparent transition-all duration-200 cursor-pointer ${!notification.read
                                                    ? 'bg-gradient-to-r from-blue-50/30 to-transparent dark:from-blue-900/10'
                                                    : ''
                                                    }`}
                                            >
                                                <div className="flex items-start gap-4">
                                                    {/* Icon with animated background */}
                                                    <div className="flex-shrink-0 relative">
                                                        <div className={`absolute inset-0 rounded-xl blur-md opacity-30 ${!notification.read ? 'animate-pulse' : ''
                                                            }`}></div>
                                                        <div className="relative w-10 h-10 rounded-xl bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-700 flex items-center justify-center group-hover:scale-110 transition-transform duration-200">
                                                            {getNotificationIcon(notification.type)}
                                                        </div>
                                                    </div>

                                                    {/* Content */}
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-start justify-between gap-2 mb-1">
                                                            <p className="text-sm font-medium text-gray-900 dark:text-white break-words leading-relaxed">
                                                                {notification.message}
                                                            </p>
                                                            {!notification.read && (
                                                                <div className="flex-shrink-0 w-2 h-2 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 mt-1 shadow-lg shadow-blue-500/50"></div>
                                                            )}
                                                        </div>
                                                        <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                                                            <span>{new Date(notification.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                                            <span>•</span>
                                                            <span>{new Date(notification.timestamp).toLocaleDateString([], { month: 'short', day: 'numeric' })}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Footer Action */}
                            {notifications.length > 0 && (
                                <div className="px-5 py-3 bg-gray-50/50 dark:bg-gray-800/50 border-t border-gray-100 dark:border-gray-800">
                                    <button
                                        onClick={markAllAsRead}
                                        className="w-full py-2 text-sm font-medium text-teal-600 dark:text-teal-400 hover:text-teal-700 dark:hover:text-teal-300 transition-colors"
                                    >
                                        Mark all as read
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </>
            )}

            {/* Custom Scrollbar Styles */}
            <style jsx>{`
                .custom-scrollbar::-webkit-scrollbar {
                    width: 6px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: transparent;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: rgba(156, 163, 175, 0.3);
                    border-radius: 3px;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                    background: rgba(156, 163, 175, 0.5);
                }
                @keyframes wiggle {
                    0%, 100% { transform: rotate(0deg); }
                    25% { transform: rotate(-10deg); }
                    75% { transform: rotate(10deg); }
                }
                .animate-wiggle {
                    animation: wiggle 0.5s ease-in-out;
                }
            `}</style>
        </div>
    );
};

export default NotificationBell;
