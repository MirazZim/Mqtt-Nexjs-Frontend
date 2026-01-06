"use client";
import React, { useState, useEffect, useContext, useRef } from 'react';
import { FaThermometerHalf, FaTint, FaWind, FaCog } from 'react-icons/fa';
import { createSocket } from '../../lib/socket';
import AuthContext from '../../context/AuthContext';
import API_BASE_URL from '../../config/api.js';
import { usePathname } from 'next/navigation';  // ✅ ADD THIS
import { useTranslation } from '../../app/i18n/client.js';

const EnvironmentControl = ({ selectedLocation }) => {
    const { user } = useContext(AuthContext);

    const pathname = usePathname();
    const lng = pathname.split("/")[1];
    const { t } = useTranslation(lng, "environment");

    // Safe number formatting function
    const safeToFixed = (value, digits = 1) => {
        // ✅ Handle null/undefined explicitly
        if (value === null || value === undefined) return 'N/A';
        // ✅ Convert to number if it's a string
        const numValue = typeof value === 'string' ? parseFloat(value) : value;
        // ✅ Check if it's a valid number
        return (typeof numValue === 'number' && !isNaN(numValue)) ? numValue.toFixed(digits) : 'N/A';
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

    // Fan Knob State
    const [fanKnobValue, setFanKnobValue] = useState(0);
    const [fanIsDragging, setFanIsDragging] = useState(false);
    const [fanIsHovering, setFanIsHovering] = useState(false);
    const [fanPublishStatus, setFanPublishStatus] = useState('');

    // Fan Speed Configuration
    const FAN_MIN_VALUE = 0;
    const FAN_MAX_VALUE = 100;
    const FAN_TOTAL_ANGLE = 270;
    const FAN_START_ANGLE = -135;

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

    const fanKnobRef = useRef(null);
    const fanStartAngleRef = useRef(0);
    const fanStartValueRef = useRef(0);

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

    const [actuators, setActuators] = useState([]);
    const [fanSpeedActuator, setFanSpeedActuator] = useState(null);
    const [isLoadingActuators, setIsLoadingActuators] = useState(true);
    const [fanSpeed, setFanSpeed] = useState(0);


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
        }, 15000);
    };

    // Add this in your EnvironmentControl.jsx component
    // After state declarations, around line 150-200

    useEffect(() => {
        const fetchCurrentFanSpeed = async () => {
            if (!user || !selectedLocation) return;

            try {
                const response = await fetch(
                    `${API_BASE_URL}/api/fan-speed/current/${selectedLocation}`,
                    {
                        headers: {
                            'Authorization': `Bearer ${user.token}`
                        }
                    }
                );

                if (response.ok) {
                    const data = await response.json();
                    console.log(data)
                    if (data.status === 'success' && data.data) {
                        const currentSpeed = data.data.currentSpeed;
                        setFanKnobValue(currentSpeed ?? 0);
                        setFanSpeed(currentSpeed ?? 0);
                        console.log(`✅ Initial fan speed loaded: ${currentSpeed}%`);
                    }
                }
            } catch (error) {
                console.error('❌ Error fetching current fan speed:', error);
            }
        };

        fetchCurrentFanSpeed();
    }, [user, selectedLocation]);
    // ✅ Dependencies

    useEffect(() => {
        const fetchActuators = async () => {
            if (!user || !selectedLocation) {
                setIsLoadingActuators(false);
                return;
            }

            setIsLoadingActuators(true);
            console.log(`🔍 Fetching actuators for room: ${selectedLocation}`);

            try {
                const response = await fetch(
                    `${API_BASE_URL}/api/actuators?roomCode=${selectedLocation}`,
                    {
                        headers: {
                            'Authorization': `Bearer ${user.token}`
                        }
                    }
                );

                console.log(`📡 Actuators response status: ${response.status}`);

                if (response.ok) {
                    const data = await response.json();
                    console.log('📦 Actuators data received:', data);

                    // ✅ Fixed: Backend returns actuators directly in response
                    if (data.status === 'success' && Array.isArray(data.actuators)) {
                        // Find fan speed control actuator
                        const fanActuator = data.actuators.find(
                            act => act.actuator_type_code === 'fan_speed_control' && act.is_active === 1
                        );

                        if (fanActuator) {
                            setFanSpeedActuator(fanActuator);
                            console.log('✅ Fan speed actuator found:', fanActuator.actuator_name);

                            // Set initial knob value from current state
                            const initialSpeed = parseInt(fanActuator.current_state) || 0;
                            setFanKnobValue(initialSpeed);
                            setFanSpeed(initialSpeed);
                        } else {
                            console.log('ℹ️ No fan speed actuator found for this room');
                            setFanSpeedActuator(null);
                        }

                        setActuators(data.actuators);
                    } else {
                        console.warn('⚠️ Invalid actuators response format:', data);
                        setFanSpeedActuator(null);
                    }
                } else {
                    console.error('❌ Failed to fetch actuators:', response.status);
                    setFanSpeedActuator(null);
                }
            } catch (error) {
                console.error('❌ Error fetching actuators:', error);
                setFanSpeedActuator(null);
            } finally {
                setIsLoadingActuators(false);
                console.log('✅ Actuator loading complete');
            }
        };

        fetchActuators();
    }, [user, selectedLocation]);



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
        if (!selectedLocation || !user) {
            console.warn('⚠️ [fetchLatestEnvironment] Missing selectedLocation or user', { selectedLocation, user: user?.id });
            return;
        }

        console.log('📊 [fetchLatestEnvironment] START - Location:', selectedLocation);

        try {
            const url = `${API_BASE_URL}/api/locations/${encodeURIComponent(selectedLocation)}/latest`;
            console.log('📡 [fetchLatestEnvironment] Fetching from:', url);

            const response = await fetch(url, {
                headers: { 'Authorization': `Bearer ${user.token}` }
            });

            console.log('📬 [fetchLatestEnvironment] Response status:', response.status, response.statusText);

            if (response.ok) {
                const data = await response.json();
                console.log('✅ [fetchLatestEnvironment] Data received:', data);

                if (data.status === 'success' && data.measurement) {
                    const measurement = data.measurement;
                    console.log('📦 [fetchLatestEnvironment] Measurement:', {
                        temp: measurement.temperature,
                        humidity: measurement.humidity,
                        airflow: measurement.airflow,
                        created_at: measurement.created_at
                    });

                    // Check if we have recent data
                    const measurementTime = new Date(measurement.created_at);
                    const timeSinceLastMeasurement = Date.now() - measurementTime.getTime();

                    console.log('⏱️ [fetchLatestEnvironment] Time since last measurement:',
                        `${(timeSinceLastMeasurement / 1000).toFixed(1)}s`);

                    setCurrentData({
                        temperature: typeof measurement.temperature === 'number' ? measurement.temperature : null,
                        humidity: typeof measurement.humidity === 'number' ? measurement.humidity : null,
                        airflow: typeof measurement.airflow === 'number' ? measurement.airflow : null
                    });

                    console.log('✅ [fetchLatestEnvironment] State updated');

                    // If data is recent (less than 2 minutes), mark sensor as active
                    if (timeSinceLastMeasurement < 120000) {
                        console.log('🟢 [fetchLatestEnvironment] Data is FRESH - Marking sensor ACTIVE');
                        setRealTimeStatus(prev => ({ ...prev, sensorActive: true }));
                    } else {
                        console.log('🔴 [fetchLatestEnvironment] Data is STALE - Sensor marked INACTIVE');
                        setRealTimeStatus(prev => ({ ...prev, sensorActive: false }));
                    }
                } else {
                    console.warn('⚠️ [fetchLatestEnvironment] Invalid response structure:', data);
                }
            } else {
                console.error('❌ [fetchLatestEnvironment] API error:', response.status, await response.text());
            }
        } catch (err) {
            console.error('❌ [fetchLatestEnvironment] Exception:', err.message, err);
        }

        console.log('📊 [fetchLatestEnvironment] END\n');
    };

    // Add this function to your EnvironmentControl component

    const updateFanSpeed = async (speed) => {
        if (!socket || !realTimeStatus.connected) {
            setFanPublishStatus('❌ Not connected to server');
            setTimeout(() => setFanPublishStatus(''), 3000);
            return;
        }

        if (!realTimeStatus.sensorActive) {
            setFanPublishStatus('❌ Sensors not active');
            setTimeout(() => setFanPublishStatus(''), 3000);
            return;
        }

        if (!fanSpeedActuator) {
            setFanPublishStatus('❌ Fan speed actuator not configured');
            setTimeout(() => setFanPublishStatus(''), 3000);
            return;
        }

        setLoading(true);
        const validSpeed = Math.max(0, Math.min(100, parseInt(speed)));

        setFanPublishStatus(`📤 Setting fan speed: ${validSpeed}%`);

        try {
            // ✅ Use Socket.IO to send fan speed command
            socket.emit('setFanSpeed', {
                roomCode: selectedLocation,
                speed: validSpeed
            });

            console.log(`🌀 Fan speed command sent via Socket.IO: ${validSpeed}%`);

        } catch (error) {
            console.error('❌ Error sending fan speed command:', error);
            setFanPublishStatus(`❌ Failed to send command`);
            setTimeout(() => setFanPublishStatus(''), 3000);
        } finally {
            setLoading(false);
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

    const fanValueToAngle = (value) => {
        const percentage = (value - FAN_MIN_VALUE) / (FAN_MAX_VALUE - FAN_MIN_VALUE);
        return FAN_START_ANGLE + (percentage * FAN_TOTAL_ANGLE);
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

    // Fan Knob Event Handlers
    const handleFanMouseDown = (e) => {
        if (!realTimeStatus.connected || !realTimeStatus.sensorActive || !fanKnobRef.current) return;

        setFanIsDragging(true);
        const rect = fanKnobRef.current.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;

        fanStartAngleRef.current = getAngleFromCenter(centerX, centerY, e.clientX, e.clientY);
        fanStartValueRef.current = fanKnobValue;

        e.preventDefault();
    };

    const handleFanMouseMove = (e) => {
        if (!fanIsDragging || !fanKnobRef.current) return;

        const rect = fanKnobRef.current.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;

        const currentAngle = getAngleFromCenter(centerX, centerY, e.clientX, e.clientY);
        let angleDelta = currentAngle - fanStartAngleRef.current;

        if (angleDelta > 180) angleDelta -= 360;
        if (angleDelta < -180) angleDelta += 360;

        const sensitivity = 0.3;
        const valueDelta = Math.round((angleDelta * sensitivity));
        const newValue = Math.max(FAN_MIN_VALUE, Math.min(FAN_MAX_VALUE, fanStartValueRef.current + valueDelta));

        if (newValue !== fanKnobValue) {
            setFanKnobValue(newValue);
            updateFanSpeed(newValue);
        }
    };

    const handleFanMouseUp = () => {
        setFanIsDragging(false);
    };

    const handleFanWheel = (e) => {
        if (!realTimeStatus.connected || !realTimeStatus.sensorActive) return;
        e.preventDefault();

        const delta = e.deltaY > 0 ? -1 : 1;
        const newValue = Math.max(FAN_MIN_VALUE, Math.min(FAN_MAX_VALUE, fanKnobValue + delta));

        if (newValue !== fanKnobValue) {
            setFanKnobValue(newValue);
            updateFanSpeed(newValue);
        }
    };

    const handleFanValueChange = (e) => {
        if (!realTimeStatus.connected || !realTimeStatus.sensorActive) return;

        const value = parseInt(e.target.value);
        if (!isNaN(value) && value >= FAN_MIN_VALUE && value <= FAN_MAX_VALUE) {
            setFanKnobValue(value);
            updateFanSpeed(value);
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

    // In your React component
    // Replace your existing incomplete socket listener with this complete version
    useEffect(() => {
        if (!socket) return;

        // ✅ Handle successful fan speed update
        socket.on('fanSpeedSuccess', (data) => {
            console.log('✅ Fan speed success:', data);
            setFanKnobValue(data.newSpeed);
            setFanPublishStatus(`✅ Fan speed set: ${data.newSpeed}%`);
            setTimeout(() => setFanPublishStatus(''), 3000);
        });

        // ✅ Handle fan speed errors
        socket.on('fanSpeedError', (data) => {
            console.error('❌ Fan speed error:', data);
            setFanPublishStatus(`❌ ${data.message}`);
            setTimeout(() => setFanPublishStatus(''), 3000);
        });

        // ✅ Handle broadcast updates (when other users change fan speed)
        socket.on('fanSpeedUpdated', (data) => {
            console.log('🔄 Fan speed updated by another user:', data);

            // Only update if it's for the current room
            if (data.roomCode === selectedLocation) {
                setFanKnobValue(data.newSpeed);
                setFanPublishStatus(`🔄 ${data.updatedBy} set fan speed: ${data.newSpeed}%`);
                setTimeout(() => setFanPublishStatus(''), 3000);
            }
        });

        // Cleanup
        return () => {
            socket.off('fanSpeedSuccess');
            socket.off('fanSpeedError');
            socket.off('fanSpeedUpdated');
        };
    }, [socket, selectedLocation]);




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

    // Mouse event listeners for fan knob
    useEffect(() => {
        if (fanIsDragging) {
            const handleMouseMove = (e) => handleFanMouseMove(e);
            const handleMouseUp = () => handleFanMouseUp();

            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);

            return () => {
                document.removeEventListener('mousemove', handleMouseMove);
                document.removeEventListener('mouseup', handleMouseUp);
            };
        }
    }, [fanIsDragging, fanKnobValue, FAN_MIN_VALUE, FAN_MAX_VALUE]);

    // Sync fan knob value with fan speed actuator
    useEffect(() => {
        if (fanSpeedActuator && fanSpeedActuator.current_state) {
            const currentSpeed = parseInt(fanSpeedActuator.current_state) || 0;
            setFanKnobValue(Math.max(FAN_MIN_VALUE, Math.min(FAN_MAX_VALUE, currentSpeed)));
        }
    }, [fanSpeedActuator]);

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

    // Generate tick marks for fan speed
    const generateFanTicks = () => {
        const ticks = [];
        const totalTicks = 11; // 0, 10, 20, ..., 100

        for (let i = 0; i < totalTicks; i++) {
            const value = i * 10;
            const angle = fanValueToAngle(value);
            const isMain = value % 20 === 0;
            const isCurrent = value === fanKnobValue;

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
                            setTempPublishStatus(`✅ ${t('Temperature set')}: ${result.message}°C`);
                            setMessage(`${t('Temperature setpoint updated to')} ${result.message}°C`);
                        } else if (value >= HUMIDITY_MIN_VALUE && value <= HUMIDITY_MAX_VALUE) {
                            setHumidityPublishStatus(`✅  ${t('Humidity set')}: ${result.message}%`);
                            setMessage(`${t('Humidity setpoint updated to')} ${result.message}%`);
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
            setTempPublishStatus(`❌ ${t('Not connected to server')}`);
            setTimeout(() => setTempPublishStatus(''), 3000);
            return;
        }

        if (!realTimeStatus.sensorActive) {
            setTempPublishStatus(`❌ ${t('Sensors not active')}`);
            setTimeout(() => setTempPublishStatus(''), 3000);
            return;
        }

        setLoading(true);
        setTempPublishStatus(`📤 ${t('Setting temperature')}: ${value}°C`);

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
        <div className="space-y-3 md:space-y-4">


            {/* Fan Speed Control - Fully Dynamic */}
            {isLoadingActuators ? (
                // Loading State
                <div className="bg-white rounded-lg md:rounded-xl border border-gray-100 p-8 flex items-center justify-center">
                    <div className="flex flex-col items-center gap-2">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-500"></div>
                        <div className="text-sm text-gray-500">{t('Loading actuators...')}</div>
                    </div>
                </div>
            ) : !fanSpeedActuator ? (
                // No Actuator Found State
                <div className="bg-white rounded-lg md:rounded-xl border border-gray-100 hover:border-gray-200 transition-all duration-300 overflow-hidden">
                    <div className="p-8">
                        <div className="text-center">
                            <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-gray-100 flex items-center justify-center">
                                <FaWind className="text-gray-400 text-xl" />
                            </div>
                            <h3 className="text-sm font-medium text-gray-700 mb-1">
                                {t('Fan Speed Control Not Available')}
                            </h3>
                            <p className="text-xs text-gray-500">
                                {t('This room does not have a fan speed controller configured')}
                            </p>
                        </div>
                    </div>
                </div>
            ) : (
                // Fan Speed Control Card - Knob Style
                <div className="bg-white rounded-lg md:rounded-xl border border-gray-100 hover:border-gray-200 transition-all duration-300 overflow-hidden">
                    <div className="p-3 md:p-5">
                        {/* Card Header - Dynamic */}
                        <div className="flex items-start justify-between mb-3 md:mb-4">
                            <div>
                                <div className="flex items-center gap-2 mb-1.5">
                                    <div className="w-7 h-7 md:w-8 md:h-8 rounded-lg bg-gradient-to-br from-blue-400 to-cyan-500 flex items-center justify-center">
                                        <FaWind className="text-white text-sm md:text-base" />
                                    </div>
                                    <h3 className="text-sm md:text-base font-medium text-gray-900">
                                        {fanSpeedActuator.actuator_name}
                                    </h3>
                                </div>
                                {/* Show topic for debugging/info */}
                                <div className="text-[10px] text-gray-400 ml-9">
                                    {fanSpeedActuator.mqtt_topic}
                                </div>
                            </div>

                            {/* Status Indicator */}
                            <div className={`px-2 py-1 md:px-2.5 md:py-1.5 rounded-full text-[10px] md:text-xs font-medium ${fanKnobValue > 0
                                ? 'bg-cyan-50 text-cyan-700'
                                : 'bg-gray-100 text-gray-500'
                                }`}>
                                {fanKnobValue > 0 ? `${fanKnobValue}%` : t('Off')}
                            </div>
                        </div>

                        {/* Current Speed Display */}
                        <div className="mb-3 md:mb-4 pb-3 md:pb-4 border-b border-gray-50">
                            <div className="flex items-center justify-between text-xs md:text-sm">
                                <span className="text-gray-500">{t('Current Speed')}</span>
                                <span className="font-medium text-gray-900">{fanKnobValue}%</span>
                            </div>
                            <div className="mt-1.5">
                                <div className="h-0.5 md:h-1 bg-gray-100 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-gradient-to-r from-blue-400 to-cyan-500 transition-all duration-500"
                                        style={{ width: `${fanKnobValue}%` }}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Sleek Knob Control */}
                        <div className="flex flex-col items-center space-y-3 md:space-y-4">
                            <div className="relative">
                                {/* Minimalist Progress Ring */}
                                <svg className="w-32 h-32 md:w-40 md:h-40 -rotate-90" viewBox="0 0 160 160">
                                    {/* Background ring */}
                                    <circle
                                        cx="80"
                                        cy="80"
                                        r="70"
                                        fill="none"
                                        stroke="#f3f4f6"
                                        strokeWidth="2"
                                    />

                                    {/* Progress ring */}
                                    <circle
                                        cx="80"
                                        cy="80"
                                        r="70"
                                        fill="none"
                                        stroke="url(#fanGradient)"
                                        strokeWidth="2"
                                        strokeDasharray={`${((fanKnobValue - FAN_MIN_VALUE) / (FAN_MAX_VALUE - FAN_MIN_VALUE)) * 440} 440`}
                                        className="transition-all duration-300"
                                        strokeLinecap="round"
                                    />

                                    <defs>
                                        <linearGradient id="fanGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                                            <stop offset="0%" stopColor="#3b82f6" />
                                            <stop offset="100%" stopColor="#06b6d4" />
                                        </linearGradient>
                                    </defs>
                                </svg>

                                {/* Central Knob */}
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <div
                                        ref={fanKnobRef}
                                        className={`relative w-24 h-24 md:w-28 md:h-28 rounded-full bg-white shadow-lg cursor-grab active:cursor-grabbing transition-all duration-200 ${fanIsDragging ? 'scale-105 shadow-xl' : ''
                                            } ${fanIsHovering ? 'shadow-xl' : ''} ${!realTimeStatus.connected || !realTimeStatus.sensorActive ? 'opacity-40 cursor-not-allowed' : ''
                                            }`}
                                        style={{
                                            transform: `rotate(${fanValueToAngle(fanKnobValue)}deg)`
                                        }}
                                        onMouseDown={handleFanMouseDown}
                                        onMouseEnter={() => setFanIsHovering(true)}
                                        onMouseLeave={() => setFanIsHovering(false)}
                                        onWheel={handleFanWheel}
                                    >
                                        {/* Knob indicator line */}
                                        <div className="absolute top-1.5 md:top-2 left-1/2 -translate-x-1/2 w-0.5 h-4 md:h-5 bg-gradient-to-b from-blue-500 to-cyan-500 rounded-full"></div>

                                        {/* Center value */}
                                        <div className="absolute inset-0 flex items-center justify-center flex-col">
                                            <span className="text-xl md:text-2xl font-light text-gray-900">{fanKnobValue}</span>
                                            <span className="text-[9px] md:text-xs text-gray-400 uppercase tracking-wider">%</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Input with Buttons */}
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => handleFanValueChange({ target: { value: fanKnobValue - 5 } })}
                                    disabled={!realTimeStatus.connected || !realTimeStatus.sensorActive}
                                    className="w-8 h-8 md:w-9 md:h-9 rounded-full bg-gray-50 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center text-gray-600"
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                                    </svg>
                                </button>

                                <input
                                    type="number"
                                    min={FAN_MIN_VALUE}
                                    max={FAN_MAX_VALUE}
                                    value={fanKnobValue}
                                    onChange={handleFanValueChange}
                                    disabled={!realTimeStatus.connected || !realTimeStatus.sensorActive}
                                    className="w-16 md:w-18 px-3 py-1.5 md:py-2 text-center text-base md:text-lg font-light bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                                />

                                <button
                                    onClick={() => handleFanValueChange({ target: { value: fanKnobValue + 5 } })}
                                    disabled={!realTimeStatus.connected || !realTimeStatus.sensorActive}
                                    className="w-8 h-8 md:w-9 md:h-9 rounded-full bg-gray-50 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center text-gray-600"
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                    </svg>
                                </button>
                            </div>

                            {/* Quick Action Buttons */}
                            <div className="flex items-center gap-2 w-full justify-center flex-wrap">
                                <button
                                    onClick={() => handleFanValueChange({ target: { value: 0 } })}
                                    disabled={!realTimeStatus.connected || !realTimeStatus.sensorActive}
                                    className="px-3 py-1.5 text-xs font-medium bg-gray-50 hover:bg-gray-100 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                                >
                                    {t('OFF')}
                                </button>
                                <button
                                    onClick={() => handleFanValueChange({ target: { value: 25 } })}
                                    disabled={!realTimeStatus.connected || !realTimeStatus.sensorActive}
                                    className="px-3 py-1.5 text-xs font-medium bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                                >
                                    {t('LOW')} (25%)
                                </button>
                                <button
                                    onClick={() => handleFanValueChange({ target: { value: 50 } })}
                                    disabled={!realTimeStatus.connected || !realTimeStatus.sensorActive}
                                    className="px-3 py-1.5 text-xs font-medium bg-cyan-50 hover:bg-cyan-100 text-cyan-700 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                                >
                                    {t('MEDIUM')} (50%)
                                </button>
                                <button
                                    onClick={() => handleFanValueChange({ target: { value: 100 } })}
                                    disabled={!realTimeStatus.connected || !realTimeStatus.sensorActive}
                                    className="px-3 py-1.5 text-xs font-medium bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                                >
                                    {t('HIGH')} (100%)
                                </button>
                            </div>

                            {/* Status Message */}
                            {fanPublishStatus && (
                                <div className={`text-[10px] md:text-xs px-3 py-1.5 rounded-full ${fanPublishStatus.includes('✅')
                                    ? 'bg-cyan-50 text-cyan-700'
                                    : 'bg-red-50 text-red-700'
                                    }`}>
                                    {fanPublishStatus}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>

    );
};

export default EnvironmentControl;