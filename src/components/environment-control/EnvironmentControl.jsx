"use client";
import React, { useState, useEffect, useContext, useRef } from 'react';
import { FaThermometerHalf, FaTint, FaWind, FaCog } from 'react-icons/fa';
import { createSocket } from '../../lib/socket';
import AuthContext from '../../context/AuthContext';
import API_BASE_URL from '../../config/api.js';

const EnvironmentControl = ({ selectedLocation }) => {
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
        temperature: 25.0,
        humidity: 25.0,
        airflow: 2.0
    });

    const [inputs, setInputs] = useState({
        temperature: '25.0',
        humidity: '25.0',
        airflow: '2.0'
    });

    const [controlState, setControlState] = useState({
        heaterState: false,
        coolerState: false,
        humidifierState: false,
        dehumidifierState: false,
        fanLevel: 0,
        controlMode: 'auto'
    });

    // Temperature Knob State
    const [tempKnobValue, setTempKnobValue] = useState(25);
    const [tempIsDragging, setTempIsDragging] = useState(false);
    const [tempIsHovering, setTempIsHovering] = useState(false);
    const [tempPublishStatus, setTempPublishStatus] = useState('');

    // Humidity Knob State
    const [humidityKnobValue, setHumidityKnobValue] = useState(25);
    const [humidityIsDragging, setHumidityIsDragging] = useState(false);
    const [humidityIsHovering, setHumidityIsHovering] = useState(false);
    const [humidityPublishStatus, setHumidityPublishStatus] = useState('');
    const [isConnecting, setIsConnecting] = useState(false);

    // Temperature Knob Configuration
    const TEMP_MIN_VALUE = 25;
    const TEMP_MAX_VALUE = 40;
    const TEMP_TOTAL_ANGLE = 270;
    const TEMP_START_ANGLE = -135;

    // Humidity Knob Configuration
    const HUMIDITY_MIN_VALUE = 25;
    const HUMIDITY_MAX_VALUE = 40;
    const HUMIDITY_TOTAL_ANGLE = 270;
    const HUMIDITY_START_ANGLE = -135;

    // Refs for knob interaction
    const tempKnobRef = useRef(null);
    const tempStartAngleRef = useRef(0);
    const tempStartValueRef = useRef(25);

    const humidityKnobRef = useRef(null);
    const humidityStartAngleRef = useRef(0);
    const humidityStartValueRef = useRef(25);

    // Enhanced connection state management
    const [realTimeStatus, setRealTimeStatus] = useState({
        temperature: false,
        humidity: false,
        airflow: false,
        connected: false,
        sensorActive: false
    });

    const [socket, setSocket] = useState(null);
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState('');

    // Refs for reconnection logic and sensor timeout
    const reconnectTimeoutRef = useRef(null);
    const reconnectAttemptsRef = useRef(0);
    const sensorTimeoutRef = useRef(null);
    const maxReconnectAttempts = 10;
    const baseReconnectDelay = 1000;

    // Conditional display values - Show N/A when sensor is disconnected
    const displayedTemperature = realTimeStatus.sensorActive ? safeToFixed(currentData.temperature, 1) : 'N/A';
    const displayedHumidity = realTimeStatus.sensorActive ? safeToFixed(currentData.humidity, 1) : 'N/A';
    const displayedAirflow = realTimeStatus.sensorActive ? safeToFixed(currentData.airflow, 2) : 'N/A';

    // Set sensor timeout
    const setSensorTimeout = () => {
        if (sensorTimeoutRef.current) {
            clearTimeout(sensorTimeoutRef.current);
        }
        sensorTimeoutRef.current = setTimeout(() => {
            console.log('🔴 EnvironmentControl sensor timeout - no data for 5 seconds');
            setRealTimeStatus(prev => ({ ...prev, sensorActive: false }));
        }, 5000);
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
    };

    // Fetch latest environment data to check initial sensor status
    const fetchLatestEnvironment = async () => {
        if (!selectedLocation || !user) return;

        try {
            const response = await fetch(
                `${API_BASE_URL}/api/locations/${encodeURIComponent(selectedLocation)}/latest`,
                { headers: { 'Authorization': `Bearer ${user.token}` } }
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

                    // If data is recent (less than 2 minutes), mark sensor as active
                    if (timeSinceLastMeasurement < 120000) { // 2 minutes
                        setRealTimeStatus(prev => ({ ...prev, sensorActive: true }));
                        setSensorTimeout();
                    }
                }
            }
        } catch (err) {
            console.error('Error fetching latest environment:', err);
        }
    };

    // SINGLE effect to handle location changes and socket management
    useEffect(() => {
        console.log(`🔄 Location changed to: ${selectedLocation}`);

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

        // Small delay to ensure cleanup is complete, then setup new connection
        const setupTimer = setTimeout(() => {
            fetchLatestEnvironment();
            fetchCurrentSetpoint();
            fetchControlState();
            setupRealtimeUpdates();
        }, 100);

        return () => {
            clearTimeout(setupTimer);
            cleanup();
        };
    }, [user?.id, selectedLocation]); // Include user.id to ensure proper re-initialization

    // Sync knob values with setpoints
    useEffect(() => {
        setTempKnobValue(Math.max(TEMP_MIN_VALUE, Math.min(TEMP_MAX_VALUE, Math.round(setpoints.temperature))));
        setHumidityKnobValue(Math.max(HUMIDITY_MIN_VALUE, Math.min(HUMIDITY_MAX_VALUE, Math.round(setpoints.humidity))));
    }, [setpoints.temperature, setpoints.humidity]);

    // Temperature Knob Functions
    const getAngleFromCenter = (centerX, centerY, clientX, clientY) => {
        const deltaX = clientX - centerX;
        const deltaY = clientY - centerY;
        let angle = Math.atan2(deltaY, deltaX) * (180 / Math.PI);
        angle = (angle + 360) % 360;
        return angle;
    };

    const tempValueToAngle = (value) => {
        const percentage = (value - TEMP_MIN_VALUE) / (TEMP_MAX_VALUE - TEMP_MIN_VALUE);
        return TEMP_START_ANGLE + (percentage * TEMP_TOTAL_ANGLE);
    };

    const humidityValueToAngle = (value) => {
        const percentage = (value - HUMIDITY_MIN_VALUE) / (HUMIDITY_MAX_VALUE - HUMIDITY_MIN_VALUE);
        return HUMIDITY_START_ANGLE + (percentage * HUMIDITY_TOTAL_ANGLE);
    };

    // Temperature Knob Event Handlers
    const handleTempMouseDown = (e) => {
        if (!realTimeStatus.connected || !realTimeStatus.sensorActive || !tempKnobRef.current) return;

        setTempIsDragging(true);
        const rect = tempKnobRef.current.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;

        tempStartAngleRef.current = getAngleFromCenter(centerX, centerY, e.clientX, e.clientY);
        tempStartValueRef.current = tempKnobValue;

        e.preventDefault();
    };

    const handleTempMouseMove = (e) => {
        if (!tempIsDragging || !tempKnobRef.current) return;

        const rect = tempKnobRef.current.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;

        const currentAngle = getAngleFromCenter(centerX, centerY, e.clientX, e.clientY);
        let angleDelta = currentAngle - tempStartAngleRef.current;

        if (angleDelta > 180) angleDelta -= 360;
        if (angleDelta < -180) angleDelta += 360;

        const sensitivity = 0.03;
        const valueDelta = Math.round((angleDelta * sensitivity));
        const newValue = Math.max(TEMP_MIN_VALUE, Math.min(TEMP_MAX_VALUE, tempStartValueRef.current + valueDelta));

        if (newValue !== tempKnobValue) {
            setTempKnobValue(newValue);
            updateTemperatureSetpoint(newValue);
        }
    };

    const handleTempMouseUp = () => {
        setTempIsDragging(false);
    };

    const handleTempWheel = (e) => {
        if (!realTimeStatus.connected || !realTimeStatus.sensorActive) return;
        e.preventDefault();

        const delta = e.deltaY > 0 ? -1 : 1;
        const newValue = Math.max(TEMP_MIN_VALUE, Math.min(TEMP_MAX_VALUE, tempKnobValue + delta));

        if (newValue !== tempKnobValue) {
            setTempKnobValue(newValue);
            updateTemperatureSetpoint(newValue);
        }
    };

    const handleTempValueChange = (e) => {
        if (!realTimeStatus.connected || !realTimeStatus.sensorActive) return;

        const value = parseInt(e.target.value);
        if (!isNaN(value) && value >= TEMP_MIN_VALUE && value <= TEMP_MAX_VALUE) {
            setTempKnobValue(value);
            updateTemperatureSetpoint(value);
        }
    };

    // Humidity Knob Event Handlers
    const handleHumidityMouseDown = (e) => {
        if (!realTimeStatus.connected || !realTimeStatus.sensorActive || !humidityKnobRef.current) return;

        setHumidityIsDragging(true);
        const rect = humidityKnobRef.current.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;

        humidityStartAngleRef.current = getAngleFromCenter(centerX, centerY, e.clientX, e.clientY);
        humidityStartValueRef.current = humidityKnobValue;

        e.preventDefault();
    };

    const handleHumidityMouseMove = (e) => {
        if (!humidityIsDragging || !humidityKnobRef.current) return;

        const rect = humidityKnobRef.current.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;

        const currentAngle = getAngleFromCenter(centerX, centerY, e.clientX, e.clientY);
        let angleDelta = currentAngle - humidityStartAngleRef.current;

        if (angleDelta > 180) angleDelta -= 360;
        if (angleDelta < -180) angleDelta += 360;

        const sensitivity = 0.1; // Less sensitive for humidity
        const valueDelta = Math.round((angleDelta * sensitivity));
        const newValue = Math.max(HUMIDITY_MIN_VALUE, Math.min(HUMIDITY_MAX_VALUE, humidityStartValueRef.current + valueDelta));

        if (newValue !== humidityKnobValue) {
            setHumidityKnobValue(newValue);
            updateHumiditySetpoint(newValue);
        }
    };

    const handleHumidityMouseUp = () => {
        setHumidityIsDragging(false);
    };

    const handleHumidityWheel = (e) => {
        if (!realTimeStatus.connected || !realTimeStatus.sensorActive) return;
        e.preventDefault();

        const delta = e.deltaY > 0 ? -1 : 1;
        const newValue = Math.max(HUMIDITY_MIN_VALUE, Math.min(HUMIDITY_MAX_VALUE, humidityKnobValue + delta));

        if (newValue !== humidityKnobValue) {
            setHumidityKnobValue(newValue);
            updateHumiditySetpoint(newValue);
        }
    };

    const handleHumidityValueChange = (e) => {
        if (!realTimeStatus.connected || !realTimeStatus.sensorActive) return;

        const value = parseInt(e.target.value);
        if (!isNaN(value) && value >= HUMIDITY_MIN_VALUE && value <= HUMIDITY_MAX_VALUE) {
            setHumidityKnobValue(value);
            updateHumiditySetpoint(value);
        }
    };

    // Mouse event listeners for temperature knob
    useEffect(() => {
        if (tempIsDragging) {
            const handleMouseMove = (e) => handleTempMouseMove(e);
            const handleMouseUp = () => handleTempMouseUp();

            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);

            return () => {
                document.removeEventListener('mousemove', handleMouseMove);
                document.removeEventListener('mouseup', handleMouseUp);
            };
        }
    }, [tempIsDragging, tempKnobValue, TEMP_MIN_VALUE, TEMP_MAX_VALUE]);

    // Mouse event listeners for humidity knob
    useEffect(() => {
        if (humidityIsDragging) {
            const handleMouseMove = (e) => handleHumidityMouseMove(e);
            const handleMouseUp = () => handleHumidityMouseUp();

            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);

            return () => {
                document.removeEventListener('mousemove', handleMouseMove);
                document.removeEventListener('mouseup', handleMouseUp);
            };
        }
    }, [humidityIsDragging, humidityKnobValue, HUMIDITY_MIN_VALUE, HUMIDITY_MAX_VALUE]);

    // Generate tick marks for temperature
    const generateTempTicks = () => {
        const ticks = [];
        const totalTicks = (TEMP_MAX_VALUE - TEMP_MIN_VALUE) + 1;

        for (let i = 0; i < totalTicks; i++) {
            const value = TEMP_MIN_VALUE + i;
            const angle = tempValueToAngle(value);
            const isMain = value % 5 === 0;
            const isCurrent = value === tempKnobValue;

            ticks.push(
                <div
                    key={value}
                    className={`tick-small ${isMain ? 'main' : 'minor'} ${isCurrent ? 'current' : ''}`}
                    style={{
                        transform: `rotate(${angle}deg)`
                    }}
                >
                    {isMain && (
                        <span className="tick-label-small">{value}</span>
                    )}
                </div>
            );
        }
        return ticks;
    };

    // Generate tick marks for humidity
    const generateHumidityTicks = () => {
        const ticks = [];
        const totalTicks = (HUMIDITY_MAX_VALUE - HUMIDITY_MIN_VALUE) + 1;

        for (let i = 0; i < totalTicks; i++) {
            const value = HUMIDITY_MIN_VALUE + i;
            const angle = humidityValueToAngle(value);
            const isMain = value % 5 === 0;
            const isCurrent = value === humidityKnobValue;

            ticks.push(
                <div
                    key={value}
                    className={`tick-small ${isMain ? 'main' : 'minor'} ${isCurrent ? 'current' : ''}`}
                    style={{
                        transform: `rotate(${angle}deg)`
                    }}
                >
                    {isMain && (
                        <span className="tick-label-small">{value}</span>
                    )}
                </div>
            );
        }
        return ticks;
    };

    const attemptReconnect = () => {
        if (reconnectAttemptsRef.current >= maxReconnectAttempts) {
            console.log('❌ Max reconnection attempts reached');
            setRealTimeStatus(prev => ({ ...prev, connected: false, sensorActive: false }));
            return;
        }

        const delay = Math.min(baseReconnectDelay * Math.pow(2, reconnectAttemptsRef.current), 30000);
        console.log(`🔄 Reconnection attempt ${reconnectAttemptsRef.current + 1} in ${delay}ms`);

        reconnectTimeoutRef.current = setTimeout(() => {
            reconnectAttemptsRef.current++;
            setupRealtimeUpdates();
        }, delay);
    };

    const setupRealtimeUpdates = () => {
        if (isConnecting || !selectedLocation || !user) return;

        console.log(`🔄 Setting up socket connection for location: ${selectedLocation}`);
        setIsConnecting(true);

        try {
            const socketConnection = createSocket(user.token);
            setSocket(socketConnection);

            // Connection events
            socketConnection.on('connect', () => {
                console.log('🟢 EnvironmentControl connected to real-time updates');
                reconnectAttemptsRef.current = 0;
                setRealTimeStatus(prev => ({ ...prev, connected: true }));
                setIsConnecting(false);

                // IMMEDIATELY join the location upon connection
                socketConnection.emit('joinLocation', selectedLocation);
                console.log(`🔄 Joined location: ${selectedLocation}`);
            });

            socketConnection.on('disconnect', (reason) => {
                console.log('🔴 EnvironmentControl disconnected:', reason);
                setRealTimeStatus(prev => ({ ...prev, connected: false, sensorActive: false }));
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
                console.log('❌ EnvironmentControl connection error:', error);
                setRealTimeStatus(prev => ({ ...prev, connected: false, sensorActive: false }));
                setIsConnecting(false);
                setTimeout(() => attemptReconnect(), 2000);
            });

            // Handle MQTT publish results for temperature
            socketConnection.on('publishResult', (result) => {
                if (result.topic === 'text') {
                    if (result.success) {
                        // Determine if it's temperature or humidity based on value range
                        const value = parseInt(result.message);
                        if (value >= TEMP_MIN_VALUE && value <= TEMP_MAX_VALUE) {
                            setTempPublishStatus(`✅ Temperature set: ${result.message}°C`);
                            setMessage(`Temperature setpoint updated to ${result.message}°C`);
                        } else if (value >= HUMIDITY_MIN_VALUE && value <= HUMIDITY_MAX_VALUE) {
                            setHumidityPublishStatus(`✅ Humidity set: ${result.message}%`);
                            setMessage(`Humidity setpoint updated to ${result.message}%`);
                        }
                    } else {
                        setTempPublishStatus(`❌ Failed: ${result.error}`);
                        setHumidityPublishStatus(`❌ Failed: ${result.error}`);
                        setMessage(`Failed to update setpoint`);
                    }
                    setTimeout(() => {
                        setTempPublishStatus('');
                        setHumidityPublishStatus('');
                        setMessage('');
                    }, 3000);
                }
            });

            // Real-time environment updates with instant sensor detection
            socketConnection.on('environmentUpdate', (data) => {
                if (data.location === selectedLocation && data.userId === user.id) {
                    console.log('🌡️ EnvironmentControl real-time data received:', data);

                    // IMMEDIATE sensor activation - REAL-TIME DETECTION
                    setRealTimeStatus(prev => ({ ...prev, sensorActive: true }));
                    setSensorTimeout(); // Reset timeout on every data reception

                    setCurrentData({
                        temperature: typeof data.temperature === 'number' ? data.temperature : null,
                        humidity: typeof data.humidity === 'number' ? data.humidity : null,
                        airflow: typeof data.airflow === 'number' ? data.airflow : null
                    });

                    // Visual feedback for updates
                    if (typeof data.temperature === 'number') {
                        setRealTimeStatus(prev => ({ ...prev, temperature: true }));
                        setTimeout(() => setRealTimeStatus(prev => ({ ...prev, temperature: false })), 1000);
                    }

                    if (typeof data.humidity === 'number') {
                        setRealTimeStatus(prev => ({ ...prev, humidity: true }));
                        setTimeout(() => setRealTimeStatus(prev => ({ ...prev, humidity: false })), 1000);
                    }

                    if (typeof data.airflow === 'number') {
                        setRealTimeStatus(prev => ({ ...prev, airflow: true }));
                        setTimeout(() => setRealTimeStatus(prev => ({ ...prev, airflow: false })), 1000);
                    }

                    // Update setpoints if provided
                    if (typeof data.desiredTemperature === 'number') {
                        setSetpoints(prev => ({ ...prev, temperature: data.desiredTemperature }));
                        setInputs(prev => ({ ...prev, temperature: data.desiredTemperature.toString() }));
                    }
                    if (typeof data.desiredHumidity === 'number') {
                        setSetpoints(prev => ({ ...prev, humidity: data.desiredHumidity }));
                        setInputs(prev => ({ ...prev, humidity: data.desiredHumidity.toString() }));
                    }
                    if (typeof data.desiredAirflow === 'number') {
                        setSetpoints(prev => ({ ...prev, airflow: data.desiredAirflow }));
                        setInputs(prev => ({ ...prev, airflow: data.desiredAirflow.toString() }));
                    }
                }
            });

            socketConnection.on('environmentControlUpdate', (data) => {
                if (data.location === selectedLocation && data.userId === user.id) {
                    console.log('🎛️ Real-time control update received:', data);

                    // Mark sensor as active when control updates are received - REAL-TIME
                    setRealTimeStatus(prev => ({ ...prev, sensorActive: true }));
                    setSensorTimeout(); // Reset timeout

                    setControlState({
                        heaterState: data.heaterState || false,
                        coolerState: data.coolerState || false,
                        humidifierState: data.humidifierState || false,
                        dehumidifierState: data.dehumidifierState || false,
                        fanLevel: data.fanLevel || 0,
                        controlMode: 'auto'
                    });
                }
            });

            socketConnection.on('setpointUpdate', (data) => {
                if (data.location === selectedLocation && data.userId === user.id) {
                    console.log('🎯 Real-time setpoint update received:', data);

                    if (typeof data.desiredTemperature === 'number') {
                        setSetpoints(prev => ({ ...prev, temperature: data.desiredTemperature }));
                        setInputs(prev => ({ ...prev, temperature: data.desiredTemperature.toString() }));
                    }
                    if (typeof data.desiredHumidity === 'number') {
                        setSetpoints(prev => ({ ...prev, humidity: data.desiredHumidity }));
                        setInputs(prev => ({ ...prev, humidity: data.desiredHumidity.toString() }));
                    }
                    if (typeof data.desiredAirflow === 'number') {
                        setSetpoints(prev => ({ ...prev, airflow: data.desiredAirflow }));
                        setInputs(prev => ({ ...prev, airflow: data.desiredAirflow.toString() }));
                    }
                }
            });

        } catch (error) {
            console.error('❌ Error setting up socket connection:', error);
            setRealTimeStatus(prev => ({ ...prev, connected: false, sensorActive: false }));
            setIsConnecting(false);
            setTimeout(() => attemptReconnect(), 3000);
        }
    };

    // Original functions for fetching data
    const fetchCurrentSetpoint = async () => {
        if (!user) return;

        try {
            const response = await fetch(`${API_BASE_URL}/api/temperature/setpoint`, {
                headers: { 'Authorization': `Bearer ${user.token}` }
            });

            if (response.ok) {
                const data = await response.json();
                if (data.status === 'success' && data.data) {
                    const newSetpoints = {
                        temperature: data.data.desiredTemperature || 25.0,
                        humidity: data.data.desiredHumidity || 25.0,
                        airflow: data.data.desiredAirflow || 2.0
                    };
                    setSetpoints(newSetpoints);
                    setInputs({
                        temperature: newSetpoints.temperature.toString(),
                        humidity: newSetpoints.humidity.toString(),
                        airflow: newSetpoints.airflow.toString()
                    });
                }
            }
        } catch (err) {
            console.error('Error fetching setpoint:', err);
        }
    };

    const fetchControlState = async () => {
        if (!user || !selectedLocation) return;

        try {
            const response = await fetch(
                `${API_BASE_URL}/api/locations/${encodeURIComponent(selectedLocation)}/control`,
                { headers: { 'Authorization': `Bearer ${user.token}` } }
            );

            if (response.ok) {
                const data = await response.json();
                if (data.status === 'success' && data.controlState) {
                    const cs = data.controlState;
                    setControlState({
                        heaterState: cs.heaterState || false,
                        coolerState: cs.coolerState || false,
                        humidifierState: cs.humidifierState || false,
                        dehumidifierState: cs.dehumidifierState || false,
                        fanLevel: cs.fanLevel || 0,
                        controlMode: cs.controlMode || 'auto'
                    });
                }
            }
        } catch (err) {
            console.error('Error fetching control state:', err);
        }
    };

    // Updated function to send temperature via MQTT
    const updateTemperatureSetpoint = async (value) => {
        if (!socket || !realTimeStatus.connected) {
            setTempPublishStatus('❌ Not connected to server');
            setTimeout(() => setTempPublishStatus(''), 3000);
            return;
        }

        if (!realTimeStatus.sensorActive) {
            setTempPublishStatus('❌ Sensors not active');
            setTimeout(() => setTempPublishStatus(''), 3000);
            return;
        }

        setLoading(true);
        setTempPublishStatus(`📤 Setting temperature: ${value}°C`);

        // Send via MQTT
        socket.emit('publishTextToMQTT', {
            topic: 'text',
            message: value.toString(),
            userId: user.id,
            location: selectedLocation
        });

        // Also update via API
        try {
            const response = await fetch(`${API_BASE_URL}/api/temperature/setpoint`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${user.token}`
                },
                body: JSON.stringify({
                    targetTemperature: value,
                    targetHumidity: setpoints.humidity,
                    targetAirflow: setpoints.airflow
                })
            });

            const data = await response.json();
            if (data.status === 'success') {
                setSetpoints(prev => ({ ...prev, temperature: value }));
            }
        } catch (error) {
            console.error('Error updating temperature setpoint:', error);
        } finally {
            setLoading(false);
        }
    };

    // Function to send humidity via MQTT
    const updateHumiditySetpoint = async (value) => {
        if (!socket || !realTimeStatus.connected) {
            setHumidityPublishStatus('❌ Not connected to server');
            setTimeout(() => setHumidityPublishStatus(''), 3000);
            return;
        }

        if (!realTimeStatus.sensorActive) {
            setHumidityPublishStatus('❌ Sensors not active');
            setTimeout(() => setHumidityPublishStatus(''), 3000);
            return;
        }

        setLoading(true);
        setHumidityPublishStatus(`📤 Setting humidity: ${value}%`);

        // Send via MQTT
        socket.emit('publishTextToMQTT', {
            topic: 'text',
            message: value.toString(),
            userId: user.id,
            location: selectedLocation
        });

        // Also update via API
        try {
            const response = await fetch(`${API_BASE_URL}/api/temperature/setpoint`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${user.token}`
                },
                body: JSON.stringify({
                    targetTemperature: setpoints.temperature,
                    targetHumidity: value,
                    targetAirflow: setpoints.airflow
                })
            });

            const data = await response.json();
            if (data.status === 'success') {
                setSetpoints(prev => ({ ...prev, humidity: value }));
            }
        } catch (error) {
            console.error('Error updating humidity setpoint:', error);
        } finally {
            setLoading(false);
        }
    };

    const updateSetpoint = async (type, value) => {
        const numValue = parseFloat(value);

        // Validation
        let isValid = false;
        let errorMsg = '';

        switch (type) {
            case 'temperature':
                isValid = !isNaN(numValue) && numValue >= -10 && numValue <= 50;
                errorMsg = 'Temperature must be between -10°C and 50°C';
                break;
            case 'humidity':
                isValid = !isNaN(numValue) && numValue >= 0 && numValue <= 100;
                errorMsg = 'Humidity must be between 0% and 100%';
                break;
            case 'airflow':
                isValid = !isNaN(numValue) && numValue >= 0 && numValue <= 10;
                errorMsg = 'Airflow must be between 0 and 10 m/s';
                break;
        }

        if (!isValid) {
            setMessage(errorMsg);
            setTimeout(() => setMessage(''), 3000);
            return;
        }

        setLoading(true);

        try {
            const response = await fetch(`${API_BASE_URL}/api/temperature/setpoint`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${user.token}`
                },
                body: JSON.stringify({
                    targetTemperature: type === 'temperature' ? numValue : setpoints.temperature,
                    targetHumidity: type === 'humidity' ? numValue : setpoints.humidity,
                    targetAirflow: type === 'airflow' ? numValue : setpoints.airflow
                })
            });

            const data = await response.json();
            if (data.status === 'success') {
                setSetpoints(prev => ({ ...prev, [type]: numValue }));
                setMessage(`${type.charAt(0).toUpperCase() + type.slice(1)} setpoint updated successfully!`);
                setTimeout(() => setMessage(''), 3000);
            } else {
                setMessage(data.message || `Failed to update ${type} setpoint`);
                setTimeout(() => setMessage(''), 3000);
            }
        } catch (error) {
            console.error(`Error updating ${type} setpoint:`, error);
            setMessage(`Error updating ${type} setpoint`);
            setTimeout(() => setMessage(''), 3000);
        } finally {
            setLoading(false);
        }
    };

    const getStatusColor = (current, target, tolerance) => {
        if (current === null || current === undefined || typeof current !== 'number') {
            return '#6c757d';
        }
        const diff = Math.abs(current - target);
        if (diff <= tolerance) return '#4cc9f0';
        if (current < target) return '#4361ee';
        return '#f72585';
    };

    const getConnectionStatusText = () => {
        if (realTimeStatus.connected) return '🟢 Connected to Broker';
        return '🔴 Disconnected';
    };

    const getConnectionStatusClass = () => {
        if (realTimeStatus.connected) return 'connected';
        return 'disconnected';
    };

    return (
        <div className="environment-control">
            <div className="environment-header">
                <h2>🌡️ Environment Control</h2>
            </div>

            <div className="location-info">
                📍 Location: <strong>{selectedLocation}</strong>
            </div>

            <div className="parameters-grid">
                {/* Temperature Parameter Card with Knob */}
                <div className={`parameter-card`}>
                    <div className="parameter-header">
                        <FaThermometerHalf style={{ color: getStatusColor(currentData.temperature, setpoints.temperature, 0.5) }} />
                        <span>Temperature</span>
                        <span className={`sensor-status ${realTimeStatus.sensorActive ? 'active' : 'inactive'}`}>
                            {realTimeStatus.sensorActive ? '🟢' : '🔴'}
                        </span>
                    </div>
                    <div className="parameter-value" style={{ color: getStatusColor(currentData.temperature, setpoints.temperature, 0.5) }}>
                        {displayedTemperature}°C
                    </div>
                    <div className="parameter-status" style={{
                        backgroundColor: currentData.temperature === null ? '#e9ecef' :
                            Math.abs(currentData.temperature - setpoints.temperature) <= 0.5 ? '#d1ecf1' : '#fff3cd',
                        color: currentData.temperature === null ? '#6c757d' :
                            Math.abs(currentData.temperature - setpoints.temperature) <= 0.5 ? '#0c5460' : '#856404'
                    }}>
                        Target: {setpoints.temperature}°C
                    </div>

                    {/* Temperature Knob Control */}
                    <div className="knob-setpoint-section">
                        <div className="knob-wrapper-small">
                            <div className="knob-container-small">
                                {/* Tick marks */}
                                <div className="knob-ticks-small">
                                    {generateTempTicks()}
                                </div>

                                {/* Main knob */}
                                <div
                                    ref={tempKnobRef}
                                    className={`enhanced-knob-small ${tempIsDragging ? 'dragging' : ''} ${tempIsHovering ? 'hovering' : ''} ${!realTimeStatus.connected || !realTimeStatus.sensorActive ? 'disabled' : ''}`}
                                    style={{
                                        transform: `rotate(${tempValueToAngle(tempKnobValue)}deg)`
                                    }}
                                    onMouseDown={handleTempMouseDown}
                                    onMouseEnter={() => setTempIsHovering(true)}
                                    onMouseLeave={() => setTempIsHovering(false)}
                                    onWheel={handleTempWheel}
                                >
                                    <div className="knob-inner-small">
                                        <div className="knob-indicator-small"></div>
                                        <div className="knob-dot-small"></div>
                                    </div>
                                </div>

                                {/* Center value display */}
                                <div className="center-display-small">
                                    <span className="center-value-small">{tempKnobValue}</span>
                                    <span className="center-unit-small">°C</span>
                                </div>
                            </div>

                            {/* Progress arc */}
                            <div className="progress-arc-small">
                                <svg viewBox="0 0 120 120" className="progress-svg-small">
                                    <circle
                                        cx="60"
                                        cy="60"
                                        r="50"
                                        fill="none"
                                        stroke="#e0e6ed"
                                        strokeWidth="3"
                                        strokeDasharray={`${TEMP_TOTAL_ANGLE * Math.PI * 50 / 180} ${360 * Math.PI * 50 / 180}`}
                                        strokeDashoffset={`${(135) * Math.PI * 50 / 180}`}
                                        className="progress-bg-small"
                                    />
                                    <circle
                                        cx="60"
                                        cy="60"
                                        r="50"
                                        fill="none"
                                        stroke="url(#progressGradientSmallTemp)"
                                        strokeWidth="3"
                                        strokeDasharray={`${((tempKnobValue - TEMP_MIN_VALUE) / (TEMP_MAX_VALUE - TEMP_MIN_VALUE)) * TEMP_TOTAL_ANGLE * Math.PI * 50 / 180} ${360 * Math.PI * 50 / 180}`}
                                        strokeDashoffset={`${(135) * Math.PI * 50 / 180}`}
                                        className="progress-fill-small"
                                    />
                                    <defs>
                                        <linearGradient id="progressGradientSmallTemp" x1="0%" y1="0%" x2="100%" y2="0%">
                                            <stop offset="0%" stopColor="#3b82f6" />
                                            <stop offset="50%" stopColor="#06b6d4" />
                                        </linearGradient>
                                    </defs>
                                </svg>
                            </div>
                        </div>

                        {/* Direct input below knob */}
                        <div className="knob-input-small">
                            <input
                                type="number"
                                min={TEMP_MIN_VALUE}
                                max={TEMP_MAX_VALUE}
                                value={tempKnobValue}
                                onChange={handleTempValueChange}
                                disabled={!realTimeStatus.connected || !realTimeStatus.sensorActive}
                                className="enhanced-input-small"
                            />
                        </div>

                        {/* Status */}
                        {tempPublishStatus && (
                            <div className={`status-message-small ${tempPublishStatus.includes('✅') ? 'success' : 'error'}`}>
                                {tempPublishStatus}
                            </div>
                        )}
                    </div>
                </div>

                {/* Humidity Parameter Card with Knob */}
                <div className={`parameter-card`}>
                    <div className="parameter-header">
                        <FaTint style={{ color: getStatusColor(currentData.humidity, setpoints.humidity, 2.0) }} />
                        <span>Humidity</span>
                        <span className={`sensor-status ${realTimeStatus.sensorActive ? 'active' : 'inactive'}`}>
                            {realTimeStatus.sensorActive ? '🟢' : '🔴'}
                        </span>
                    </div>
                    <div className="parameter-value" style={{ color: getStatusColor(currentData.humidity, setpoints.humidity, 2.0) }}>
                        {displayedHumidity}%
                    </div>
                    <div className="parameter-status" style={{
                        backgroundColor: currentData.humidity === null ? '#e9ecef' :
                            Math.abs(currentData.humidity - setpoints.humidity) <= 2.0 ? '#d1ecf1' : '#fff3cd',
                        color: currentData.humidity === null ? '#6c757d' :
                            Math.abs(currentData.humidity - setpoints.humidity) <= 2.0 ? '#0c5460' : '#856404'
                    }}>
                        Target: {setpoints.humidity}%
                    </div>

                    {/* Humidity Knob Control */}
                    <div className="knob-setpoint-section">
                        <div className="knob-wrapper-small">
                            <div className="knob-container-small">
                                {/* Tick marks */}
                                <div className="knob-ticks-small">
                                    {generateHumidityTicks()}
                                </div>

                                {/* Main knob */}
                                <div
                                    ref={humidityKnobRef}
                                    className={`enhanced-knob-small humidity ${humidityIsDragging ? 'dragging' : ''} ${humidityIsHovering ? 'hovering' : ''} ${!realTimeStatus.connected || !realTimeStatus.sensorActive ? 'disabled' : ''}`}
                                    style={{
                                        transform: `rotate(${humidityValueToAngle(humidityKnobValue)}deg)`
                                    }}
                                    onMouseDown={handleHumidityMouseDown}
                                    onMouseEnter={() => setHumidityIsHovering(true)}
                                    onMouseLeave={() => setHumidityIsHovering(false)}
                                    onWheel={handleHumidityWheel}
                                >
                                    <div className="knob-inner-small">
                                        <div className="knob-indicator-small humidity"></div>
                                        <div className="knob-dot-small humidity"></div>
                                    </div>
                                </div>

                                {/* Center value display */}
                                <div className="center-display-small">
                                    <span className="center-value-small">{humidityKnobValue}</span>
                                    <span className="center-unit-small">%</span>
                                </div>
                            </div>

                            {/* Progress arc */}
                            <div className="progress-arc-small">
                                <svg viewBox="0 0 120 120" className="progress-svg-small">
                                    <circle
                                        cx="60"
                                        cy="60"
                                        r="50"
                                        fill="none"
                                        stroke="#e0e6ed"
                                        strokeWidth="3"
                                        strokeDasharray={`${HUMIDITY_TOTAL_ANGLE * Math.PI * 50 / 180} ${360 * Math.PI * 50 / 180}`}
                                        strokeDashoffset={`${(135) * Math.PI * 50 / 180}`}
                                        className="progress-bg-small"
                                    />
                                    <circle
                                        cx="60"
                                        cy="60"
                                        r="50"
                                        fill="none"
                                        stroke="url(#progressGradientSmallHumidity)"
                                        strokeWidth="3"
                                        strokeDasharray={`${((humidityKnobValue - HUMIDITY_MIN_VALUE) / (HUMIDITY_MAX_VALUE - HUMIDITY_MIN_VALUE)) * HUMIDITY_TOTAL_ANGLE * Math.PI * 50 / 180} ${360 * Math.PI * 50 / 180}`}
                                        strokeDashoffset={`${(135) * Math.PI * 50 / 180}`}
                                        className="progress-fill-small"
                                    />
                                    <defs>
                                        <linearGradient id="progressGradientSmallHumidity" x1="0%" y1="0%" x2="100%" y2="0%">
                                            <stop offset="0%" stopColor="#1e40af" />
                                            <stop offset="50%" stopColor="#3b82f6" />
                                            <stop offset="100%" stopColor="#06b6d4" />
                                        </linearGradient>
                                    </defs>
                                </svg>
                            </div>
                        </div>

                        {/* Direct input below knob */}
                        <div className="knob-input-small">
                            <input
                                type="number"
                                min={HUMIDITY_MIN_VALUE}
                                max={HUMIDITY_MAX_VALUE}
                                value={humidityKnobValue}
                                onChange={handleHumidityValueChange}
                                disabled={!realTimeStatus.connected || !realTimeStatus.sensorActive}
                                className="enhanced-input-small"
                            />
                        </div>

                        {/* Status */}
                        {humidityPublishStatus && (
                            <div className={`status-message-small ${humidityPublishStatus.includes('✅') ? 'success' : 'error'}`}>
                                {humidityPublishStatus}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Enhanced Real-Time Connection Status */}
            <div className="connection-status">
                <div className="connection-details">
                    <span className={`connection-indicator ${realTimeStatus.connected ? 'connected' : 'disconnected'}`}>
                        Broker: {realTimeStatus.connected ? '🟢 Connected' : '🔴 Disconnected'}
                    </span>
                    <span className={`sensor-indicator ${realTimeStatus.sensorActive ? 'active' : 'inactive'}`}>
                        Sensors: {realTimeStatus.sensorActive ? '🟢 Active' : '🔴 Inactive'}
                    </span>
                </div>
                {/* <div className="connection-message">
          {!realTimeStatus.connected ?
            'Please check broker connection.' :
            !realTimeStatus.sensorActive ?
              'Waiting for real-time sensor data...' :
              'Real-time sensor data active - knobs enabled!'
          }
        </div> */}

                {/* Real-time activity indicator
        {realTimeStatus.sensorActive && (
          <div className="realtime-indicator">
            <span className="pulse-dot"></span>
            Live data stream active
          </div>
        )} */}
            </div>
        </div>
    );
};

export default EnvironmentControl;
