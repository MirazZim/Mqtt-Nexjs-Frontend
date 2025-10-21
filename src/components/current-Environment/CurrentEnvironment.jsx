"use client";
import React, { useState, useEffect, useContext, useRef } from 'react';
import { createSocket } from '../../lib/socket';
import AuthContext from '../../context/AuthContext';

import API_BASE_URL from '../../config/api.js';

const CurrentEnvironment = ({ selectedLocation }) => {
    const { user } = useContext(AuthContext);

    // Safe number formatting function
    const safeToFixed = (value, digits) => {
        return (typeof value === 'number' && !isNaN(value)) ? value.toFixed(digits) : 'N/A';
    };

    const [currentData, setCurrentData] = useState({
        temperature: null,
        humidity: null,
        airflow: null
    });

    const [setpoints, setSetpoints] = useState({
        temperature: 22.0,
        humidity: 55.0,
        airflow: 2.0
    });

    // Simplified connection state management
    const [realTimeStatus, setRealTimeStatus] = useState({
        temperature: false,
        humidity: false,
        airflow: false,
        connected: false,
        sensorActive: false
    });

    // ESP Control States
    const [publishStatus, setPublishStatus] = useState('');

    // ✅ TEXT MQTT STATES
    const [textMessage, setTextMessage] = useState('');
    const [textPublishStatus, setTextPublishStatus] = useState('');

    const [loading, setLoading] = useState(true);
    const [socket, setSocket] = useState(null);
    const [lastUpdate, setLastUpdate] = useState(null);
    const [isConnecting, setIsConnecting] = useState(false);

    // Refs for reconnection logic
    const reconnectTimeoutRef = useRef(null);
    const reconnectAttemptsRef = useRef(0);
    const sensorTimeoutRef = useRef(null);
    const maxReconnectAttempts = 2;
    const baseReconnectDelay = 1000;

    // ESP Control function
    const sendActuatorCommand = (command) => {
        if (!socket || !realTimeStatus.connected) {
            setPublishStatus('❌ Not connected to server');
            return;
        }

        setPublishStatus(`📤 Sending command: ${command}`);

        socket.emit('sendActuatorCommand', {
            userId: user.id,
            location: selectedLocation,
            command
        });
    };

    // ✅ TEXT MQTT FUNCTION
    const sendTextMessage = () => {
        if (!socket || !realTimeStatus.connected) {
            setTextPublishStatus('❌ Not connected to server');
            return;
        }

        if (!textMessage.trim()) {
            setTextPublishStatus('❌ Please enter a message');
            return;
        }

        setTextPublishStatus(`📤 Sending text: "${textMessage.trim()}"`);

        socket.emit('publishTextToMQTT', {
            topic: 'text',
            message: textMessage.trim(),
            userId: user.id,
            location: selectedLocation
        });

        // Clear text input after sending
        setTextMessage('');
    };

    // ✅ HANDLE ENTER KEY FOR TEXT INPUT
    const handleTextKeyPress = (e) => {
        if (e.key === 'Enter') {
            sendTextMessage();
        }
    };

    // Cleanup function
    const cleanup = () => {
        if (reconnectTimeoutRef.current) {
            clearTimeout(reconnectTimeoutRef.current);
            reconnectTimeoutRef.current = null;
        }
        if (sensorTimeoutRef.current) {
            clearTimeout(sensorTimeoutRef.current);
            sensorTimeoutRef.current = null;
        }
        if (socket) {
            socket.disconnect();
            setSocket(null);
        }
        setIsConnecting(false);
    };

    // SINGLE effect to handle location changes and socket management
    useEffect(() => {
        console.log(`🔄 CurrentEnvironment location changed to: ${selectedLocation}`);

        // Don't proceed without user or location
        if (!user || !selectedLocation) {
            cleanup();
            return;
        }

        // Immediate cleanup and reset when location changes
        cleanup();

        // Reset data immediately
        setCurrentData({
            temperature: null,
            humidity: null,
            airflow: null
        });

        // Reset sensor status
        setRealTimeStatus({
            temperature: false,
            humidity: false,
            airflow: false,
            connected: false,
            sensorActive: false
        });

        setLastUpdate(null);
        setLoading(true);

        // Small delay to ensure cleanup is complete, then setup new connection
        const setupTimer = setTimeout(() => {
            fetchLatestEnvironment();
            fetchSetpoints();
            setupRealtimeUpdates();
        }, 100);

        return () => {
            clearTimeout(setupTimer);
            cleanup();
        };
    }, [user?.id, selectedLocation]); // Include user.id to ensure proper re-initialization

    // Auto-reconnect when online
    useEffect(() => {
        const handleOnline = () => {
            if (!realTimeStatus.connected && !isConnecting) {
                attemptReconnect();
            }
        };

        const handleOffline = () => {
            setRealTimeStatus(prev => ({ ...prev, connected: false, sensorActive: false }));
        };

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, [realTimeStatus.connected, isConnecting]);

    const attemptReconnect = () => {
        if (reconnectAttemptsRef.current >= maxReconnectAttempts || isConnecting) {
            console.log('❌ Max reconnection attempts reached or already connecting');
            setRealTimeStatus(prev => ({
                ...prev,
                connected: false,
                sensorActive: false
            }));
            return;
        }

        const delay = Math.min(baseReconnectDelay * Math.pow(2, reconnectAttemptsRef.current), 30000);
        console.log(`🔄 CurrentEnvironment reconnection attempt ${reconnectAttemptsRef.current + 1} in ${delay}ms`);

        reconnectTimeoutRef.current = setTimeout(() => {
            reconnectAttemptsRef.current++;
            setupRealtimeUpdates();
        }, delay);
    };

    // Set sensor timeout when data is received
    const setSensorTimeout = () => {
        if (sensorTimeoutRef.current) {
            clearTimeout(sensorTimeoutRef.current);
        }

        sensorTimeoutRef.current = setTimeout(() => {
            console.log('🔴 CurrentEnvironment sensor timeout - no data for 5 seconds');
            setRealTimeStatus(prev => ({ ...prev, sensorActive: false }));
        }, 5000); // 5 second timeout
    };

    const setupRealtimeUpdates = () => {
        if (isConnecting || !selectedLocation || !user) return;

        console.log(`🔄 CurrentEnvironment setting up socket connection for location: ${selectedLocation}`);
        setIsConnecting(true);

        try {
            const socketConnection = createSocket(user.token);
            setSocket(socketConnection);

            // Connection established
            socketConnection.on('connect', () => {
                console.log('🟢 CurrentEnvironment connected to real-time updates');
                reconnectAttemptsRef.current = 0;
                setRealTimeStatus(prev => ({
                    ...prev,
                    connected: true
                }));
                setIsConnecting(false);

                // IMMEDIATELY join the location upon connection
                socketConnection.emit('joinLocation', selectedLocation);
                console.log(`🔄 CurrentEnvironment joined location: ${selectedLocation}`);
            });

            // Connection lost
            socketConnection.on('disconnect', (reason) => {
                console.log('🔴 CurrentEnvironment disconnected:', reason);
                setRealTimeStatus(prev => ({
                    ...prev,
                    connected: false,
                    sensorActive: false
                }));
                setIsConnecting(false);

                // Clear sensor timeout when disconnected
                if (sensorTimeoutRef.current) {
                    clearTimeout(sensorTimeoutRef.current);
                    sensorTimeoutRef.current = null;
                }

                // Only attempt reconnect if it wasn't a manual disconnect
                if (reason !== 'io client disconnect') {
                    setTimeout(() => attemptReconnect(), 1000);
                }
            });

            // Connection error
            socketConnection.on('connect_error', (error) => {
                console.log('❌ CurrentEnvironment connection error:', error);
                setRealTimeStatus(prev => ({
                    ...prev,
                    connected: false,
                    sensorActive: false
                }));
                setIsConnecting(false);

                setTimeout(() => attemptReconnect(), 2000);
            });

            // ✅ ENHANCED PUBLISH RESULT HANDLER FOR BOTH ESP AND TEXT
            socketConnection.on('publishResult', (result) => {
                if (result.topic === 'text') {
                    // Handle text message results
                    if (result.success) {
                        setTextPublishStatus(`✅ Text sent: "${result.message}"`);
                    } else {
                        setTextPublishStatus(`❌ Text failed: ${result.error}`);
                    }
                    setTimeout(() => setTextPublishStatus(''), 1000);
                } else {
                    // Handle ESP command results
                    if (result.success) {
                        setPublishStatus(`✅ Sent "${result.message || result.command}" to ${result.topic || result.espDevice}`);
                    } else {
                        setPublishStatus(`❌ Failed: ${result.error}`);
                    }
                    setTimeout(() => setPublishStatus(''), 3000);
                }
            });

            // ✅ TEXT MESSAGE RECEIVED HANDLER
            socketConnection.on('textMessageReceived', (data) => {
                console.log('📝 Text message received from MQTT:', data.message);
                // You can add UI notification or display here if needed
            });

            // Real-time environment updates with instant feedback
            socketConnection.on('environmentUpdate', (data) => {
                if (data.location === selectedLocation && data.userId === user.id) {
                    console.log('🌡️ CurrentEnvironment real-time data received:', data);

                    // Mark sensor as active and reset timeout
                    setRealTimeStatus(prev => ({ ...prev, sensorActive: true }));
                    setSensorTimeout();

                    // Immediate state update - ZERO DELAY
                    setCurrentData({
                        temperature: typeof data.temperature === 'number' ? data.temperature : null,
                        humidity: typeof data.humidity === 'number' ? data.humidity : null,
                        airflow: typeof data.airflow === 'number' ? data.airflow : null
                    });

                    // Update last update timestamp
                    setLastUpdate(new Date());

                    // Visual feedback for temperature update
                    if (typeof data.temperature === 'number') {
                        setRealTimeStatus(prev => ({ ...prev, temperature: true }));
                        setTimeout(() => {
                            setRealTimeStatus(prev => ({ ...prev, temperature: false }));
                        }, 1500);
                    }

                    // Visual feedback for humidity update
                    if (typeof data.humidity === 'number') {
                        setRealTimeStatus(prev => ({ ...prev, humidity: true }));
                        setTimeout(() => {
                            setRealTimeStatus(prev => ({ ...prev, humidity: false }));
                        }, 1500);
                    }

                    // Visual feedback for airflow update
                    if (typeof data.airflow === 'number') {
                        setRealTimeStatus(prev => ({ ...prev, airflow: true }));
                        setTimeout(() => {
                            setRealTimeStatus(prev => ({ ...prev, airflow: false }));
                        }, 1500);
                    }

                    // Update setpoints if included
                    if (typeof data.desiredTemperature === 'number') {
                        setSetpoints(prev => ({ ...prev, temperature: data.desiredTemperature }));
                    }
                    if (typeof data.desiredHumidity === 'number') {
                        setSetpoints(prev => ({ ...prev, humidity: data.desiredHumidity }));
                    }
                    if (typeof data.desiredAirflow === 'number') {
                        setSetpoints(prev => ({ ...prev, airflow: data.desiredAirflow }));
                    }
                }
            });

            // Real-time setpoint updates
            socketConnection.on('setpointUpdate', (data) => {
                if (data.location === selectedLocation && data.userId === user.id) {
                    console.log('🎯 CurrentEnvironment setpoint update received:', data);

                    if (typeof data.desiredTemperature === 'number') {
                        setSetpoints(prev => ({ ...prev, temperature: data.desiredTemperature }));
                    }
                    if (typeof data.desiredHumidity === 'number') {
                        setSetpoints(prev => ({ ...prev, humidity: data.desiredHumidity }));
                    }
                    if (typeof data.desiredAirflow === 'number') {
                        setSetpoints(prev => ({ ...prev, airflow: data.desiredAirflow }));
                    }
                }
            });

        } catch (error) {
            console.error('❌ Error setting up socket connection:', error);
            setRealTimeStatus(prev => ({
                ...prev,
                connected: false,
                sensorActive: false
            }));
            setIsConnecting(false);
            setTimeout(() => attemptReconnect(), 3000);
        }
    };

    const fetchLatestEnvironment = async () => {
        if (!selectedLocation || !user) return;

        try {
            const response = await fetch(
                `${API_BASE_URL}/api/locations/${encodeURIComponent(selectedLocation)}/latest`,
                {
                    headers: { 'Authorization': `Bearer ${user.token}` }
                }
            );

            if (response.ok) {
                const data = await response.json();
                if (data.status === 'success' && data.measurement) {
                    const measurement = data.measurement;

                    // Check if we have recent data and mark sensor as active
                    const measurementTime = new Date(measurement.created_at);
                    const timeSinceLastMeasurement = Date.now() - measurementTime.getTime();

                    setCurrentData({
                        temperature: typeof measurement.temperature === 'number' ? measurement.temperature : null,
                        humidity: typeof measurement.humidity === 'number' ? measurement.humidity : null,
                        airflow: typeof measurement.airflow === 'number' ? measurement.airflow : null
                    });
                    setLastUpdate(measurementTime);

                    // If data is recent (less than 2 minutes), mark sensor as active
                    if (timeSinceLastMeasurement < 120000) { // 2 minutes
                        setRealTimeStatus(prev => ({ ...prev, sensorActive: true }));
                        setSensorTimeout();
                    }
                }
            }
        } catch (err) {
            console.error('Error fetching latest environment:', err);
        } finally {
            setLoading(false);
        }
    };

    const fetchSetpoints = async () => {
        if (!user) return;

        try {
            const response = await fetch(`${API_BASE_URL}/api/temperature/setpoint`, {
                headers: { 'Authorization': `Bearer ${user.token}` }
            });

            if (response.ok) {
                const data = await response.json();
                if (data.status === 'success' && data.data) {
                    setSetpoints({
                        temperature: data.data.desiredTemperature || 22.0,
                        humidity: data.data.desiredHumidity || 55.0,
                        airflow: data.data.desiredAirflow || 2.0
                    });
                }
            }
        } catch (err) {
            console.error('Error fetching setpoints:', err);
        }
    };

    const getStatusColor = (current, target, tolerance) => {
        if (current === null || current === undefined || typeof current !== 'number') {
            return '#6c757d'; // Gray for no data
        }
        const diff = Math.abs(current - target);
        if (diff <= tolerance) return '#5332a8ff'; // Optimal
        if (current < target) return '#5332a8ff'; // Too low
        return '#f72585'; // Too high
    };

    const formatTimestamp = (timestamp) => {
        if (!timestamp) return 'Never';
        return timestamp.toLocaleTimeString();
    };

    const getConnectionStatusText = () => {
        if (realTimeStatus.connected) return '🟢 Connected to Broker';
        return '🔴 Disconnected';
    };

    const getConnectionStatusClass = () => {
        if (realTimeStatus.connected) return 'connected';
        return 'disconnected';
    };

    if (loading) {
        return (
            <div className="current-environment">
                <h2>Environment - {selectedLocation}</h2>
                <p>Loading...</p>
            </div>
        );
    }

    return (
        <div className="space-y-1">
            {/* Connection Status Bar */}
            <div className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center justify-between ${getConnectionStatusClass() === 'connected'
                ? 'bg-green-50 text-green-700 border border-green-200'
                : getConnectionStatusClass() === 'connecting'
                    ? 'bg-yellow-50 text-yellow-700 border border-yellow-200'
                    : 'bg-red-50 text-red-700 border border-red-200'
                }`}>
                <span className="flex items-center gap-2">
                    <span className={`inline-block w-2 h-2 rounded-full ${getConnectionStatusClass() === 'connected'
                        ? 'bg-green-500 animate-pulse'
                        : getConnectionStatusClass() === 'connecting'
                            ? 'bg-yellow-500 animate-pulse'
                            : 'bg-red-500'
                        }`}></span>
                    {getConnectionStatusText()}
                </span>
                {isConnecting && (
                    <span className="flex items-center gap-1 text-xs">
                        <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Connecting...
                    </span>
                )}
            </div>

            {/* Header */}
            <div className="flex items-center gap-3 pb-4 border-b border-gray-200">
                <div className="w-10 h-10 bg-gradient-to-br from-teal-500 to-blue-500 rounded-lg flex items-center justify-center text-white text-xl">
                    🌡️
                </div>
                <h2 className="text-2xl font-bold text-gray-800">Current Environment</h2>
            </div>

            {/* Location Info */}
            <div className="flex items-center gap-2 text-gray-600 bg-gray-50 px-4 py-3 rounded-lg">
                <svg className="w-5 h-5 text-teal-600" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                </svg>
                <span className="text-sm">Location:</span>
                <strong className="text-gray-800">{selectedLocation}</strong>
            </div>

            {/* Last Update */}
            {lastUpdate && (
                <div className="text-xs text-gray-500 flex items-center gap-2 px-4">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Last updated: {formatTimestamp(lastUpdate)}
                </div>
            )}

            {/* Show sensor data if active, otherwise show connect message */}
            {realTimeStatus.connected && realTimeStatus.sensorActive ? (
                <div className="space-y-4 pt-2">
                    {/* Temperature Card */}
                    <div className="bg-gradient-to-br from-red-50 to-orange-50 rounded-xl p-6 border border-red-100 shadow-sm hover:shadow-md transition-shadow">
                        <div className="flex items-center justify-between mb-3">
                            <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                                <span className="text-2xl">🌡️</span>
                                Temperature
                            </h3>
                            {realTimeStatus.temperature && (
                                <span className="inline-flex h-2 w-2 rounded-full bg-red-500 animate-ping"></span>
                            )}
                        </div>
                        <div
                            className={`text-4xl font-bold transition-all duration-300 ${realTimeStatus.temperature ? 'scale-105' : ''
                                }`}
                            style={{ color: getStatusColor(currentData.temperature, setpoints.temperature, 0.5) }}
                        >
                            {safeToFixed(currentData.temperature, 1)}°C
                        </div>
                        <div className="mt-2 text-xs text-gray-500">
                            Target: {setpoints.temperature}°C
                        </div>
                    </div>

                    {/* Humidity Card */}
                    <div className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-xl p-6 border border-blue-100 shadow-sm hover:shadow-md transition-shadow">
                        <div className="flex items-center justify-between mb-3">
                            <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                                <span className="text-2xl">💧</span>
                                Humidity
                            </h3>
                            {realTimeStatus.humidity && (
                                <span className="inline-flex h-2 w-2 rounded-full bg-blue-500 animate-ping"></span>
                            )}
                        </div>
                        <div
                            className={`text-4xl font-bold transition-all duration-300 ${realTimeStatus.humidity ? 'scale-105' : ''
                                }`}
                            style={{ color: getStatusColor(currentData.humidity, setpoints.humidity, 2.0) }}
                        >
                            {safeToFixed(currentData.humidity, 1)}%
                        </div>
                        <div className="mt-2 text-xs text-gray-500">
                            Target: {setpoints.humidity}%
                        </div>
                    </div>
                </div>
            ) : (
                /* Connection Message */
                <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl p-8 text-center border border-gray-200">
                    <div className="inline-flex items-center justify-center w-16 h-16 bg-white rounded-full shadow-md mb-4">
                        <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                    </div>

                    <h3 className="text-lg font-semibold text-gray-800 mb-2">
                        Sensor Connection Required 📡
                    </h3>

                    <p className="text-sm text-gray-600 mb-6">
                        {realTimeStatus.connected
                            ? 'Connected to server. Waiting for sensor data...'
                            : isConnecting
                                ? 'Connecting to server...'
                                : 'Please check your connection and ensure sensors are active.'
                        }
                    </p>

                    {/* Connection Activity Indicators */}
                    <div className="space-y-3 bg-white rounded-lg p-4 shadow-sm">
                        <div className="flex items-center justify-between">
                            <span className="text-sm text-gray-600">Broker Status</span>
                            <div className="flex items-center gap-2">
                                <span className={`inline-block w-2 h-2 rounded-full ${realTimeStatus.connected ? 'bg-green-500 animate-pulse' : 'bg-gray-300'
                                    }`}></span>
                                <span className={`text-sm font-medium ${realTimeStatus.connected ? 'text-green-600' : 'text-gray-500'
                                    }`}>
                                    {realTimeStatus.connected ? 'Connected' : 'Disconnected'}
                                </span>
                            </div>
                        </div>

                        <div className="h-px bg-gray-200"></div>

                        <div className="flex items-center justify-between">
                            <span className="text-sm text-gray-600">Sensor Status</span>
                            <div className="flex items-center gap-2">
                                <span className={`inline-block w-2 h-2 rounded-full ${realTimeStatus.sensorActive ? 'bg-green-500 animate-pulse' : 'bg-gray-300'
                                    }`}></span>
                                <span className={`text-sm font-medium ${realTimeStatus.sensorActive ? 'text-green-600' : 'text-gray-500'
                                    }`}>
                                    {realTimeStatus.sensorActive ? 'Active' : 'Inactive'}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CurrentEnvironment;
