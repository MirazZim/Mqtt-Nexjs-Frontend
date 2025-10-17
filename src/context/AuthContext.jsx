"use client";
import { createContext, useState, useEffect } from 'react';
import { createSocket } from '../lib/socket';
import API_BASE_URL from '../config/api.js';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [socket, setSocket] = useState(null);

    useEffect(() => {
        const storedUser = localStorage.getItem('user');
        if (storedUser) {
            const userData = JSON.parse(storedUser);
            setUser(userData);

            // Initialize socket connection for stored user
            initializeSocket(userData);
        }
        setLoading(false);
    }, []);

    const initializeSocket = (userData) => {
        if (userData && userData.token) {
            try {
                const socketConnection = createSocket(userData.token);

                socketConnection.on('connect', () => {
                    // console.log('✅ Socket connected for user:', userData.id);
                    // Emit user online status
                    socketConnection.emit('user_online');
                });

                socketConnection.on('disconnect', () => {
                    // console.log('❌ Socket disconnected for user:', userData.id);
                });

                socketConnection.on('connect_error', (error) => {
                    console.error('Socket connection error:', error);
                });

                // Listen for active users updates (optional)
                socketConnection.on('activeUsersUpdate', (activeUsers) => {
                    // console.log('👥 Active users updated:', activeUsers);
                });

                setSocket(socketConnection);
            } catch (error) {
                console.error('Error initializing socket:', error);
            }
        }
    };

    const login = (userData, token) => {
        const user = { ...userData, token };
        setUser(user);
        localStorage.setItem('user', JSON.stringify(user));

        // Initialize socket connection after login
        initializeSocket(user);
    };

    const logout = async () => {
        // console.log('🚪 User logging out...');

        if (user && user.token) {
            try {
                // Call logout API to set is_active = 0
                const response = await fetch(`${API_BASE_URL}/api/auth/logout`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${user.token}`,
                        'Content-Type': 'application/json'
                    }
                });

                const result = await response.json();
                //console.log('📤 Logout API response:', result);
            } catch (error) {
                console.error('❌ Logout API failed:', error);
            }
        }

        // Notify server about logout via socket before disconnecting
        if (socket) {
            try {
                // Emit logout event to server
                socket.emit('logout');
                // Disconnect socket
                socket.disconnect();
                //console.log('✅ Socket disconnected and logout event sent');
            } catch (error) {
                console.error('Error during socket logout:', error);
            }
        }

        // Clear user data
        setUser(null);
        setSocket(null);
        localStorage.removeItem('user');
        //console.log('✅ User logged out successfully');
    };

    // Handle page visibility changes (user switching tabs, minimizing browser)
    useEffect(() => {
        const handleVisibilityChange = () => {
            if (socket && user) {
                if (document.hidden) {
                    // User switched to another tab or minimized browser
                    socket.emit('user_offline');
                    // console.log('😴 User went offline (tab hidden)');
                } else {
                    // User came back to the tab
                    socket.emit('user_online');
                    //   console.log('😊 User came online (tab visible)');
                }
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, [socket, user]);

    // Handle window/tab closing
    useEffect(() => {
        const handleBeforeUnload = () => {
            if (socket) {
                socket.emit('user_offline');
                socket.disconnect();
            }
        };

        window.addEventListener('beforeunload', handleBeforeUnload);

        return () => {
            window.removeEventListener('beforeunload', handleBeforeUnload);
        };
    }, [socket]);

    const isAdmin = () => user?.role === 'admin';

    // Function to check if user is currently active
    const isUserActive = () => socket?.connected || false;

    return (
        <AuthContext.Provider value={{
            user,
            loading,
            socket,
            login,
            logout,
            isAdmin,
            isUserActive
        }}>
            {children}
        </AuthContext.Provider>
    );
};

export default AuthContext;
