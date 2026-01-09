"use client";
import React, { useState, useEffect, useContext, useRef } from 'react';
import { createSocket } from '../../lib/socket';
import AuthContext from '../../context/AuthContext';
import { useSmoothSensor } from '../../hooks/useSmoothSensor.js';
import API_BASE_URL from '../../config/api.js';
import { useTranslation } from '../../app/i18n/client.js';
import { usePathname } from 'next/navigation';

const CurrentEnvironment = ({ selectedLocation }) => {
    const { user } = useContext(AuthContext);
    const pathname = usePathname();
    const lng = pathname.split("/")[1];
    const { t } = useTranslation(lng, "current-environment");

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

    // ✅ Per-sensor timestamps for modern display
    const [sensorTimestamps, setSensorTimestamps] = useState({
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

    const smoothTemp = useSmoothSensor(currentData.temperature, 100);
    const smoothHumidity = useSmoothSensor(currentData.humidity, 100);
    const smoothBowlTemp = useSmoothSensor(currentData.bowl_temp, 100);
    const smoothSonarDistance = useSmoothSensor(currentData.sonar_distance, 100);
    const smoothCO2 = useSmoothSensor(currentData.co2_level, 100);
    const smoothSugar = useSmoothSensor(currentData.sugar_level, 100);



    // Actuator status states
    const [actuatorStatus, setActuatorStatus] = useState({
        bowlFan: {
            statusKey: null,
            messageKey: 'Waiting for status...',
            active: false
        },
        sonarPump: {
            statusKey: null,
            messageKey: 'Waiting for status...',
            active: false
        },
        co2Fermentation: {
            statusKey: null,
            messageKey: 'Waiting for status...',
            active: false
        },
        sugarFermentation: {
            statusKey: null,
            messageKey: 'Waiting for status...',
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



    // Refs to prevent timeout race conditions
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

    const SENSOR_TIMEOUTS = {
        temperature: 15000,     // ✅ 15 seconds (safer)
        humidity: 15000,        // ✅ 15 seconds
        bowl_temp: 15000,       // ✅ 15 seconds
        sonar_distance: 15000,  // ✅ 15 seconds
        sugar_level: 15000,     // ✅ 15 seconds
        co2_level: 70000        // ✅ 70 seconds (keep this!)
    };

    // Improved status update function
    // ✅ NEW VERSION - Per-sensor timeout
    const updateSensorStatus = (sensorType, value) => {
        if (typeof value !== 'number') return;

        // Clear existing timeout
        if (statusTimeoutRefs.current[sensorType]) {
            clearTimeout(statusTimeoutRefs.current[sensorType]);
        }

        // Set status to true
        setRealTimeStatus(prev => ({ ...prev, [sensorType]: true }));

        // Get sensor-specific timeout duration
        const timeoutDuration = SENSOR_TIMEOUTS[sensorType] || 1500; // Default 15 seconds

        console.log(`✅ [${sensorType}] Sensor active, timeout in ${timeoutDuration / 1000}s`);

        // Schedule reset with sensor-specific timeout
        statusTimeoutRefs.current[sensorType] = setTimeout(() => {
            console.log(`⏰ [${sensorType}] Timeout reached - marking inactive`);
            setRealTimeStatus(prev => ({ ...prev, [sensorType]: false }));
            statusTimeoutRefs.current[sensorType] = null;
        }, timeoutDuration);  // ✅ Uses sensor-specific timeout!
    };


    // Safe number formatting function
    const safeToFixed = (value, digits) => {
        return (typeof value === 'number' && !isNaN(value)) ? value.toFixed(digits) : 'N/A';
    };

    // ✅ State to trigger re-render for relative time updates
    const [, setTimeTick] = useState(0);

    // ✅ Update relative timestamps every 5 seconds for modern live feel
    useEffect(() => {
        const interval = setInterval(() => {
            setTimeTick(tick => tick + 1);
        }, 5000);
        return () => clearInterval(interval);
    }, []);

    // ✅ Modern relative time formatter for sensor timestamps
    const formatRelativeTime = (timestamp) => {
        if (!timestamp) return null;
        const now = new Date();
        const diff = Math.floor((now - timestamp) / 1000); // seconds

        if (diff < 5) return 'just now';
        if (diff < 60) return `${diff}s ago`;
        if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
        if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
        return timestamp.toLocaleTimeString();
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

        // Clear all sensor status timeouts
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
            fetchActuatorStates();
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

    // ✅ ADD THIS - Automatically sync sensorActive with individual sensors
    // ✅ IMPROVED
    useEffect(() => {
        // Don't check until data is loaded
        if (loading) return;

        const anySensorActive =
            realTimeStatus.temperature ||
            realTimeStatus.humidity ||
            realTimeStatus.airflow ||
            realTimeStatus.bowl_temp ||
            realTimeStatus.sonar_distance ||
            realTimeStatus.co2_level ||
            realTimeStatus.sugar_level;

        if (anySensorActive !== realTimeStatus.sensorActive) {
            setRealTimeStatus(prev => ({
                ...prev,
                sensorActive: anySensorActive
            }));
        }
    }, [
        loading,  // ← ADD THIS DEPENDENCY
        realTimeStatus.temperature,
        realTimeStatus.humidity,
        realTimeStatus.airflow,
        realTimeStatus.bowl_temp,
        realTimeStatus.sonar_distance,
        realTimeStatus.co2_level,
        realTimeStatus.sugar_level
    ]);


    const setupRealtimeUpdates = () => {
        if (isConnecting || !selectedLocation || !user) return;

        console.log(`[CurrentEnvironment] Setting up socket connection for location: ${selectedLocation}`);
        setIsConnecting(true);

        try {
            const socketConnection = createSocket(user.token);
            setSocket(socketConnection);

            socketConnection.on('connect', () => {
                console.log(`[CurrentEnvironment] Connected to real-time updates`);
                reconnectAttemptsRef.current = 0;
                setRealTimeStatus(prev => ({ ...prev, connected: true }));
                setIsConnecting(false);

                // JOIN USER-SPECIFIC ROOM (matches backend emission pattern)
                const userRoom = `user_${user.id}_${selectedLocation}`;
                socketConnection.emit('joinRoom', userRoom);
                console.log(`[CurrentEnvironment] Joined user room: ${userRoom}`);

                // JOIN LOCATION-SPECIFIC ROOM (for backward compatibility)
                socketConnection.emit('joinLocation', selectedLocation);
                console.log(`[CurrentEnvironment] Joined location: ${selectedLocation}`);

                // JOIN ACTUATOR ROOM (standardized format)
                socketConnection.emit('joinRoom', `room_${selectedLocation}`);
                console.log(`[CurrentEnvironment] Joined actuator room: room_${selectedLocation}`);
            });

            socketConnection.on('disconnect', (reason) => {
                console.log(`[CurrentEnvironment] Disconnected:`, reason);
                setRealTimeStatus(prev => ({ ...prev, connected: false, sensorActive: false }));
                setIsConnecting(false);

                if (sensorTimeoutRef.current) {
                    clearTimeout(sensorTimeoutRef.current);
                    sensorTimeoutRef.current = null;
                }

                if (reason !== 'io client disconnect') {
                    setTimeout(attemptReconnect, 1000);
                }
            });

            socketConnection.on('connect_error', (error) => {
                console.log(`[CurrentEnvironment] Connection error:`, error);
                setRealTimeStatus(prev => ({ ...prev, connected: false, sensorActive: false }));
                setIsConnecting(false);
                setTimeout(attemptReconnect, 2000);
            });

            // ✅ UNIFIED SENSOR HANDLER - Handles all sensor types
            socketConnection.on('sensorUpdate', (data) => {
                console.log('[CurrentEnvironment] sensorUpdate received:', {
                    sensorType: data.sensorType,
                    value: data.value,
                    roomCode: data.roomCode,
                    roomId: data.roomId,
                    location: data.location,
                    timestamp: data.timestamp,
                    expectedLocation: selectedLocation
                });

                // Room filtering with type coercion
                const roomMatches =
                    data.roomCode == selectedLocation ||
                    data.roomId == selectedLocation ||
                    data.location == selectedLocation ||
                    String(data.roomCode) === String(selectedLocation) ||
                    String(data.roomId) === String(selectedLocation);

                if (!roomMatches) {
                    console.log(`[CurrentEnvironment] ❌ Ignoring sensor from room: ${data.roomCode || data.roomId || data.location} (expected: ${selectedLocation})`);
                    return;
                }

                const { sensorType, value } = data;

                // Sensor type mapping
                const sensorTypeMap = {
                    'temperature': 'temperature',
                    'humidity': 'humidity',
                    'bowl_temp': 'bowl_temp',
                    'sonar_distance': 'sonar_distance',
                    'co2_level': 'co2_level',
                    'sugar_level': 'sugar_level',
                    'airflow': 'airflow'
                };

                const fieldName = sensorTypeMap[sensorType];

                if (fieldName && typeof value === 'number') {
                    console.log(`[CurrentEnvironment] ✅ Updating ${fieldName}: ${value} at ${new Date().toISOString()}`);
                    setCurrentData(prev => ({ ...prev, [fieldName]: value }));
                    setSensorTimestamps(prev => ({ ...prev, [fieldName]: new Date() }));
                    updateSensorStatus(fieldName, value);
                    setLastUpdate(new Date());
                } else {
                    console.warn(`[CurrentEnvironment] ⚠️ Invalid sensor data - type: ${sensorType}, value: ${value}, fieldName: ${fieldName}`);
                }
            });

            // ✅ ALSO LISTEN TO environmentUpdate EVENT
            socketConnection.on('environmentUpdate', (data) => {
                console.log('[CurrentEnvironment] environmentUpdate received:', data);

                // Room filtering - environmentUpdate may not have room info, so accept if we have sensor data
                const hasRoomInfo = data.roomCode || data.roomId || data.location;

                if (hasRoomInfo) {
                    const roomMatches =
                        data.roomCode == selectedLocation ||
                        data.roomId == selectedLocation ||
                        data.location == selectedLocation ||
                        String(data.roomCode) === String(selectedLocation) ||
                        String(data.roomId) === String(selectedLocation);

                    if (!roomMatches) {
                        console.log(`[CurrentEnvironment] ❌ Ignoring environmentUpdate from room: ${data.roomCode || data.roomId || data.location}`);
                        return;
                    }
                }
                // If no room info, assume it's for us since we're in the correct room

                // Handle multiple sensor values in one update
                const updates = {};
                if (typeof data.temperature === 'number') updates.temperature = data.temperature;
                if (typeof data.humidity === 'number') updates.humidity = data.humidity;
                if (typeof data.airflow === 'number') updates.airflow = data.airflow;
                if (typeof data.bowl_temp === 'number') updates.bowl_temp = data.bowl_temp;
                if (typeof data.sonar_distance === 'number') updates.sonar_distance = data.sonar_distance;
                if (typeof data.co2_level === 'number') updates.co2_level = data.co2_level;
                if (typeof data.sugar_level === 'number') updates.sugar_level = data.sugar_level;

                if (Object.keys(updates).length > 0) {
                    console.log(`[CurrentEnvironment] ✅ Batch updating sensors:`, updates);
                    setCurrentData(prev => ({ ...prev, ...updates }));

                    // Update timestamps for each sensor
                    const now = new Date();
                    const timestampUpdates = {};
                    Object.keys(updates).forEach(key => {
                        timestampUpdates[key] = now;
                    });
                    setSensorTimestamps(prev => ({ ...prev, ...timestampUpdates }));

                    // Update status for each sensor
                    Object.entries(updates).forEach(([key, value]) => {
                        updateSensorStatus(key, value);
                    });

                    setLastUpdate(now);
                }
            });

            // ✅ UNIFIED ACTUATOR HANDLER - Handles all actuator types
            socketConnection.on('actuatorUpdate', (data) => {
                console.log('[CurrentEnvironment] actuatorUpdate received:', data);

                // Flexible room matching with type coercion
                const roomMatches =
                    data.roomCode == selectedLocation ||
                    data.roomId == selectedLocation ||
                    data.location == selectedLocation ||
                    String(data.roomCode) === String(selectedLocation) ||
                    String(data.roomId) === String(selectedLocation);

                if (!roomMatches) {
                    console.log(`[CurrentEnvironment] ❌ Ignoring actuator from room ${data.roomCode || data.roomId} (expected ${selectedLocation})`);
                    return;
                }

                console.log(`[CurrentEnvironment] ✅ Processing actuator for room ${selectedLocation}`);

                // Actuator type mapping
                const actuatorTypeMap = {
                    'bowl_fan': 'bowlFan',
                    'bowl_fan_status': 'bowlFan',
                    'sonar_pump': 'sonarPump',
                    'sonar_pump_status': 'sonarPump',
                    'co2_fermentation': 'co2Fermentation',
                    'co2_fermentation_status': 'co2Fermentation',
                    'sugar_fermentation': 'sugarFermentation',
                    'sugar_fermentation_status': 'sugarFermentation'
                };

                const stateKey = actuatorTypeMap[data.actuatorType];

                if (stateKey) {
                    setActuatorStatus(prev => ({
                        ...prev,
                        [stateKey]: {
                            statusKey: data.state || data.status,
                            messageKey: getMessageKey(data.actuatorType, data.state || data.status),
                            active: (data.state == 1 || data.numericState == 1),
                            complete: (data.state == 1 || data.numericState == 1) && stateKey === 'sugarFermentation'
                        }
                    }));

                    console.log(`✅ [CurrentEnvironment] Updated ${stateKey}: ${data.state || data.status}`);
                } else {
                    console.warn(`⚠️ Unknown actuator type: ${data.actuatorType}`);
                }
            });

            // Helper function to get message translation key
            function getMessageKey(actuatorType, state) {
                const messages = {
                    'bowl_fan': {
                        'ON': 'Temp High, Fan is ON',
                        'OFF': 'Temp normal, Fan off'
                    },
                    'bowl_fan_status': {
                        'ON': 'Temp High, Fan is ON',
                        'OFF': 'Temp normal, Fan off'
                    },
                    'sonar_pump': {
                        'ON': 'Water level low, Pump is ON',
                        'OFF': 'Water level normal, Pump is Off'
                    },
                    'sonar_pump_status': {
                        'ON': 'Water level low, Pump is ON',
                        'OFF': 'Water level normal, Pump is Off'
                    },
                    'co2_fermentation': {
                        'ACTIVE': 'Fermentation going',
                        'OFF': 'Fermentation is Off'
                    },
                    'co2_fermentation_status': {
                        'COFF': 'Fermentation is Off',
                        'CON': 'Fermentation going'
                    },
                    'sugar_fermentation': {
                        'COMPLETE': 'Fermentation complete',
                        'CLOSED': 'Fermentation closed'
                    },
                    'sugar_fermentation_status': {
                        'FON': 'Fermentation complete',
                        'FOFF': 'Fermentation closed'
                    }
                };

                return messages[actuatorType]?.[state] || `Status: ${state}`;
            }

            // Keep other essential handlers
            socketConnection.on('publishResult', (result) => {
                if (result.topic === 'text') {
                    setTextPublishStatus(result.success
                        ? `Text sent: ${result.message}`
                        : `Text failed: ${result.error}`);
                    setTimeout(() => setTextPublishStatus(''), 1000);
                } else {
                    setPublishStatus(result.success
                        ? `Sent ${result.message}: ${result.command} to ${result.topic}`
                        : `Failed: ${result.error}`);
                    setTimeout(() => setPublishStatus(''), 3000);
                }
            });

            socketConnection.on('textMessageReceived', (data) => {
                console.log('Text message received from MQTT:', data.message);
            });

            socketConnection.on('setpointUpdate', (data) => {
                if (data.location !== selectedLocation || data.userId !== user.id) return;
                console.log('[CurrentEnvironment] setpoint update:', data);

                setSetpoints(prev => ({
                    ...prev,
                    ...(typeof data.desiredTemperature === 'number' && { temperature: data.desiredTemperature }),
                    ...(typeof data.desiredHumidity === 'number' && { humidity: data.desiredHumidity }),
                    ...(typeof data.desiredAirflow === 'number' && { airflow: data.desiredAirflow }),
                    ...(typeof data.desiredBowlTemp === 'number' && { bowl_temp: data.desiredBowlTemp }),
                    ...(typeof data.desiredSonarDistance === 'number' && { sonar_distance: data.desiredSonarDistance }),
                    ...(typeof data.desiredCO2Level === 'number' && { co2_level: data.desiredCO2Level }),
                    ...(typeof data.desiredSugarLevel === 'number' && { sugar_level: data.desiredSugarLevel })
                }));
            });

        } catch (error) {
            console.error('Error setting up socket connection:', error);
            setRealTimeStatus(prev => ({ ...prev, connected: false, sensorActive: false }));
            setIsConnecting(false);
            setTimeout(attemptReconnect, 3000);
        }
    };

    const fetchActuatorStates = async () => {
        if (!user || !selectedLocation) return;

        try {
            const response = await fetch(
                `${API_BASE_URL}/api/actuators/latest?room=${selectedLocation}`,
                { headers: { 'Authorization': `Bearer ${user.token}` } }
            );

            if (response.ok) {
                const data = await response.json();
                console.log('✅ Fetched actuator states:', data);

                if (data.actuators) {
                    const newActuatorStatus = { ...actuatorStatus };

                    data.actuators.forEach(actuator => {
                        const typeMap = {
                            'bowl_fan': 'bowlFan',
                            'sonar_pump': 'sonarPump',
                            'co2_fermentation': 'co2Fermentation',
                            'sugar_fermentation': 'sugarFermentation'
                        };

                        const key = typeMap[actuator.actuator_type];
                        if (key) {
                            newActuatorStatus[key] = {
                                statusKey: actuator.status,
                                messageKey: actuator.message,
                                active: actuator.state === 1,
                                complete: actuator.state === 1 && key === 'sugarFermentation'
                            };
                        }
                    });

                    setActuatorStatus(newActuatorStatus);
                }
            }
        } catch (err) {
            console.error('Error fetching actuator states:', err);
        }
    };

    const fetchLatestEnvironment = async () => {
        if (!selectedLocation || !user) return;

        console.log(`🔵 [CurrentEnvironment] Fetching latest for: ${selectedLocation}`);

        try {
            const response = await fetch(
                `${API_BASE_URL}/api/locations/${encodeURIComponent(selectedLocation)}/latest`,
                { headers: { 'Authorization': `Bearer ${user.token}` } }
            );

            if (response.ok) {
                const data = await response.json();
                console.log(`✅ [CurrentEnvironment] Received data:`, data);

                if (data.status === 'success' && data.measurement) {
                    const measurement = data.measurement;

                    const hasData = Object.values(measurement).some(val =>
                        val !== null && typeof val === 'number'
                    );

                    if (hasData) {
                        console.log(`✅ [CurrentEnvironment] Setting measurement data:`, measurement);

                        setCurrentData({
                            temperature: measurement.temperature,
                            humidity: measurement.humidity,
                            airflow: measurement.airflow,
                            bowl_temp: measurement.bowl_temp,
                            sonar_distance: measurement.sonar_distance,
                            co2_level: measurement.co2_level,
                            sugar_level: measurement.sugar_level
                        });

                        if (measurement.created_at) {
                            const timestamp = new Date(measurement.created_at);
                            setLastUpdate(timestamp);

                            const timeSinceLastMeasurement = Date.now() - timestamp.getTime();

                            if (timeSinceLastMeasurement < 120000) {
                                console.log(`✅ [CurrentEnvironment] Sensors ACTIVE (${Math.round(timeSinceLastMeasurement / 1000)}s ago)`);
                                setRealTimeStatus(prev => ({
                                    ...prev,
                                    sensorActive: true
                                }));
                            } else {
                                console.warn(`⚠️ [CurrentEnvironment] Data is old (${Math.round(timeSinceLastMeasurement / 1000)}s ago)`);
                                setRealTimeStatus(prev => ({
                                    ...prev,
                                    sensorActive: false
                                }));
                            }
                        }
                    }
                }
            }
        } catch (err) {
            console.error('❌ [CurrentEnvironment] Error fetching latest environment:', err);
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
        if (!timestamp) return t('Never');
        return timestamp.toLocaleTimeString();
    };

    const getConnectionStatusText = () => {
        if (realTimeStatus.connected) return `🟢 ${t('Connected to Broker')}`;
        return `🔴 ${t('Disconnected')}`;
    };

    const getConnectionStatusClass = () => {
        if (realTimeStatus.connected) return t('connected');
        return t('disconnected');
    };

    if (loading) {
        return (
            <div className="current-environment">
                <h2>{t('Environment')} - {selectedLocation}</h2>
                <p>{t('Loading...')}</p>
            </div>
        );
    }

    return (
        <div className="space-y-1">
            {/* Connection Status Bar */}
            <div className={`px-3 py-1.5 rounded-md text-xs font-medium flex items-center justify-between ${getConnectionStatusClass() === 'connected'
                ? 'bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800'
                : getConnectionStatusClass() === 'connecting'
                    ? 'bg-yellow-50 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 border border-yellow-200 dark:border-yellow-800'
                    : 'bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800'
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
                        {t('Connecting...')}
                    </span>
                )}
            </div>

            {/* Header */}
            <div className="flex items-center gap-2 pb-2 border-b border-gray-200 dark:border-gray-700">
                <div className="w-7 h-7 bg-linear-to-br from-teal-500 to-blue-500 rounded-md flex items-center justify-center text-white text-sm">
                    🌡️
                </div>
                <h2 className="text-lg font-bold text-gray-800 dark:text-gray-200">{t("Current Environment")}</h2>
            </div>

            {/* Location Info */}
            <div className="flex items-center gap-1.5 text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 px-3 py-2 rounded-md">
                <svg className="w-4 h-4 text-teal-600 dark:text-teal-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                </svg>
                <span className="text-xs">{t('Location:')}</span>
                <strong className="text-xs text-gray-800 dark:text-gray-200">{selectedLocation}</strong>
            </div>

            {/* Last Update */}
            {lastUpdate && (
                <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1.5 px-3">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    {t('Last updated:')} {formatTimestamp(lastUpdate)}
                </div>
            )}

            {realTimeStatus.connected && realTimeStatus.sensorActive ? (
                <div className="space-y-3 pt-1">

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">

                        {/* Temperature Card - ONLY SHOW IF HAS DATA */}
                        {(currentData.temperature !== null && currentData.temperature !== undefined) && (
                            <div className="bg-linear-to-br from-red-50 to-orange-50 dark:from-red-900/30 dark:to-orange-900/30 rounded-md p-2 md:p-2.5 border border-red-100 dark:border-red-800 shadow-sm hover:shadow transition-shadow">
                                <div className="flex items-center justify-between mb-1">
                                    <h3 className="text-10px md:text-xs font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-1">
                                        <span className="text-sm">🌡️</span>
                                        <span className="hidden sm:inline">{t('Temperature')}</span>
                                        <span className="sm:hidden">{t('Temp')}</span>
                                    </h3>
                                    {realTimeStatus.temperature && (
                                        <span className="inline-flex h-1 w-1 md:h-1.5 md:w-1.5 rounded-full bg-red-500 animate-pulse"></span>
                                    )}
                                </div>
                                <div className="text-lg md:text-xl font-bold transition-colors duration-500 ease-out tabular-nums"
                                    style={{ color: getStatusColor(currentData.temperature, setpoints.temperature, 0.5) }}>
                                    {safeToFixed(smoothTemp, 1)}°C
                                </div>
                                <div className="mt-1 flex items-center justify-between">
                                    <span className="text-9px md:text-10px text-gray-500 dark:text-gray-400">{t('Target:')} {setpoints.temperature}°C</span>
                                    {sensorTimestamps.temperature && (
                                        <span className="text-[12px] md:text-9px text-gray-400 dark:text-gray-500 flex items-center gap-0.5">
                                            <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                            </svg>
                                            {formatRelativeTime(sensorTimestamps.temperature)}
                                        </span>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Humidity Card - ONLY SHOW IF HAS DATA */}
                        {(currentData.humidity !== null && currentData.humidity !== undefined) && (
                            <div className="bg-linear-to-br from-blue-50 to-cyan-50 dark:from-blue-900/30 dark:to-cyan-900/30 rounded-md p-2 md:p-2.5 border border-blue-100 dark:border-blue-800 shadow-sm hover:shadow transition-shadow">
                                <div className="flex items-center justify-between mb-1">
                                    <h3 className="text-10px md:text-xs font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-1">
                                        <span className="text-sm">💧</span>
                                        <span className="hidden sm:inline">{t('Humidity')}</span>
                                        <span className="sm:hidden">{t('Humid')}</span>
                                    </h3>
                                    {realTimeStatus.humidity && (
                                        <span className="inline-flex h-1 w-1 md:h-1.5 md:w-1.5 rounded-full bg-blue-500 animate-pulse"></span>
                                    )}
                                </div>
                                <div className="text-lg md:text-xl font-bold transition-colors duration-500 ease-out tabular-nums"
                                    style={{ color: getStatusColor(currentData.humidity, setpoints.humidity, 2.0) }}>
                                    {safeToFixed(smoothHumidity, 1)}%
                                </div>
                                <div className="mt-1 flex items-center justify-between">
                                    <span className="text-9px md:text-10px text-gray-500 dark:text-gray-400">{t('Target:')} {setpoints.humidity}%</span>
                                    {sensorTimestamps.humidity && (
                                        <span className="text-[12px] md:text-9px text-gray-400 dark:text-gray-500 flex items-center gap-0.5">
                                            <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                            </svg>
                                            {formatRelativeTime(sensorTimestamps.humidity)}
                                        </span>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Bowl Temperature Card - ONLY SHOW IF HAS DATA */}
                        {(currentData.bowl_temp !== null && currentData.bowl_temp !== undefined) && (
                            <div className="bg-linear-to-br from-amber-50 to-yellow-50 dark:from-amber-900/30 dark:to-yellow-900/30 rounded-md p-2 md:p-2.5 border border-amber-100 dark:border-amber-800 shadow-sm hover:shadow transition-shadow">
                                <div className="flex items-center justify-between mb-1">
                                    <h3 className="text-10px md:text-xs font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-1">
                                        <span className="text-sm">🔥</span>
                                        <span className="hidden sm:inline">{t('Bowl Temperature')}</span>
                                        <span className="sm:hidden">{t('Bowl')}</span>
                                    </h3>
                                    {realTimeStatus.bowl_temp && (
                                        <span className="inline-flex h-1 w-1 md:h-1.5 md:w-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                                    )}
                                </div>
                                <div className="text-lg md:text-xl font-bold transition-colors duration-500 ease-out tabular-nums"
                                    style={{ color: getStatusColor(currentData.bowl_temp, setpoints.bowl_temp, 3) }}>
                                    {safeToFixed(smoothBowlTemp, 1)}°C
                                </div>
                                <div className="mt-1 flex items-center justify-between">
                                    <span className="text-9px md:text-10px text-gray-500">{t('Target:')} {setpoints.bowl_temp}°C</span>
                                    {sensorTimestamps.bowl_temp && (
                                        <span className="text-[12px] md:text-9px text-gray-400 flex items-center gap-0.5">
                                            <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                            </svg>
                                            {formatRelativeTime(sensorTimestamps.bowl_temp)}
                                        </span>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Sonar/Liquid Level Card - ONLY SHOW IF HAS DATA */}
                        {(currentData.sonar_distance !== null && currentData.sonar_distance !== undefined) && (
                            <div className="bg-linear-to-br from-purple-50 to-pink-50 rounded-md p-2 md:p-2.5 border border-purple-100 shadow-sm hover:shadow transition-shadow">
                                <div className="flex items-center justify-between mb-1">
                                    <h3 className="text-10px md:text-xs font-semibold text-gray-700 flex items-center gap-1">
                                        <span className="text-sm">📏</span>
                                        <span className="hidden sm:inline">{t('Water Level')}</span>
                                        <span className="sm:hidden">{t('Liquid')}</span>
                                    </h3>
                                    {realTimeStatus.sonar_distance && (
                                        <span className="inline-flex h-1 w-1 md:h-1.5 md:w-1.5 rounded-full bg-purple-500 animate-pulse"></span>
                                    )}
                                </div>
                                <div className="text-lg md:text-xl font-bold transition-colors duration-500 ease-out tabular-nums"
                                    style={{ color: getStatusColor(currentData.sonar_distance, setpoints.sonar_distance, 5) }}>
                                    {safeToFixed(smoothSonarDistance, 1)} cm
                                </div>
                                <div className="mt-1 flex items-center justify-between">
                                    <span className="text-9px md:text-10px text-gray-500">{t('Target:')} {setpoints.sonar_distance} cm</span>
                                    {sensorTimestamps.sonar_distance && (
                                        <span className="text-[12px] md:text-9px text-gray-400 flex items-center gap-0.5">
                                            <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                            </svg>
                                            {formatRelativeTime(sensorTimestamps.sonar_distance)}
                                        </span>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* CO2 Level Card - ONLY SHOW IF HAS DATA */}
                        {(currentData.co2_level !== null && currentData.co2_level !== undefined) && (
                            <div className="bg-linear-to-br from-green-50 to-teal-50 rounded-md p-2 md:p-2.5 border border-green-100 shadow-sm hover:shadow transition-shadow">
                                <div className="flex items-center justify-between mb-1">
                                    <h3 className="text-10px md:text-xs font-semibold text-gray-700 flex items-center gap-1">
                                        <span className="text-sm">💨</span>
                                        <span className="hidden sm:inline">{t('CO2 Level')}</span>
                                        <span className="sm:hidden">{t('CO2')}</span>
                                    </h3>
                                    {realTimeStatus.co2_level && (
                                        <span className="inline-flex h-1 w-1 md:h-1.5 md:w-1.5 rounded-full bg-green-500 animate-pulse"></span>
                                    )}
                                </div>
                                <div className="text-lg md:text-xl font-bold transition-colors duration-500 ease-out tabular-nums"
                                    style={{ color: getStatusColor(currentData.co2_level, setpoints.co2_level, 50) }}>
                                    {safeToFixed(smoothCO2, 2)} ppm
                                </div>
                                <div className="mt-1 flex items-center justify-between">
                                    <span className="text-9px md:text-10px text-gray-500">{t('Target:')} {setpoints.co2_level} ppm</span>
                                    {sensorTimestamps.co2_level && (
                                        <span className="text-[12px] md:text-9px text-gray-400 flex items-center gap-0.5">
                                            <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                            </svg>
                                            {formatRelativeTime(sensorTimestamps.co2_level)}
                                        </span>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Sugar Level Card - ONLY SHOW IF HAS DATA */}
                        {(currentData.sugar_level !== null && currentData.sugar_level !== undefined) && (
                            <div className="bg-linear-to-br from-pink-50 to-rose-50 rounded-md p-2 md:p-2.5 border border-pink-100 shadow-sm hover:shadow transition-shadow">
                                <div className="flex items-center justify-between mb-1">
                                    <h3 className="text-10px md:text-xs font-semibold text-gray-700 flex items-center gap-1">
                                        <span className="text-sm">🍬</span>
                                        <span className="hidden sm:inline">{t('Sugar Level')}</span>
                                        <span className="sm:hidden">{t('Sugar')}</span>
                                    </h3>
                                    {realTimeStatus.sugar_level && (
                                        <span className="inline-flex h-1 w-1 md:h-1.5 md:w-1.5 rounded-full bg-pink-500 animate-pulse"></span>
                                    )}
                                </div>
                                <div className="text-lg md:text-xl font-bold transition-colors duration-500 ease-out tabular-nums"
                                    style={{ color: getStatusColor(currentData.sugar_level, setpoints.sugar_level, 5) }}>
                                    {safeToFixed(smoothSugar, 1)} g/L
                                </div>
                                <div className="mt-1 flex items-center justify-between">
                                    <span className="text-9px md:text-10px text-gray-500">{t('Target:')} {setpoints.sugar_level} g/L</span>
                                    {sensorTimestamps.sugar_level && (
                                        <span className="text-[12px] md:text-9px text-gray-400 flex items-center gap-0.5">
                                            <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                            </svg>
                                            {formatRelativeTime(sensorTimestamps.sugar_level)}
                                        </span>
                                    )}
                                </div>
                            </div>
                        )}



                    </div>

                    {/* Status Badges Section - Only CO2 & Sugar 1x2 Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2">



                    </div>
                </div>

            ) : (
                /* Connection Message */
                <div className="bg-linear-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900 rounded-lg p-5 text-center border border-gray-200 dark:border-gray-700">
                    <div className="inline-flex items-center justify-center w-12 h-12 bg-white dark:bg-gray-700 rounded-full shadow-md mb-3">
                        <svg className="w-6 h-6 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                    </div>

                    <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-1.5">
                        {t('Sensor Connection Required')} 📡
                    </h3>

                    <p className="text-xs text-gray-600 dark:text-gray-400 mb-4">
                        {realTimeStatus.connected
                            ? t('Connected to server. Waiting for sensor data...')
                            : isConnecting
                                ? t('Connecting to server...')
                                : t('Please check your connection and ensure sensors are active.')
                        }
                    </p>

                    {/* Connection Activity Indicators */}
                    <div className="space-y-2 bg-white dark:bg-gray-800 rounded-md p-3 shadow-sm">
                        <div className="flex items-center justify-between">
                            <span className="text-xs text-gray-600 dark:text-gray-400">{t('Broker Status')}</span>
                            <div className="flex items-center gap-1.5">
                                <span className={`inline-block w-1.5 h-1.5 rounded-full ${realTimeStatus.connected ? 'bg-green-500 animate-pulse' : 'bg-gray-300 dark:bg-gray-600'
                                    }`}></span>
                                <span className={`text-xs font-medium ${realTimeStatus.connected ? 'text-green-600 dark:text-green-400' : 'text-gray-500 dark:text-gray-400'
                                    }`}>
                                    {realTimeStatus.connected ? t('Connected') : t('Disconnected')}
                                </span>
                            </div>
                        </div>

                        <div className="h-px bg-gray-200 dark:bg-gray-700"></div>

                        <div className="flex items-center justify-between">
                            <span className="text-xs text-gray-600 dark:text-gray-400">{t('Sensor Status')}</span>
                            <div className="flex items-center gap-1.5">
                                <span className={`inline-block w-1.5 h-1.5 rounded-full ${realTimeStatus.sensorActive ? 'bg-green-500 animate-pulse' : 'bg-gray-300 dark:bg-gray-600'
                                    }`}></span>
                                <span className={`text-xs font-medium ${realTimeStatus.sensorActive ? 'text-green-600 dark:text-green-400' : 'text-gray-500 dark:text-gray-400'
                                    }`}>
                                    {realTimeStatus.sensorActive ? t('Active') : t('Inactive')}
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
