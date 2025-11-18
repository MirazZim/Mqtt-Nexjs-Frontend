"use client";
import React, { useEffect, useRef, useState, useContext } from 'react';
import AuthContext from '../../../context/AuthContext';
import IP_Camera_BASE_URL from '../../../config/ipCameraApi';
import { usePathname } from 'next/navigation';
import { useTranslation } from '../../../app/i18n/client.js';
import { FaCamera, FaVideo, FaCircle, FaBell, FaTimes } from 'react-icons/fa';

const IPCamera = ({ selectedLocation, roomCode }) => {
    const pathname = usePathname();
    const lng = pathname.split("/")[1];
    const { t } = useTranslation(lng, "camera");
    const { user, socket } = useContext(AuthContext);

    // States
    const [autoSave, setAutoSave] = useState(false);
    const [detections, setDetections] = useState([]);
    const [latestDetection, setLatestDetection] = useState(null);
    const [socketConnected, setSocketConnected] = useState(false);
    const [showNotifications, setShowNotifications] = useState(false);
    const [unreadCount, setUnreadCount] = useState(0);

    const intervalRef = useRef(null);
    const hasJoinedRoom = useRef(false);
    const notificationDropdownRef = useRef(null);
    const detectionCounterRef = useRef(0); // ✅ Counter for unique IDs

    // ✅ Generate truly unique ID
    const generateUniqueId = (logId) => {
        detectionCounterRef.current += 1;
        return `${logId}_${Date.now()}_${detectionCounterRef.current}`;
    };

    // ✅ Your simplified capture function
    const captureImageToServer = async () => {
        try {
            await fetch("http://192.168.88.60:5000/capture");
            console.log("📸 Image saved to MySQL!");
        } catch (err) {
            console.error("❌ Error saving image:", err);
        }
    };

    // ✅ Auto-save interval (your code)
    useEffect(() => {
        if (autoSave) {
            intervalRef.current = setInterval(() => {
                captureImageToServer();
            }, 5000); // every 5 seconds
        } else if (intervalRef.current) {
            clearInterval(intervalRef.current);
        }
        return () => clearInterval(intervalRef.current);
    }, [autoSave]);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (notificationDropdownRef.current && !notificationDropdownRef.current.contains(event.target)) {
                setShowNotifications(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Socket.IO for real-time detection updates
    useEffect(() => {
        if (!user || !selectedLocation || !socket) return;

        if (socket.connected) {
            setSocketConnected(true);
        }

        const actualRoomCode = roomCode || selectedLocation;
        const roomToJoin = `user_${user.id}_${actualRoomCode}`;

        if (!hasJoinedRoom.current) {
            socket.emit('joinRoom', roomToJoin);
            hasJoinedRoom.current = true;
        }

        const handleConnect = () => {
            setSocketConnected(true);
            socket.emit('joinRoom', roomToJoin);
            hasJoinedRoom.current = true;
        };

        const handleDisconnect = () => {
            setSocketConnected(false);
            hasJoinedRoom.current = false;
        };

        const handleCameraDetection = (data) => {
            const detection = {
                id: generateUniqueId(data.logId), // ✅ Use unique ID generator
                message: data.detectionMessage,
                timestamp: new Date(data.timestamp),
            };
            setLatestDetection(detection);
            setDetections(prev => {
                // ✅ Also check for duplicate messages to prevent duplicates
                const isDuplicate = prev.some(d => d.message === detection.message);
                if (isDuplicate) {
                    return prev; // Don't add if duplicate message exists
                }
                return [detection, ...prev].slice(0, 20);
            });
            setUnreadCount(prev => prev + 1);
        };

        const handleActuatorUpdate = (data) => {
            if (data.actuatorType === 'camera_monitoring' && data.message?.includes('detected in')) {
                const detection = {
                    id: generateUniqueId(data.actuatorId), // ✅ Use unique ID generator
                    message: data.message,
                    timestamp: new Date(data.timestamp),
                };
                setLatestDetection(detection);
                setDetections(prev => {
                    // ✅ Check for duplicate messages
                    const isDuplicate = prev.some(d => d.message === detection.message);
                    if (isDuplicate) {
                        return prev;
                    }
                    return [detection, ...prev].slice(0, 20);
                });
                setUnreadCount(prev => prev + 1);
            }
        };

        socket.on('connect', handleConnect);
        socket.on('disconnect', handleDisconnect);
        socket.on('cameraDetection', handleCameraDetection);
        socket.on('actuatorUpdate', handleActuatorUpdate);

        return () => {
            if (hasJoinedRoom.current) {
                socket.emit('leaveRoom', roomToJoin);
                hasJoinedRoom.current = false;
            }
            socket.off('connect', handleConnect);
            socket.off('disconnect', handleDisconnect);
            socket.off('cameraDetection', handleCameraDetection);
            socket.off('actuatorUpdate', handleActuatorUpdate);
        };
    }, [user, selectedLocation, roomCode, socket]);

    const handleNotificationClick = () => {
        setShowNotifications(!showNotifications);
        if (!showNotifications) {
            setUnreadCount(0);
        }
    };

    const timeAgo = (timestamp) => {
        const seconds = Math.floor((new Date() - timestamp) / 1000);
        if (seconds < 60) return `${seconds}s ago`;
        const minutes = Math.floor(seconds / 60);
        if (minutes < 60) return `${minutes}m ago`;
        return `${Math.floor(minutes / 60)}h ago`;
    };

    return (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            {/* Compact Header */}
            <div className="flex items-center justify-between p-3 border-b border-gray-200">
                <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-blue-500 rounded-lg">
                        <FaVideo className="text-white text-sm" />
                    </div>
                    <div>
                        <h3 className="text-sm font-semibold text-gray-800">AI Camera Monitor</h3>
                        <p className="text-xs text-gray-500">{selectedLocation}</p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    {/* Status Badge */}
                    <div className={`flex items-center gap-1 px-2 py-1 rounded-full ${socketConnected ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'
                        }`}>
                        <FaCircle className="text-[6px]" />
                        <span className="text-xs font-medium">{socketConnected ? 'Connected' : 'Offline'}</span>
                    </div>

                    {/* Notification Bell */}
                    <div className="relative" ref={notificationDropdownRef}>
                        <button
                            onClick={handleNotificationClick}
                            className="relative p-2 hover:bg-gray-100 rounded-lg transition-colors"
                        >
                            <FaBell className={`text-gray-600 text-base ${unreadCount > 0 ? 'animate-bounce' : ''}`} />
                            {unreadCount > 0 && (
                                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full h-4 w-4 flex items-center justify-center animate-pulse">
                                    {unreadCount > 9 ? '9+' : unreadCount}
                                </span>
                            )}
                        </button>

                        {/* Dropdown */}
                        {showNotifications && (
                            <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-lg shadow-2xl border border-gray-200 z-[100] max-h-[500px] overflow-hidden animate-slideDown">
                                <div className="flex items-center justify-between p-3 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-purple-50">
                                    <div className="flex items-center gap-2">
                                        <FaBell className="text-blue-500 text-sm" />
                                        <h4 className="text-sm font-semibold text-gray-800">Recent Detections</h4>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs text-gray-500 bg-white px-2 py-0.5 rounded-full">
                                            {detections.length} total
                                        </span>
                                        <button
                                            onClick={() => setShowNotifications(false)}
                                            className="p-1 hover:bg-white rounded transition-colors"
                                        >
                                            <FaTimes className="text-gray-400 text-xs" />
                                        </button>
                                    </div>
                                </div>

                                <div className="overflow-y-auto max-h-[400px] custom-scrollbar">
                                    {detections.length > 0 ? (
                                        <div className="p-2 space-y-2">
                                            {detections.map((detection) => (
                                                <div
                                                    key={detection.id}
                                                    className="p-3 bg-gradient-to-r from-gray-50 to-blue-50 hover:from-blue-50 hover:to-purple-50 rounded-lg border border-gray-200 hover:border-blue-300 transition-all cursor-pointer group"
                                                >
                                                    <div className="flex items-start gap-2">
                                                        <div className="p-1.5 bg-yellow-400 rounded-lg group-hover:scale-110 transition-transform">
                                                            <FaBell className="text-white text-xs" />
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <p className="text-xs text-gray-800 font-medium leading-tight">
                                                                {detection.message}
                                                            </p>
                                                            <p className="text-xs text-gray-500 mt-1">
                                                                {timeAgo(detection.timestamp)}
                                                            </p>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="p-8 text-center">
                                            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                                                <FaBell className="text-gray-400 text-2xl" />
                                            </div>
                                            <p className="text-sm font-medium text-gray-600">No detections yet</p>
                                            <p className="text-xs text-gray-500 mt-1">AI is monitoring your space</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Latest Detection Banner */}
            {latestDetection && (
                <div className="p-2.5 bg-gradient-to-r from-yellow-50 via-orange-50 to-yellow-50 border-b border-orange-200">
                    <div className="flex items-center gap-2">
                        <div className="p-1.5 bg-orange-400 rounded-lg">
                            <FaBell className="text-white text-xs animate-bounce" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-orange-800 truncate">
                                {latestDetection.message}
                            </p>
                            <p className="text-xs text-orange-600">{timeAgo(latestDetection.timestamp)}</p>
                        </div>
                    </div>
                </div>
            )}

            {/* Camera Feed */}
            <div className="relative bg-black">
                <iframe
                    src={IP_Camera_BASE_URL}
                    className="w-full h-64"
                    title="IP Camera Feed"
                    style={{ border: 'none' }}
                    allow="camera"
                />
            </div>

            {/* Controls */}
            <div className="p-3 bg-gray-50 border-t border-gray-200">
                <div className="grid grid-cols-2 gap-2">
                    {/* ✅ Capture Now Button (your code) */}
                    <button
                        onClick={() => captureImageToServer()}
                        className="flex items-center justify-center gap-2 px-3 py-2 bg-blue-500 hover:bg-blue-600 text-white text-xs font-medium rounded-lg transition-colors"
                    >
                        <FaCamera />
                        <span>Capture Now</span>
                    </button>

                    {/* ✅ Auto Save Toggle Button (your code) */}
                    <button
                        onClick={() => setAutoSave(!autoSave)}
                        className={`flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium rounded-lg transition-colors ${autoSave
                            ? 'bg-red-500 hover:bg-red-600 text-white'
                            : 'bg-green-500 hover:bg-green-600 text-white'
                            }`}
                    >
                        <FaCircle className={`text-[6px] ${autoSave ? 'animate-pulse' : ''}`} />
                        <span>{autoSave ? 'Stop Auto Save' : 'Start Auto Save'}</span>
                    </button>
                </div>

                {autoSave && (
                    <p className="text-xs text-blue-600 text-center mt-2 font-medium">
                        📸 Auto-saving every 5 seconds...
                    </p>
                )}
            </div>

            {/* Custom Styles */}
            <style jsx>{`
                .custom-scrollbar::-webkit-scrollbar {
                    width: 6px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: #f1f5f9;
                    border-radius: 10px;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: #cbd5e1;
                    border-radius: 10px;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                    background: #94a3b8;
                }
                
                @keyframes slideDown {
                    from {
                        opacity: 0;
                        transform: translateY(-10px);
                    }
                    to {
                        opacity: 1;
                        transform: translateY(0);
                    }
                }
                
                .animate-slideDown {
                    animation: slideDown 0.2s ease-out;
                }
            `}</style>
        </div>
    );
};

export default IPCamera;
