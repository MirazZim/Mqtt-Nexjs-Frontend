"use client";
import React, { useState, useEffect, useContext, useRef } from 'react';
import { createSocket } from '../../lib/socket';
import AuthContext from '../../context/AuthContext';
import { useSmoothSensor } from '../../hooks/useSmoothSensor.js';
import API_BASE_URL from '../../config/api.js';

const CurrentEnvironment = ({ selectedLocation }) => {
    const { user } = useContext(AuthContext);

    // State declarations MUST come before hooks usage
    const [currentData, setCurrentData] = useState({
        temperature: null,
        humidity: null,
        airflow: null,
        bowl_temp: null,
        sonar_distance: null,
        co2_level: null,
        sugar_level: null
    });

    const [setpoints, setSetpoints] = useState({
        temperature: 22.0,
        humidity: 55.0,
        airflow: 2.0,
        bowl_temp: 45.0,
        sonar_distance: 30.0,
        co2_level: 400.0,
        sugar_level: 35.0
    });

    // ✅ NOW use smooth sensor hooks AFTER state declarations
    const smoothTemp = useSmoothSensor(currentData.temperature, 300);
    const smoothHumidity = useSmoothSensor(currentData.humidity, 300);
    const smoothAirflow = useSmoothSensor(currentData.airflow, 300);
    const smoothBowlTemp = useSmoothSensor(currentData.bowl_temp, 300);
    const smoothSonarDistance = useSmoothSensor(currentData.sonar_distance, 300);
    const smoothCO2 = useSmoothSensor(currentData.co2_level, 300);
    const smoothSugar = useSmoothSensor(currentData.sugar_level, 300);

    // Actuator status states
    const [actuatorStatus, setActuatorStatus] = useState({
        bowlFan: {
            status: null,
            message: 'Waiting for status...',
            active: false
        },
        sonarPump: {
            status: null,
            message: 'Waiting for status...',
            active: false
        },
        co2Fermentation: {
            status: null,
            message: 'Waiting for status...',
            active: false
        },
        sugarFermentation: {
            status: null,
            message: 'Waiting for status...',
            complete: false
        }
    });

    // Connection state management
    const [realTimeStatus, setRealTimeStatus] = useState({
        temperature: false,
        humidity: false,
        airflow: false,
        bowl_temp: false,
        sonar_distance: false,
        co2_level: false,
        sugar_level: false,
        connected: false,
        sensorActive: false
    });

    // ESP Control States
    const [publishStatus, setPublishStatus] = useState('');
    const [textMessage, setTextMessage] = useState('');
    const [textPublishStatus, setTextPublishStatus] = useState('');
    const [loading, setLoading] = useState(true);
    const [socket, setSocket] = useState(null);
    const [lastUpdate, setLastUpdate] = useState(null);
    const [isConnecting, setIsConnecting] = useState(false);

    // ✅ NEW: Refs to prevent timeout race conditions
    const statusTimeoutRefs = useRef({
        temperature: null,
        humidity: null,
        bowl_temp: null,
        sonar_distance: null,
        co2_level: null,
        sugar_level: null
    });

    // Refs for reconnection logic
    const reconnectTimeoutRef = useRef(null);
    const reconnectAttemptsRef = useRef(0);
    const sensorTimeoutRef = useRef(null);
    const maxReconnectAttempts = 2;
    const baseReconnectDelay = 1000;

    // ✅ NEW: Improved status update function
    const updateSensorStatus = (sensorType, value) => {
        if (typeof value !== 'number') return;

        // Clear existing timeout
        if (statusTimeoutRefs.current[sensorType]) {
            clearTimeout(statusTimeoutRefs.current[sensorType]);
        }

        // Set status to true
        setRealTimeStatus(prev => ({ ...prev, [sensorType]: true }));

        // Schedule reset
        statusTimeoutRefs.current[sensorType] = setTimeout(() => {
            setRealTimeStatus(prev => ({ ...prev, [sensorType]: false }));
            statusTimeoutRefs.current[sensorType] = null;
        }, 1500);
    };

    // Safe number formatting function
    const safeToFixed = (value, digits) => {
        return (typeof value === 'number' && !isNaN(value)) ? value.toFixed(digits) : 'N/A';
    };

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

    // TEXT MQTT FUNCTION
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

        setTextMessage('');
    };

    // HANDLE ENTER KEY FOR TEXT INPUT
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

        // ✅ Clear all sensor status timeouts
        Object.keys(statusTimeoutRefs.current).forEach(key => {
            if (statusTimeoutRefs.current[key]) {
                clearTimeout(statusTimeoutRefs.current[key]);
                statusTimeoutRefs.current[key] = null;
            }
        });

        if (socket) {
            socket.disconnect();
            setSocket(null);
        }
        setIsConnecting(false);
    };

    // SINGLE effect to handle location changes and socket management
    useEffect(() => {
        console.log(`🔄 CurrentEnvironment location changed to: ${selectedLocation}`);

        if (!user || !selectedLocation) {
            cleanup();
            return;
        }

        cleanup();

        setCurrentData({
            temperature: null,
            humidity: null,
            airflow: null,
            bowl_temp: null,
            sonar_distance: null,
            co2_level: null,
            sugar_level: null
        });

        setRealTimeStatus({
            temperature: false,
            humidity: false,
            airflow: false,
            bowl_temp: false,
            sonar_distance: false,
            co2_level: false,
            sugar_level: false,
            connected: false,
            sensorActive: false
        });

        setLastUpdate(null);
        setLoading(true);

        const setupTimer = setTimeout(() => {
            fetchLatestEnvironment();
            fetchSetpoints();
            setupRealtimeUpdates();
        }, 100);

        return () => {
            clearTimeout(setupTimer);
            cleanup();
        };
    }, [user?.id, selectedLocation]);

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

    const setSensorTimeout = () => {
        if (sensorTimeoutRef.current) {
            clearTimeout(sensorTimeoutRef.current);
        }

        sensorTimeoutRef.current = setTimeout(() => {
            console.log('🔴 CurrentEnvironment sensor timeout - no data for 5 seconds');
            setRealTimeStatus(prev => ({ ...prev, sensorActive: false }));
        }, 5000);
    };

    const setupRealtimeUpdates = () => {
        if (isConnecting || !selectedLocation || !user) return;

        console.log(`🔄 CurrentEnvironment setting up socket connection for location: ${selectedLocation}`);
        setIsConnecting(true);

        try {
            const socketConnection = createSocket(user.token);
            setSocket(socketConnection);

            socketConnection.on('connect', () => {
                console.log('🟢 CurrentEnvironment connected to real-time updates');
                reconnectAttemptsRef.current = 0;
                setRealTimeStatus(prev => ({
                    ...prev,
                    connected: true
                }));
                setIsConnecting(false);

                socketConnection.emit('joinLocation', selectedLocation);
                console.log(`🔄 CurrentEnvironment joined location: ${selectedLocation}`);
            });

            socketConnection.on('disconnect', (reason) => {
                console.log('🔴 CurrentEnvironment disconnected:', reason);
                setRealTimeStatus(prev => ({
                    ...prev,
                    connected: false,
                    sensorActive: false
                }));
                setIsConnecting(false);

                if (sensorTimeoutRef.current) {
                    clearTimeout(sensorTimeoutRef.current);
                    sensorTimeoutRef.current = null;
                }

                if (reason !== 'io client disconnect') {
                    setTimeout(() => attemptReconnect(), 1000);
                }
            });

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

            socketConnection.on('publishResult', (result) => {
                if (result.topic === 'text') {
                    if (result.success) {
                        setTextPublishStatus(`✅ Text sent: "${result.message}"`);
                    } else {
                        setTextPublishStatus(`❌ Text failed: ${result.error}`);
                    }
                    setTimeout(() => setTextPublishStatus(''), 1000);
                } else {
                    if (result.success) {
                        setPublishStatus(`✅ Sent "${result.message || result.command}" to ${result.topic || result.espDevice}`);
                    } else {
                        setPublishStatus(`❌ Failed: ${result.error}`);
                    }
                    setTimeout(() => setPublishStatus(''), 3000);
                }
            });

            socketConnection.on('textMessageReceived', (data) => {
                console.log('📝 Text message received from MQTT:', data.message);
            });

            // ✅ OPTIMIZED: Real-time environment updates
            socketConnection.on('environmentUpdate', (data) => {
                if (data.location === selectedLocation) {
                    console.log('🌡️ REAL-TIME UPDATE:', {
                        temp: data.temperature,
                        hum: data.humidity,
                        bowl: data.bowl_temp,
                        sonar: data.sonar_distance,
                        co2: data.co2_level,
                        sugar: data.sugar_level,
                        timestamp: new Date().toLocaleTimeString()
                    });

                    setRealTimeStatus(prev => ({ ...prev, sensorActive: true }));
                    setSensorTimeout();

                    setCurrentData(prev => ({
                        temperature: typeof data.temperature === 'number' ? data.temperature : prev.temperature,
                        humidity: typeof data.humidity === 'number' ? data.humidity : prev.humidity,
                        airflow: typeof data.airflow === 'number' ? data.airflow : prev.airflow,
                        bowl_temp: typeof data.bowl_temp === 'number' ? data.bowl_temp : prev.bowl_temp,
                        sonar_distance: typeof data.sonar_distance === 'number' ? data.sonar_distance : prev.sonar_distance,
                        co2_level: typeof data.co2_level === 'number' ? data.co2_level : prev.co2_level,
                        sugar_level: typeof data.sugar_level === 'number' ? data.sugar_level : prev.sugar_level
                    }));

                    setLastUpdate(new Date());

                    // ✅ IMPROVED: Use the new status update function
                    updateSensorStatus('temperature', data.temperature);
                    updateSensorStatus('humidity', data.humidity);
                    updateSensorStatus('bowl_temp', data.bowl_temp);
                    updateSensorStatus('sonar_distance', data.sonar_distance);
                    updateSensorStatus('co2_level', data.co2_level);
                    updateSensorStatus('sugar_level', data.sugar_level);

                    // Update setpoints
                    if (typeof data.desiredTemperature === 'number') {
                        setSetpoints(prev => ({ ...prev, temperature: data.desiredTemperature }));
                    }
                    if (typeof data.desiredHumidity === 'number') {
                        setSetpoints(prev => ({ ...prev, humidity: data.desiredHumidity }));
                    }
                    if (typeof data.desiredBowlTemp === 'number') {
                        setSetpoints(prev => ({ ...prev, bowl_temp: data.desiredBowlTemp }));
                    }
                    if (typeof data.desiredSonarDistance === 'number') {
                        setSetpoints(prev => ({ ...prev, sonar_distance: data.desiredSonarDistance }));
                    }
                    if (typeof data.desiredCO2Level === 'number') {
                        setSetpoints(prev => ({ ...prev, co2_level: data.desiredCO2Level }));
                    }
                    if (typeof data.desiredSugarLevel === 'number') {
                        setSetpoints(prev => ({ ...prev, sugar_level: data.desiredSugarLevel }));
                    }
                }
            });

            socketConnection.on('co2FermentationStatus', (data) => {
                if (data.location === selectedLocation) {
                    console.log('🫧 CO2 fermentation status:', data.message);
                    setActuatorStatus(prev => ({
                        ...prev,
                        co2Fermentation: {
                            status: data.status,
                            message: data.message,
                            active: data.fermentationActive
                        }
                    }));
                }
            });

            socketConnection.on('sugarFermentationStatus', (data) => {
                if (data.location === selectedLocation) {
                    console.log('🍬 Sugar fermentation status:', data.message);
                    setActuatorStatus(prev => ({
                        ...prev,
                        sugarFermentation: {
                            status: data.status,
                            message: data.message,
                            complete: data.fermentationComplete
                        }
                    }));
                }
            });

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
                    if (typeof data.desiredBowlTemp === 'number') {
                        setSetpoints(prev => ({ ...prev, bowl_temp: data.desiredBowlTemp }));
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
                    const measurementTime = new Date(measurement.created_at);
                    const timeSinceLastMeasurement = Date.now() - measurementTime.getTime();

                    setCurrentData({
                        temperature: typeof measurement.temperature === 'number' ? measurement.temperature : null,
                        humidity: typeof measurement.humidity === 'number' ? measurement.humidity : null,
                        airflow: typeof measurement.airflow === 'number' ? measurement.airflow : null,
                        bowl_temp: typeof measurement.bowl_temp === 'number' ? measurement.bowl_temp : null,
                        sonar_distance: typeof measurement.sonar_distance === 'number' ? measurement.sonar_distance : null,
                        co2_level: typeof measurement.co2_level === 'number' ? measurement.co2_level : null,
                        sugar_level: typeof measurement.sugar_level === 'number' ? measurement.sugar_level : null
                    });
                    setLastUpdate(measurementTime);

                    if (timeSinceLastMeasurement < 120000) {
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
                        airflow: data.data.desiredAirflow || 2.0,
                        bowl_temp: data.data.desiredBowlTemp || 45.0,
                        sonar_distance: data.data.desiredSonarDistance || 30.0,
                        co2_level: data.data.desiredCO2Level || 400.0,
                        sugar_level: data.data.desiredSugarLevel || 35.0
                    });
                }
            }
        } catch (err) {
            console.error('Error fetching setpoints:', err);
        }
    };

    const getStatusColor = (current, target, tolerance) => {
        if (current === null || current === undefined || typeof current !== 'number') {
            return '#6c757d';
        }
        const diff = Math.abs(current - target);
        if (diff <= tolerance) return '#5332a8ff';
        if (current < target) return '#5332a8ff';
        return '#f72585';
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
            <div className={`px-3 py-1.5 rounded-md text-xs font-medium flex items-center justify-between ${getConnectionStatusClass() === 'connected'
                ? 'bg-green-50 text-green-700 border border-green-200'
                : getConnectionStatusClass() === 'connecting'
                    ? 'bg-yellow-50 text-yellow-700 border border-yellow-200'
                    : 'bg-red-50 text-red-700 border border-red-200'
                }`}>
                <span className="flex items-center gap-1.5">
                    <span className={`inline-block w-1.5 h-1.5 rounded-full ${getConnectionStatusClass() === 'connected'
                        ? 'bg-green-500 animate-pulse'
                        : getConnectionStatusClass() === 'connecting'
                            ? 'bg-yellow-500 animate-pulse'
                            : 'bg-red-500'
                        }`}></span>
                    {getConnectionStatusText()}
                </span>
                {isConnecting && (
                    <span className="flex items-center gap-1 text-xs">
                        <svg className="animate-spin h-3 w-3" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Connecting...
                    </span>
                )}
            </div>

            {/* Header */}
            <div className="flex items-center gap-2 pb-2 border-b border-gray-200">
                <div className="w-7 h-7 bg-gradient-to-br from-teal-500 to-blue-500 rounded-md flex items-center justify-center text-white text-sm">
                    🌡️
                </div>
                <h2 className="text-lg font-bold text-gray-800">Current Environment</h2>
            </div>

            {/* Location Info */}
            <div className="flex items-center gap-1.5 text-gray-600 bg-gray-50 px-3 py-2 rounded-md">
                <svg className="w-4 h-4 text-teal-600" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                </svg>
                <span className="text-xs">Location:</span>
                <strong className="text-xs text-gray-800">{selectedLocation}</strong>
            </div>

            {/* Last Update */}
            {lastUpdate && (
                <div className="text-xs text-gray-500 flex items-center gap-1.5 px-3">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Last updated: {formatTimestamp(lastUpdate)}
                </div>
            )}

            {/* Show sensor data if active, otherwise show connect message */}
            {realTimeStatus.connected && realTimeStatus.sensorActive ? (
                <div className="space-y-3 pt-1">
                    {/* Grid container for 2x3 layout (6 sensors) */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {/* ✅ Temperature Card - OPTIMIZED */}
                        <div className="bg-gradient-to-br from-red-50 to-orange-50 rounded-md p-2 md:p-2.5 border border-red-100 shadow-sm hover:shadow transition-shadow">
                            <div className="flex items-center justify-between mb-1">
                                <h3 className="text-[10px] md:text-xs font-semibold text-gray-700 flex items-center gap-1">
                                    <span className="text-sm">🌡️</span>
                                    <span className="hidden sm:inline">Temperature</span>
                                    <span className="sm:hidden">Temp</span>
                                </h3>
                                {realTimeStatus.temperature && (
                                    <span className="inline-flex h-1 w-1 md:h-1.5 md:w-1.5 rounded-full bg-red-500 animate-pulse"></span>
                                )}
                            </div>
                            <div
                                className="text-lg md:text-xl font-bold transition-colors duration-500 ease-out tabular-nums"
                                style={{ color: getStatusColor(currentData.temperature, setpoints.temperature, 0.5) }}
                            >
                                {safeToFixed(smoothTemp, 1)}°C
                            </div>
                            <div className="mt-1 text-[9px] md:text-[10px] text-gray-500">
                                Target: {setpoints.temperature}°C
                            </div>
                        </div>

                        {/* ✅ Humidity Card - OPTIMIZED */}
                        <div className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-md p-2 md:p-2.5 border border-blue-100 shadow-sm hover:shadow transition-shadow">
                            <div className="flex items-center justify-between mb-1">
                                <h3 className="text-[10px] md:text-xs font-semibold text-gray-700 flex items-center gap-1">
                                    <span className="text-sm">💧</span>
                                    <span className="hidden sm:inline">Humidity</span>
                                    <span className="sm:hidden">Humid</span>
                                </h3>
                                {realTimeStatus.humidity && (
                                    <span className="inline-flex h-1 w-1 md:h-1.5 md:w-1.5 rounded-full bg-blue-500 animate-pulse"></span>
                                )}
                            </div>
                            <div
                                className="text-lg md:text-xl font-bold transition-colors duration-500 ease-out tabular-nums"
                                style={{ color: getStatusColor(currentData.humidity, setpoints.humidity, 2.0) }}
                            >
                                {safeToFixed(smoothHumidity, 1)}%
                            </div>
                            <div className="mt-1 text-[9px] md:text-[10px] text-gray-500">
                                Target: {setpoints.humidity}%
                            </div>
                        </div>

                        {/* ✅ Bowl Temperature Card - OPTIMIZED */}
                        <div className="bg-gradient-to-br from-amber-50 to-yellow-50 rounded-md p-2 md:p-2.5 border border-amber-100 shadow-sm hover:shadow transition-shadow">
                            <div className="flex items-center justify-between mb-1">
                                <h3 className="text-[10px] md:text-xs font-semibold text-gray-700 flex items-center gap-1">
                                    <span className="text-sm">🥣</span>
                                    <span className="hidden sm:inline">Bowl Temperature</span>
                                    <span className="sm:hidden">Bowl</span>
                                </h3>
                                {realTimeStatus.bowl_temp && (
                                    <span className="inline-flex h-1 w-1 md:h-1.5 md:w-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                                )}
                            </div>
                            <div
                                className="text-lg md:text-xl font-bold transition-colors duration-500 ease-out tabular-nums"
                                style={{ color: getStatusColor(currentData.bowl_temp, setpoints.bowl_temp, 3) }}
                            >
                                {safeToFixed(smoothBowlTemp, 1)}°C
                            </div>
                            <div className="mt-1 text-[9px] md:text-[10px] text-gray-500">
                                Target: {setpoints.bowl_temp}°C
                            </div>
                        </div>

                        {/* ✅ Sonar/Liquid Level Card - OPTIMIZED */}
                        <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-md p-2 md:p-2.5 border border-purple-100 shadow-sm hover:shadow transition-shadow">
                            <div className="flex items-center justify-between mb-1">
                                <h3 className="text-[10px] md:text-xs font-semibold text-gray-700 flex items-center gap-1">
                                    <span className="text-sm">💦</span>
                                    <span className="hidden sm:inline">Liquid Level</span>
                                    <span className="sm:hidden">Liquid</span>
                                </h3>
                                {realTimeStatus.sonar_distance && (
                                    <span className="inline-flex h-1 w-1 md:h-1.5 md:w-1.5 rounded-full bg-purple-500 animate-pulse"></span>
                                )}
                            </div>
                            <div
                                className="text-lg md:text-xl font-bold transition-colors duration-500 ease-out tabular-nums"
                                style={{ color: getStatusColor(currentData.sonar_distance, setpoints.sonar_distance, 5) }}
                            >
                                {safeToFixed(smoothSonarDistance, 1)} cm
                            </div>
                            <div className="mt-1 text-[9px] md:text-[10px] text-gray-500">
                                Target: {setpoints.sonar_distance} cm
                            </div>
                        </div>

                        {/* ✅ CO2 Level Card - OPTIMIZED */}
                        <div className="bg-gradient-to-br from-green-50 to-teal-50 rounded-md p-2 md:p-2.5 border border-green-100 shadow-sm hover:shadow transition-shadow">
                            <div className="flex items-center justify-between mb-1">
                                <h3 className="text-[10px] md:text-xs font-semibold text-gray-700 flex items-center gap-1">
                                    <span className="text-sm">🫧</span>
                                    <span className="hidden sm:inline">CO2 Level</span>
                                    <span className="sm:hidden">CO2</span>
                                </h3>
                                {realTimeStatus.co2_level && (
                                    <span className="inline-flex h-1 w-1 md:h-1.5 md:w-1.5 rounded-full bg-green-500 animate-pulse"></span>
                                )}
                            </div>
                            <div
                                className="text-lg md:text-xl font-bold transition-colors duration-500 ease-out tabular-nums"
                                style={{ color: getStatusColor(currentData.co2_level, setpoints.co2_level, 50) }}
                            >
                                {safeToFixed(smoothCO2, 0)} ppm
                            </div>
                            <div className="mt-1 text-[9px] md:text-[10px] text-gray-500">
                                Target: {setpoints.co2_level} ppm
                            </div>
                        </div>

                        {/* ✅ Sugar Level Card - OPTIMIZED */}
                        <div className="bg-gradient-to-br from-pink-50 to-rose-50 rounded-md p-2 md:p-2.5 border border-pink-100 shadow-sm hover:shadow transition-shadow">
                            <div className="flex items-center justify-between mb-1">
                                <h3 className="text-[10px] md:text-xs font-semibold text-gray-700 flex items-center gap-1">
                                    <span className="text-sm">🍬</span>
                                    <span className="hidden sm:inline">Sugar Level</span>
                                    <span className="sm:hidden">Sugar</span>
                                </h3>
                                {realTimeStatus.sugar_level && (
                                    <span className="inline-flex h-1 w-1 md:h-1.5 md:w-1.5 rounded-full bg-pink-500 animate-pulse"></span>
                                )}
                            </div>
                            <div
                                className="text-lg md:text-xl font-bold transition-colors duration-500 ease-out tabular-nums"
                                style={{ color: getStatusColor(currentData.sugar_level, setpoints.sugar_level, 5) }}
                            >
                                {safeToFixed(smoothSugar, 1)} g/L
                            </div>
                            <div className="mt-1 text-[9px] md:text-[10px] text-gray-500">
                                Target: {setpoints.sugar_level} g/L
                            </div>
                        </div>
                    </div>

                    {/* Status Badges Section - Only CO2 & Sugar (1x2 Grid) */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2">
                        {/* CO2 Fermentation Status */}
                        <div className={`px-3 py-2 rounded-lg text-xs font-medium transition-all ${actuatorStatus.co2Fermentation.active
                            ? 'bg-green-50 border-2 border-green-200'
                            : 'bg-red-50 border-2 border-red-200'
                            }`}>
                            <div className="flex items-center gap-2">
                                <span className="text-lg">{actuatorStatus.co2Fermentation.active ? '⚗️' : '⚠️'}</span>
                                <div className="flex-1">
                                    <p className="font-semibold text-gray-700 mb-0.5">CO2 Monitor</p>
                                    <p className="text-[10px] text-gray-600 leading-tight">{actuatorStatus.co2Fermentation.message}</p>
                                </div>
                            </div>
                        </div>

                        {/* Sugar Fermentation Status */}
                        <div className={`px-3 py-2 rounded-lg text-xs font-medium transition-all ${actuatorStatus.sugarFermentation.complete
                            ? 'bg-blue-50 border-2 border-blue-200'
                            : 'bg-gray-50 border-2 border-gray-200'
                            }`}>
                            <div className="flex items-center gap-2">
                                <span className="text-lg">{actuatorStatus.sugarFermentation.complete ? '✅' : '🔒'}</span>
                                <div className="flex-1">
                                    <p className="font-semibold text-gray-700 mb-0.5">Sugar Monitor</p>
                                    <p className="text-[10px] text-gray-600 leading-tight">{actuatorStatus.sugarFermentation.message}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            ) : (
                /* Connection Message */
                <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-lg p-5 text-center border border-gray-200">
                    <div className="inline-flex items-center justify-center w-12 h-12 bg-white rounded-full shadow-md mb-3">
                        <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                    </div>

                    <h3 className="text-sm font-semibold text-gray-800 mb-1.5">
                        Sensor Connection Required 📡
                    </h3>

                    <p className="text-xs text-gray-600 mb-4">
                        {realTimeStatus.connected
                            ? 'Connected to server. Waiting for sensor data...'
                            : isConnecting
                                ? 'Connecting to server...'
                                : 'Please check your connection and ensure sensors are active.'
                        }
                    </p>

                    {/* Connection Activity Indicators */}
                    <div className="space-y-2 bg-white rounded-md p-3 shadow-sm">
                        <div className="flex items-center justify-between">
                            <span className="text-xs text-gray-600">Broker Status</span>
                            <div className="flex items-center gap-1.5">
                                <span className={`inline-block w-1.5 h-1.5 rounded-full ${realTimeStatus.connected ? 'bg-green-500 animate-pulse' : 'bg-gray-300'
                                    }`}></span>
                                <span className={`text-xs font-medium ${realTimeStatus.connected ? 'text-green-600' : 'text-gray-500'
                                    }`}>
                                    {realTimeStatus.connected ? 'Connected' : 'Disconnected'}
                                </span>
                            </div>
                        </div>

                        <div className="h-px bg-gray-200"></div>

                        <div className="flex items-center justify-between">
                            <span className="text-xs text-gray-600">Sensor Status</span>
                            <div className="flex items-center gap-1.5">
                                <span className={`inline-block w-1.5 h-1.5 rounded-full ${realTimeStatus.sensorActive ? 'bg-green-500 animate-pulse' : 'bg-gray-300'
                                    }`}></span>
                                <span className={`text-xs font-medium ${realTimeStatus.sensorActive ? 'text-green-600' : 'text-gray-500'
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
