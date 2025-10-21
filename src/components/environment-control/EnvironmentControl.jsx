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
        <div className="space-y-6">
            {/* Minimalist Header */}
            <div className="flex items-center justify-between">
                <h2 className="text-3xl font-light text-gray-900 tracking-tight">Environment Control</h2>
                <div className="flex items-center gap-2 text-sm">
                    <svg className="w-4 h-4 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                    </svg>
                    <span className="text-gray-500">{selectedLocation}</span>
                </div>
            </div>

            {/* Clean Status Bar */}
            <div className="flex items-center gap-4 pb-6 border-b border-gray-100">
                <div className="flex items-center gap-2">
                    <div className={`w-1.5 h-1.5 rounded-full ${realTimeStatus.connected ? 'bg-emerald-500' : 'bg-gray-300'}`}></div>
                    <span className="text-xs text-gray-500 uppercase tracking-wider">Broker</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className={`w-1.5 h-1.5 rounded-full ${realTimeStatus.sensorActive ? 'bg-emerald-500' : 'bg-gray-300'}`}></div>
                    <span className="text-xs text-gray-500 uppercase tracking-wider">Sensors</span>
                </div>
            </div>

            {/* Temperature Control - Ultra Clean Card */}
            <div className="bg-white rounded-2xl border border-gray-100 hover:border-gray-200 transition-all duration-300 overflow-hidden">
                <div className="p-8">
                    {/* Card Header */}
                    <div className="flex items-start justify-between mb-8">
                        <div>
                            <div className="flex items-center gap-3 mb-2">
                                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-400 to-pink-500 flex items-center justify-center">
                                    <FaThermometerHalf className="text-white text-lg" />
                                </div>
                                <h3 className="text-xl font-medium text-gray-900">Temperature</h3>
                            </div>
                            <div className="flex items-baseline gap-2">
                                <span className="text-5xl font-light tracking-tight"
                                    style={{ color: getStatusColor(currentData.temperature, setpoints.temperature, 0.5) }}>
                                    {displayedTemperature}
                                </span>
                                <span className="text-2xl font-light text-gray-400">°C</span>
                            </div>
                        </div>

                        {/* Status Indicator */}
                        <div className={`px-3 py-1.5 rounded-full text-xs font-medium ${realTimeStatus.sensorActive
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'bg-gray-100 text-gray-500'
                            }`}>
                            {realTimeStatus.sensorActive ? 'Live' : 'Offline'}
                        </div>
                    </div>

                    {/* Target Display */}
                    <div className="mb-6 pb-6 border-b border-gray-50">
                        <div className="flex items-center justify-between text-sm">
                            <span className="text-gray-500">Target Temperature</span>
                            <span className="font-medium text-gray-900">{setpoints.temperature}°C</span>
                        </div>
                        {currentData.temperature !== null && (
                            <div className="mt-2">
                                <div className="h-1 bg-gray-100 rounded-full overflow-hidden">
                                    <div
                                        className={`h-full transition-all duration-500 ${Math.abs(currentData.temperature - setpoints.temperature) <= 0.5
                                            ? 'bg-emerald-500'
                                            : 'bg-amber-500'
                                            }`}
                                        style={{
                                            width: `${Math.min(100, (1 - Math.abs(currentData.temperature - setpoints.temperature) / 5) * 100)}%`
                                        }}
                                    />
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Sleek Knob Control */}
                    <div className="flex flex-col items-center space-y-6">
                        <div className="relative">
                            {/* Minimalist Progress Ring */}
                            <svg className="w-48 h-48 -rotate-90" viewBox="0 0 160 160">
                                {/* Background ring */}
                                ircle
                                cx="80"
                                cy="80"
                                r="70"
                                fill="none"
                                stroke="#f3f4f6"6"
                                strokeWidth="2"

                                {/* Progress ring */}
                                ircle
                                cx="80"
                                cy="80"
                                r="70"
                                fill="none"
                                stroke="url(#tempGradient)"
                                strokeWidth="2"
                                strokeDasharray={`${((tempKnobValue - TEMP_MIN_VALUE) / (TEMP_MAX_VALUE - TEMP_MIN_VALUE)) * 440} 440`}
                                className="transition-all duration-300"
                                strokeLinecap="round"d"

                                <defs>
                                    <linearGradient id="tempGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                                        <stop offset="0%" stopColor="#f97316" />
                                        <stop offset="100%" stopColor="#ec4899" />
                                    </linearGradient>
                                </defs>
                            </svg>

                            {/* Central Knob */}
                            <div className="absolute inset-0 flex items-center justify-center">
                                <div
                                    ref={tempKnobRef}
                                    className={`relative w-32 h-32 rounded-full bg-white shadow-xl cursor-grab active:cursor-grabbing transition-all duration-200 ${tempIsDragging ? 'scale-105 shadow-2xl' : ''
                                        } ${tempIsHovering ? 'shadow-2xl' : ''} ${!realTimeStatus.connected || !realTimeStatus.sensorActive ? 'opacity-40 cursor-not-allowed' : ''
                                        }`}
                                    style={{
                                        transform: `rotate(${tempValueToAngle(tempKnobValue)}deg)`
                                    }}
                                    onMouseDown={handleTempMouseDown}
                                    onMouseEnter={() => setTempIsHovering(true)}
                                    onMouseLeave={() => setTempIsHovering(false)}
                                    onWheel={handleTempWheel}
                                >
                                    {/* Knob indicator line */}
                                    <div className="absolute top-2 left-1/2 -translate-x-1/2 w-0.5 h-6 bg-gradient-to-b from-orange-500 to-pink-500 rounded-full"></div>

                                    {/* Center value */}
                                    <div className="absolute inset-0 flex items-center justify-center flex-col">
                                        <span className="text-3xl font-light text-gray-900">{tempKnobValue}</span>
                                        <span className="text-xs text-gray-400 uppercase tracking-wider">°C</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Input with Buttons */}
                        <div className="flex items-center gap-3">
                            <button
                                onClick={() => handleTempValueChange({ target: { value: tempKnobValue - 1 } })}
                                disabled={!realTimeStatus.connected || !realTimeStatus.sensorActive}
                                className="w-10 h-10 rounded-full bg-gray-50 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center text-gray-600"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                                </svg>
                            </button>

                            <input
                                type="number"
                                min={TEMP_MIN_VALUE}
                                max={TEMP_MAX_VALUE}
                                value={tempKnobValue}
                                onChange={handleTempValueChange}
                                disabled={!realTimeStatus.connected || !realTimeStatus.sensorActive}
                                className="w-20 px-4 py-2 text-center text-lg font-light bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                            />

                            <button
                                onClick={() => handleTempValueChange({ target: { value: tempKnobValue + 1 } })}
                                disabled={!realTimeStatus.connected || !realTimeStatus.sensorActive}
                                className="w-10 h-10 rounded-full bg-gray-50 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center text-gray-600"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                </svg>
                            </button>
                        </div>

                        {/* Status Message */}
                        {tempPublishStatus && (
                            <div className={`text-xs px-4 py-2 rounded-full ${tempPublishStatus.includes('✅')
                                ? 'bg-emerald-50 text-emerald-700'
                                : 'bg-red-50 text-red-700'
                                }`}>
                                {tempPublishStatus}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>

    );
};

export default EnvironmentControl;
