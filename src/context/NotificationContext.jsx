"use client";
import { createContext, useState, useContext, useCallback, useEffect, useRef } from 'react';
import toast from 'react-hot-toast'; // ✅ Changed import
import AuthContext from '../context/AuthContext.jsx';

const NotificationContext = createContext();

export const NotificationProvider = ({ children }) => {
    const [notifications, setNotifications] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [latestESP3Value, setLatestESP3Value] = useState(null);
    const [lastESP3Update, setLastESP3Update] = useState(null);

    const { socket } = useContext(AuthContext) || {};

    // ✅ Track listener state
    const isListenerRegistered = useRef(false);
    const currentSocket = useRef(null);
    const lastProcessedAlert = useRef(null);

    // ✅ Simple ESP3 alert handler
    const handleESP3Alert = useCallback((alertData) => {
        const alertKey = `${alertData.timestamp}-${alertData.value}`;
        if (lastProcessedAlert.current === alertKey) {
            console.log('🔄 Duplicate alert detected, skipping:', alertKey);
            return;
        }

        console.log('🚨 Processing ESP3 Alert:', alertData);
        lastProcessedAlert.current = alertKey;

        setLatestESP3Value(alertData.value);
        setLastESP3Update(new Date(alertData.timestamp));

        const notification = {
            type: 'warning',
            message: alertData.message,
            timestamp: alertData.timestamp,
            value: alertData.value,
            location: alertData.location
        };

        setNotifications(prev => [notification, ...prev].slice(0, 10));
        setUnreadCount(prev => prev + 1);

        // ✅ Simple React Hot Toast
        toast(`🚨 ${alertData.message}`, {
            duration: 5000,
            position: 'bottom-right',
        });

        // Play sound
        try {
            const audio = new Audio('/alert-sound.mp3');
            audio.play().catch(e => console.log('Audio play failed:', e));
        } catch (error) {
            console.log('Error creating audio:', error);
        }
    }, []);

    // ✅ Socket event management (unchanged)
    useEffect(() => {
        console.log('🔍 Socket state:', {
            socketExists: !!socket,
            hasOnFunction: socket && typeof socket.on === 'function',
            isListenerRegistered: isListenerRegistered.current,
        });

        if (!socket || typeof socket.on !== 'function') {
            console.log('❌ Socket not ready yet');
            return;
        }

        if (isListenerRegistered.current && currentSocket.current === socket) {
            console.log('✅ ESP3 listener already registered for this socket, skipping');
            return;
        }

        if (isListenerRegistered.current && currentSocket.current && currentSocket.current !== socket) {
            console.log('🔄 Socket changed, cleaning up old listener');
            try {
                currentSocket.current.removeAllListeners('esp3Alert');
                console.log('✅ Successfully removed all previous esp3Alert listeners');
            } catch (error) {
                console.log('❌ Error cleaning up old socket:', error);
            }
        }

        console.log('🔧 Registering ESP3 alert listener');

        try {
            socket.removeAllListeners('esp3Alert');
            socket.on('esp3Alert', handleESP3Alert);

            isListenerRegistered.current = true;
            currentSocket.current = socket;

            console.log('✅ ESP3 alert listener registered successfully');
            console.log(`ℹ️ Current esp3Alert listeners count: ${socket.listeners('esp3Alert').length}`);
        } catch (error) {
            console.error('❌ Error setting up ESP3 alert listener:', error);
        }

        return () => {
            console.log('🧹 Cleaning up ESP3 alert listener');
            try {
                if (socket && typeof socket.removeAllListeners === 'function') {
                    socket.removeAllListeners('esp3Alert');
                    console.log('✅ Cleanup: Removed all esp3Alert listeners');
                }
            } catch (error) {
                console.log('❌ Error during cleanup:', error);
            } finally {
                isListenerRegistered.current = false;
                currentSocket.current = null;
            }
        };
    }, [socket, handleESP3Alert]);

    // ✅ Simple addNotification function
    const addNotification = useCallback((notification) => {
        setNotifications(prev => [notification, ...prev].slice(0, 10));
        setUnreadCount(prev => prev + 1);

        // ✅ Simple toast based on type
        switch (notification.type) {
            case 'success':
                toast.success(notification.message);
                break;
            case 'error':
                toast.error(notification.message);
                break;
            case 'warning':
                toast(notification.message, { icon: '⚠️' });
                break;
            default:
                toast(notification.message);
        }
    }, []);

    const clearNotifications = useCallback(() => {
        setNotifications([]);
        setUnreadCount(0);
    }, []);

    const markAllAsRead = useCallback(() => {
        setUnreadCount(0);
    }, []);

    return (
        <NotificationContext.Provider
            value={{
                notifications,
                unreadCount,
                latestESP3Value,
                lastESP3Update,
                addNotification,
                clearNotifications,
                markAllAsRead
            }}
        >
            {children}
        </NotificationContext.Provider>
    );
};

export const useNotifications = () => {
    const context = useContext(NotificationContext);
    if (!context) {
        throw new Error('useNotifications must be used within a NotificationProvider');
    }
    return context;
};

export default NotificationContext;
