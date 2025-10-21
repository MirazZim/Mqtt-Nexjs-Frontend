"use client";
import React, { useState, useEffect, useContext, useCallback, useMemo, useRef } from 'react';
import {
    FaThermometerHalf, FaMapMarkerAlt, FaFire, FaSnowflake, FaFan,
    FaPlay, FaPause, FaBolt, FaEye, FaExpand, FaCompress, FaSync,
    FaCog, FaInfoCircle, FaExclamationTriangle, FaWifi, FaTimes
} from 'react-icons/fa';
import { createSocket } from '../../lib/socket';
import AuthContext from '../../context/AuthContext';
// Import the CSS file
import API_BASE_URL from '../../config/api.js';

const SpatialTemperatureMap = ({ selectedLocation = "sensor-room", targetTemperature = 22 }) => {
    const { user } = useContext(AuthContext);

    // State management
    const [data, setData] = useState({
        sensors: [],
        actuators: [],
        temperatureField: [],
        controlCommands: [],
        metrics: {},
        realSensors: []
    });

    const [ui, setUI] = useState({
        loading: true,
        error: null,
        realTimeUpdates: true,
        isFullscreen: false,
        selectedSensor: null,
        selectedActuator: null
    });

    const [tooltip, setTooltip] = useState({
        visible: false,
        x: 0,
        y: 0,
        content: ''
    });

    // Optimization refs
    const [lastUpdate, setLastUpdate] = useState(Date.now());
    const updateBuffer = useRef(new Map());
    const updateTimer = useRef(null);
    const socketRef = useRef(null);

    // Helper functions
    const utils = useMemo(() => ({
        safeNumber: (value, fallback = 0) => {
            const num = parseFloat(value);
            return isNaN(num) ? fallback : num;
        },
        formatTemp: (temp, decimals = 1) => {
            const num = parseFloat(temp);
            return isNaN(num) ? 'N/A' : `${num.toFixed(decimals)}°C`;
        },
        getTemperatureStatus: (temp) => {
            const diff = Math.abs(temp - targetTemperature);
            if (diff <= 0.5) return { status: 'optimal', color: '#10b981', label: 'Optimal' };
            if (temp < targetTemperature - 2) return { status: 'cold', color: '#3b82f6', label: 'Too Cold' };
            if (temp < targetTemperature) return { status: 'cool', color: '#06b6d4', label: 'Cool' };
            if (temp > targetTemperature + 2) return { status: 'hot', color: '#dc2626', label: 'Too Hot' };
            return { status: 'warm', color: '#f59e0b', label: 'Warm' };
        },
        isOnline: (lastUpdate) => {
            if (!lastUpdate) return false;
            const updateTime = new Date(lastUpdate);
            return Date.now() - updateTime.getTime() < 3000;
        }
    }), [targetTemperature]);

    // Data fetching with proper error handling
    const fetchData = useCallback(async () => {
        if (!user?.token || !selectedLocation) {
            setUI(prev => ({ ...prev, loading: false, error: 'Missing authentication or location' }));
            return;
        }

        setUI(prev => ({ ...prev, loading: true, error: null }));

        try {
            const baseUrl = `${API_BASE_URL}`;
            const headers = { 'Authorization': `Bearer ${user.token}` };

            const endpoints = [
                `${baseUrl}/api/spatial/sensors?location=${encodeURIComponent(selectedLocation)}`,
                `${baseUrl}/api/spatial/actuators?location=${encodeURIComponent(selectedLocation)}`,
                `${baseUrl}/api/spatial/temperature-field/${encodeURIComponent(selectedLocation)}`,
                `${baseUrl}/api/spatial/performance/${encodeURIComponent(selectedLocation)}?hours=1`
            ];

            const responses = await Promise.allSettled(
                endpoints.map(url => fetch(url, { headers }))
            );

            const newData = {
                sensors: [],
                actuators: [],
                temperatureField: [],
                controlCommands: [],
                metrics: {},
                realSensors: []
            };

            // Process responses
            if (responses[0].status === 'fulfilled' && responses[0].value.ok) {
                const result = await responses[0].value.json();
                newData.sensors = result.sensors || [];
                newData.realSensors = newData.sensors.filter(s => s.sensor_id?.startsWith('REAL_'));
                console.log(`📡 Found ${newData.realSensors.length} real sensors:`,
                    newData.realSensors.map(s => s.sensor_id));
            }

            if (responses[1].status === 'fulfilled' && responses[1].value.ok) {
                const result = await responses[1].value.json();
                newData.actuators = result.actuators || [];
            }

            if (responses[2].status === 'fulfilled' && responses[2].value.ok) {
                const result = await responses[2].value.json();
                newData.temperatureField = result.temperatureField || [];
            }

            if (responses[3].status === 'fulfilled' && responses[3].value.ok) {
                const result = await responses[3].value.json();
                newData.metrics = result.metrics || {};
            }

            setData(newData);
            setLastUpdate(Date.now());
            setUI(prev => ({ ...prev, loading: false }));

        } catch (error) {
            console.error('Data fetch error:', error);
            setUI(prev => ({
                ...prev,
                loading: false,
                error: 'Failed to load spatial data. Please check your connection.'
            }));
        }
    }, [user?.token, selectedLocation]);

    // Debounced update flushing
    const flushUpdates = useCallback(() => {
        if (updateBuffer.current.size === 0) return;

        setData(prev => {
            let newData = { ...prev };

            // Update real sensors data
            for (const [sensorId, update] of updateBuffer.current) {
                newData.sensors = newData.sensors.map(sensor =>
                    sensor.sensor_id === sensorId
                        ? { ...sensor, last_reading: update.temperature, last_update: update.timestamp }
                        : sensor
                );

                newData.temperatureField = newData.temperatureField.map(field =>
                    field.sensor_id === sensorId
                        ? { ...field, temperature: update.temperature, humidity: update.humidity, created_at: update.timestamp }
                        : field
                );
            }

            return newData;
        });

        updateBuffer.current.clear();
        setLastUpdate(Date.now());
    }, []);

    // Socket connection for real-time updates
    useEffect(() => {
        if (!ui.realTimeUpdates || !user?.token) return;

        const socket = createSocket(user.token);
        if (!socket) return;

        socketRef.current = socket;

        socket.emit('joinLocation', selectedLocation);

        // Handle spatial sensor updates
        socket.on('spatialSensorUpdate', (update) => {
            console.log('🔄 Real sensor update received:', update);
            if (update.location === selectedLocation && update.sensorId?.startsWith('REAL_')) {
                // Update sensors data immediately
                setData(prev => ({
                    ...prev,
                    sensors: prev.sensors.map(sensor =>
                        sensor.sensor_id === update.sensorId
                            ? { ...sensor, last_reading: update.temperature, last_update: update.timestamp }
                            : sensor
                    ),
                    realSensors: prev.realSensors.map(sensor =>
                        sensor.sensor_id === update.sensorId
                            ? { ...sensor, last_reading: update.temperature, last_update: update.timestamp }
                            : sensor
                    )
                }));

                console.log(`📱 Frontend updated: ${update.sensorId} = ${update.temperature}°C`);
            }
        });

        // Handle control commands
        socket.on('spatialControlCommand', (command) => {
            console.log('🎛️ Control command received:', command);
            if (command.actuatorId) {
                setData(prev => ({
                    ...prev,
                    controlCommands: [command, ...prev.controlCommands.slice(0, 9)],
                    actuators: prev.actuators.map(actuator =>
                        actuator.actuator_id === command.actuatorId
                            ? { ...actuator, current_output: command.value }
                            : actuator
                    )
                }));
            }
        });

        // Handle real sensor data directly
        socket.on('newMeasurement', (measurement) => {
            if (measurement.location === selectedLocation) {
                updateBuffer.current.set('measurement', measurement);
                if (updateTimer.current) {
                    clearTimeout(updateTimer.current);
                }
                updateTimer.current = setTimeout(flushUpdates, 100);
            }
        });

        return () => {
            socket.emit('leaveLocation', selectedLocation);
            socket.disconnect();
            socketRef.current = null;
        };
    }, [ui.realTimeUpdates, user?.token, selectedLocation, flushUpdates]);

    // Initial data load
    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // Map calculations
    const mapCalculations = useMemo(() => {
        const getBounds = () => {
            const positions = [
                ...data.sensors.map(s => ({
                    x: utils.safeNumber(s.x_coordinate),
                    y: utils.safeNumber(s.y_coordinate)
                })),
                ...data.actuators.map(a => ({
                    x: utils.safeNumber(a.x_coordinate),
                    y: utils.safeNumber(a.y_coordinate)
                }))
            ].filter(pos => pos.x !== 0 || pos.y !== 0);

            if (positions.length === 0) {
                return { minX: 0, maxX: 10, minY: 0, maxY: 10 };
            }

            let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
            for (const pos of positions) {
                if (pos.x < minX) minX = pos.x;
                if (pos.x > maxX) maxX = pos.x;
                if (pos.y < minY) minY = pos.y;
                if (pos.y > maxY) maxY = pos.y;
            }

            return {
                minX: minX - 1,
                maxX: maxX + 1,
                minY: minY - 1,
                maxY: maxY + 1
            };
        };

        const getStats = () => {
            const temps = data.sensors
                .map(s => utils.safeNumber(s.last_reading))
                .filter(temp => temp !== 0);

            if (temps.length === 0) return null;

            let sum = 0, min = Infinity, max = -Infinity;
            for (const temp of temps) {
                sum += temp;
                if (temp < min) min = temp;
                if (temp > max) max = temp;
            }

            const avg = sum / temps.length;
            let varianceSum = 0;
            for (const temp of temps) {
                varianceSum += Math.pow(temp - avg, 2);
            }

            const variance = varianceSum / temps.length;
            const uniformity = avg !== 0 ? Math.max(0, 1 - (Math.sqrt(variance) / Math.abs(avg))) : 0;

            return { avg, min, max, uniformity, count: temps.length };
        };

        return { getBounds, getStats };
    }, [data.sensors, data.actuators, utils]);

    // Event handlers
    const handlers = {
        toggleRealTime: () => {
            setUI(prev => ({ ...prev, realTimeUpdates: !prev.realTimeUpdates }));
        },
        toggleFullscreen: () => {
            setUI(prev => ({ ...prev, isFullscreen: !prev.isFullscreen }));
            document.body.classList.toggle('spatial-fullscreen');
        },
        showTooltip: (event, content) => {
            setTooltip({
                visible: true,
                x: event.clientX + 10,
                y: event.clientY - 10,
                content
            });
        },
        hideTooltip: () => {
            setTooltip(prev => ({ ...prev, visible: false }));
        },
        selectSensor: (sensor) => {
            setUI(prev => ({ ...prev, selectedSensor: sensor }));
        },
        selectActuator: (actuator) => {
            setUI(prev => ({ ...prev, selectedActuator: actuator }));
        },
        refresh: () => {
            fetchData();
        }
    };

    // Real Sensor Status Component
    const RealSensorStatus = () => {
        const realSensors = data.realSensors;
        const onlineCount = realSensors.filter(s => utils.isOnline(s.last_update)).length;

        if (realSensors.length === 0) {
            return (
                <div className="warning-panel">
                    <div className="warning-header">
                        <FaExclamationTriangle className="warning-icon" />
                        <span className="warning-title">No real sensors detected</span>
                    </div>
                    <p className="warning-text">
                        Check if your sensors (ESPX, ESPX2, ESPX3) are sending data to the MQTT broker.
                    </p>
                </div>
            );
        }

        return (
            <div className="sensor-status-panel">
                <div className="sensor-status-header">
                    <div className="sensor-status-title">
                        <FaBolt className={`sensor-bolt ${onlineCount > 0 ? 'online' : 'offline'}`} />
                        <h3>Real Sensor Status</h3>
                    </div>
                    <div className="sensor-status-controls">
                        <span className={`status-badge ${onlineCount === realSensors.length ? 'all-online' : 'partial-online'}`}>
                            {onlineCount}/{realSensors.length} Online
                        </span>
                        <button
                            onClick={handlers.refresh}
                            className="refresh-btn"
                            title="Refresh data"
                        >
                            <FaSync />
                        </button>
                    </div>
                </div>

                <div className="sensor-grid">
                    {realSensors.map(sensor => {
                        const isOnline = utils.isOnline(sensor.last_update);
                        const temp = utils.safeNumber(sensor.last_reading);
                        const tempStatus = utils.getTemperatureStatus(temp);

                        return (
                            <div
                                key={sensor.sensor_id}
                                className={`sensor-card ${isOnline ? 'online' : 'offline'}`}
                                onClick={() => handlers.selectSensor(sensor)}
                            >
                                <div className="sensor-card-header">
                                    <div className="sensor-name">
                                        {sensor.sensor_id.replace('REAL_TEMP_', 'Sensor ')}
                                    </div>
                                    {isOnline ? (
                                        <FaWifi className="wifi-icon online" />
                                    ) : (
                                        <FaTimes className="wifi-icon offline" />
                                    )}
                                </div>

                                <div
                                    className="sensor-temperature"
                                    style={{ color: isOnline ? tempStatus.color : '#dc2626' }}
                                >
                                    {isOnline ? utils.formatTemp(temp) : 'OFFLINE'}
                                </div>

                                <div className="sensor-details">
                                    <div>Position: ({sensor.x_coordinate}, {sensor.y_coordinate})</div>
                                    {sensor.mqtt_topic && (
                                        <div>Topic: {sensor.mqtt_topic}</div>
                                    )}
                                    {isOnline && (
                                        <div>Updated: {new Date(sensor.last_update).toLocaleTimeString()}</div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    };

    // Control Bar Component
    const ControlBar = () => (
        <div className="control-bar">
            <div className="control-bar-content">
                <div className="control-bar-left">
                    <div className="control-bar-title">
                        <FaThermometerHalf className="title-icon" />
                        <div>
                            <h2>Spatial Temperature Control</h2>
                            <p>Location: {selectedLocation}</p>
                        </div>
                    </div>
                </div>

                <div className="control-bar-right">
                    <button
                        onClick={handlers.toggleRealTime}
                        className={`control-btn ${ui.realTimeUpdates ? 'active' : 'inactive'}`}
                    >
                        {ui.realTimeUpdates ? <FaPause /> : <FaPlay />}
                        {ui.realTimeUpdates ? 'Live' : 'Paused'}
                    </button>

                    <button
                        onClick={handlers.toggleFullscreen}
                        className="control-btn secondary"
                    >
                        {ui.isFullscreen ? <FaCompress /> : <FaExpand />}
                        {ui.isFullscreen ? 'Exit' : 'Fullscreen'}
                    </button>

                    <button
                        onClick={handlers.refresh}
                        className="control-btn primary"
                    >
                        <FaSync />
                        Refresh
                    </button>
                </div>
            </div>
        </div>
    );

    // Spatial Map Component
    const SpatialMap = () => {
        const bounds = mapCalculations.getBounds();
        const stats = mapCalculations.getStats();
        const mapWidth = 800;
        const mapHeight = 600;
        const padding = 50;

        const scaleX = (x) => ((x - bounds.minX) / (bounds.maxX - bounds.minX)) * (mapWidth - 2 * padding) + padding;
        const scaleY = (y) => ((y - bounds.minY) / (bounds.maxY - bounds.minY)) * (mapHeight - 2 * padding) + padding;

        return (
            <div className="spatial-map">
                <div className="map-header">
                    <h3>Temperature Map</h3>
                    {stats && (
                        <div className="map-stats">
                            Avg: {utils.formatTemp(stats.avg)} |
                            Range: {utils.formatTemp(stats.min)} - {utils.formatTemp(stats.max)}
                        </div>
                    )}
                </div>

                <div className="map-container">
                    <svg width={mapWidth} height={mapHeight} className="temperature-map">
                        {/* Grid lines */}
                        <defs>
                            <pattern id="grid" width="50" height="50" patternUnits="userSpaceOnUse">
                                <path d="M 50 0 L 0 0 0 50" fill="none" stroke="#f0f0f0" strokeWidth="1" />
                            </pattern>
                        </defs>
                        <rect width="100%" height="100%" fill="url(#grid)" />

                        {/* Actuator influence zones */}
                        {data.actuators.map((actuator, idx) => {
                            const x = scaleX(utils.safeNumber(actuator.x_coordinate));
                            const y = scaleY(utils.safeNumber(actuator.y_coordinate));
                            const radius = (utils.safeNumber(actuator.influence_radius, 3) / (bounds.maxX - bounds.minX)) * (mapWidth - 2 * padding);

                            return (
                                <circle
                                    key={`influence-${idx}`}
                                    cx={x}
                                    cy={y}
                                    r={radius}
                                    fill="rgba(59, 130, 246, 0.1)"
                                    stroke="rgba(59, 130, 246, 0.3)"
                                    strokeWidth="1"
                                    strokeDasharray="5,5"
                                />
                            );
                        })}

                        {/* Temperature sensors */}
                        {data.sensors.map((sensor, idx) => {
                            const x = scaleX(utils.safeNumber(sensor.x_coordinate));
                            const y = scaleY(utils.safeNumber(sensor.y_coordinate));
                            const temp = utils.safeNumber(sensor.last_reading);
                            const isOnline = utils.isOnline(sensor.last_update);
                            const tempStatus = utils.getTemperatureStatus(temp);
                            const isReal = sensor.sensor_id?.startsWith('REAL_');

                            return (
                                <g key={`sensor-${idx}`}>
                                    <circle
                                        cx={x}
                                        cy={y}
                                        r={isReal ? 12 : 8}
                                        fill={isOnline ? tempStatus.color : '#9ca3af'}
                                        stroke={isReal ? '#1f2937' : '#ffffff'}
                                        strokeWidth={isReal ? 3 : 2}
                                        className="sensor-point"
                                        onClick={() => handlers.selectSensor(sensor)}
                                        onMouseEnter={(e) => handlers.showTooltip(e,
                                            `${sensor.sensor_id}\n${utils.formatTemp(temp)}\nPosition: (${sensor.x_coordinate}, ${sensor.y_coordinate})\nStatus: ${isOnline ? 'Online' : 'Offline'}`
                                        )}
                                        onMouseLeave={handlers.hideTooltip}
                                    />
                                    {isReal && (
                                        <text
                                            x={x}
                                            y={y + 25}
                                            textAnchor="middle"
                                            className="sensor-label"
                                        >
                                            {sensor.sensor_id.replace('REAL_TEMP_', 'R')}
                                        </text>
                                    )}
                                </g>
                            );
                        })}

                        {/* Actuators */}
                        {data.actuators.map((actuator, idx) => {
                            const x = scaleX(utils.safeNumber(actuator.x_coordinate));
                            const y = scaleY(utils.safeNumber(actuator.y_coordinate));
                            const output = utils.safeNumber(actuator.current_output);
                            const isActive = output > 0;

                            const getActuatorIcon = (type) => {
                                switch (type) {
                                    case 'heater': return '🔥';
                                    case 'cooler': return '❄️';
                                    case 'fan': return '💨';
                                    default: return '⚙️';
                                }
                            };

                            return (
                                <g key={`actuator-${idx}`}>
                                    <rect
                                        x={x - 10}
                                        y={y - 10}
                                        width={20}
                                        height={20}
                                        fill={isActive ? '#f59e0b' : '#e5e7eb'}
                                        stroke="#374151"
                                        strokeWidth="2"
                                        rx="3"
                                        className="actuator-point"
                                        onClick={() => handlers.selectActuator(actuator)}
                                        onMouseEnter={(e) => handlers.showTooltip(e,
                                            `${actuator.actuator_id}\nType: ${actuator.actuator_type}\nOutput: ${output.toFixed(1)}%\nPosition: (${actuator.x_coordinate}, ${actuator.y_coordinate})`
                                        )}
                                        onMouseLeave={handlers.hideTooltip}
                                    />
                                    <text
                                        x={x}
                                        y={y + 4}
                                        textAnchor="middle"
                                        className="actuator-icon"
                                    >
                                        {getActuatorIcon(actuator.actuator_type)}
                                    </text>
                                </g>
                            );
                        })}
                    </svg>

                    {/* Legend */}
                    <div className="map-legend">
                        <div className="legend-title">Legend</div>
                        <div className="legend-items">
                            <div className="legend-item">
                                <div className="legend-color real-sensor"></div>
                                <span>Real Sensor</span>
                            </div>
                            <div className="legend-item">
                                <div className="legend-color simulated-sensor"></div>
                                <span>Simulated Sensor</span>
                            </div>
                            <div className="legend-item">
                                <div className="legend-color actuator"></div>
                                <span>Actuator</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    // Loading state
    if (ui.loading) {
        return (
            <div className="loading-container">
                <div className="loading-spinner"></div>
                <p>Loading spatial data...</p>
            </div>
        );
    }

    // Error state
    if (ui.error) {
        return (
            <div className="error-container">
                <div className="error-header">
                    <FaExclamationTriangle />
                    <span>Error Loading Data</span>
                </div>
                <p className="error-message">{ui.error}</p>
                <button onClick={handlers.refresh} className="error-retry-btn">
                    Try Again
                </button>
            </div>
        );
    }

    // Main render
    return (
        <div className={`spatial-temperature-container ${ui.isFullscreen ? 'fullscreen' : ''}`}>
            <ControlBar />
            <RealSensorStatus />

            {data.sensors.length === 0 ? (
                <div className="no-sensors-message">
                    <FaInfoCircle className="no-sensors-icon" />
                    <h3>No Sensors Found</h3>
                    <p>Configure sensors with coordinates to view the temperature map.</p>
                </div>
            ) : (
                <SpatialMap />
            )}

            {/* Tooltip */}
            {tooltip.visible && (
                <div
                    className="tooltip"
                    style={{ left: tooltip.x, top: tooltip.y }}
                >
                    {tooltip.content}
                </div>
            )}
        </div>
    );
};

export default SpatialTemperatureMap;
