"use client";
import React, { useState, useEffect, useContext, useCallback, useMemo, useRef } from 'react';
import {
    FaThermometerHalf, FaMapMarkerAlt, FaFire, FaSnowflake, FaFan,
    FaPlay, FaPause, FaBolt, FaEye, FaExpand, FaCompress, FaSync,
    FaCog, FaInfoCircle, FaExclamationTriangle, FaWifi, FaTimes
} from 'react-icons/fa';
import { createSocket } from '../../lib/socket';
import AuthContext from '../../context/AuthContext';
import API_BASE_URL from '../../config/api.js';

import { usePathname } from 'next/navigation';  // ✅ ADD THIS
import { useTranslation } from '../../app/i18n/client.js';  // ✅ ADD THIS




const SpatialTemperatureMap = ({ selectedLocation = "sensor-room", targetTemperature = 22 }) => {
    const { user } = useContext(AuthContext);

    // ✅ ADD THESE LINES
    const pathname = usePathname();
    const lng = pathname.split("/")[1];
    const { t } = useTranslation(lng, "spatial");

    // State management (unchanged)
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

    // Optimization refs (unchanged)
    const [lastUpdate, setLastUpdate] = useState(Date.now());
    const updateBuffer = useRef(new Map());
    const updateTimer = useRef(null);
    const socketRef = useRef(null);

    // Helper functions (unchanged)
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
            if (diff <= 0.5) return { status: 'optimal', color: '#10b981', label: t('Optimal') };
            if (temp < targetTemperature - 2) return { status: 'cold', color: '#3b82f6', label: t('Too Cold') };
            if (temp < targetTemperature) return { status: 'cool', color: '#06b6d4', label: t('Cool') };
            if (temp > targetTemperature + 2) return { status: 'hot', color: '#dc2626', label: t('Too Hot') };
            return { status: 'warm', color: '#f59e0b', label: t('Warm') };
        },
        isOnline: (lastUpdate) => {
            if (!lastUpdate) return false;
            const updateTime = new Date(lastUpdate);
            return Date.now() - updateTime.getTime() < 3000;
        }
    }), [targetTemperature, t]);

    // All data fetching, socket, and calculation logic remains EXACTLY the same
    const fetchData = useCallback(async () => {
        if (!user?.token || !selectedLocation) {
            setUI(prev => ({ ...prev, loading: false, error: t('Missing authentication or location') }));
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
                error: t('Failed to load spatial data')
            }));
        }
    }, [user?.token, selectedLocation, t]);

    const flushUpdates = useCallback(() => {
        if (updateBuffer.current.size === 0) return;

        setData(prev => {
            let newData = { ...prev };

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

    useEffect(() => {
        if (!ui.realTimeUpdates || !user?.token) return;

        const socket = createSocket(user.token);
        if (!socket) return;

        socketRef.current = socket;
        socket.emit('joinLocation', selectedLocation);

        socket.on('spatialSensorUpdate', (update) => {
            console.log('🔄 Real sensor update received:', update);
            if (update.location === selectedLocation && update.sensorId?.startsWith('REAL_')) {
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

    useEffect(() => {
        fetchData();
    }, [fetchData]);

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

    // TAILWIND VERSION - Control Bar Component
    const ControlBar = () => (
        <div className="bg-gradient-to-r from-teal-700 to-blue-600 px-3 py-2 md:px-4 md:py-2.5 rounded-t-lg">
            <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 md:gap-3">
                    <div className="flex items-center gap-2 text-white">
                        <FaThermometerHalf className="text-base md:text-lg" />
                        <div>
                            <h2 className="text-sm md:text-base font-bold">{t('Spatial Temperature Control')}</h2>
                            <p className="text-xs text-teal-100 hidden sm:block">{t('Location')}: {selectedLocation}</p>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-1 md:gap-1.5">
                    <button
                        onClick={handlers.toggleRealTime}
                        className={`flex items-center gap-1 px-2 py-1 md:px-3 md:py-1.5 rounded-md text-xs md:text-sm font-medium transition-all ${ui.realTimeUpdates
                            ? 'bg-emerald-500 hover:bg-emerald-600 text-white'
                            : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
                            }`}
                    >
                        {ui.realTimeUpdates ? <FaPause className="w-3 h-3" /> : <FaPlay className="w-3 h-3" />}
                        <span className="hidden sm:inline">{ui.realTimeUpdates ? t('Live') : t('Paused')}</span>
                    </button>

                    <button
                        onClick={handlers.toggleFullscreen}
                        className="flex items-center gap-1 px-2 py-1 md:px-3 md:py-1.5 bg-white/20 hover:bg-white/30 text-white rounded-md text-xs md:text-sm font-medium transition-colors"
                    >
                        {ui.isFullscreen ? <FaCompress className="w-3 h-3" /> : <FaExpand className="w-3 h-3" />}
                        <span className="hidden md:inline">{ui.isFullscreen ? t('Exit') : t('Fullscreen')}</span>
                    </button>

                    <button
                        onClick={handlers.refresh}
                        className="flex items-center gap-1 px-2 py-1 md:px-3 md:py-1.5 bg-white hover:bg-gray-100 text-teal-700 rounded-md text-xs md:text-sm font-medium transition-colors"
                    >
                        <FaSync className="w-3 h-3" />
                        <span className="hidden md:inline">{t('Refresh')}</span>
                    </button>
                </div>
            </div>
        </div>
    );


    // TAILWIND VERSION - Real Sensor Status (already provided earlier, keeping same)
    const RealSensorStatus = () => {
        const realSensors = data.realSensors;
        const onlineCount = realSensors.filter(s => utils.isOnline(s.last_update)).length;

        if (realSensors.length === 0) {
            return (
                <div className="mx-6 mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <div className="flex items-center gap-3 mb-2">
                        <FaExclamationTriangle className="text-yellow-600 text-xl" />
                        <span className="font-semibold text-yellow-800">{t('No real sensors detected')}</span>
                    </div>
                    <p className="text-sm text-yellow-700">
                        {t('Check if your sensors are sending data')}
                    </p>
                </div>
            );
        }


        return (
            <div className="mx-1 mt-1 md:mx-2 md:mt-2 bg-card rounded-md border border-border shadow-sm group relative">
                <div className="flex items-center justify-between px-2 py-1.5 md:px-3 md:py-2 cursor-pointer hover:bg-accent/50 transition-colors rounded-md">
                    <div className="flex items-center gap-1.5">
                        <div className={`w-6 h-6 md:w-7 md:h-7 rounded flex items-center justify-center ${onlineCount > 0
                            ? 'bg-emerald-50 text-emerald-600'
                            : 'bg-red-50 text-red-600'
                            }`}>
                            <FaBolt className={`text-xs md:text-sm ${onlineCount > 0 ? 'animate-pulse' : ''}`} />
                        </div>
                        <div>
                            <h3 className="text-xs md:text-sm font-semibold text-foreground">
                                {t('Real Sensor Status')}
                            </h3>
                            <p className="text-[9px] md:text-[10px] text-muted-foreground hidden sm:block">
                                {t('Hover to view details')}
                            </p>
                        </div>
                    </div>


                    <div className="flex items-center gap-1.5">
                        <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 md:px-2 md:py-1 rounded-full text-[10px] md:text-xs font-medium ${onlineCount === realSensors.length
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-amber-50 text-amber-700 border border-amber-200'
                            }`}>
                            <span className={`inline-block w-1 h-1 md:w-1.5 md:h-1.5 rounded-full ${onlineCount === realSensors.length
                                ? 'bg-emerald-500 animate-pulse'
                                : 'bg-amber-500'
                                }`}></span>
                            <span className="hidden sm:inline">{onlineCount}/{realSensors.length}</span>
                            <span className="sm:hidden">{onlineCount}/{realSensors.length}</span>
                        </span>

                        <button
                            onClick={handlers.refresh}
                            className="p-1 md:p-1.5 rounded hover:bg-accent hover:text-accent-foreground transition-colors"
                            title={t('Refresh data')}
                        >
                            <FaSync className="w-2.5 h-2.5 md:w-3 md:h-3" />
                        </button>

                        {/* Dropdown indicator */}
                        <svg
                            className="w-3.5 h-3.5 md:w-4 md:h-4 text-muted-foreground transition-transform group-hover:rotate-180 hidden md:block"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                    </div>
                </div>

                {/* Dropdown Content - Shows on Hover */}
                <div className="absolute left-0 right-0 top-full mt-1 z-50 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-300">
                    <div className="bg-card rounded-md border border-border shadow-2xl p-2 md:p-3">
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1.5 md:gap-2">
                            {realSensors.map(sensor => {
                                const isOnline = utils.isOnline(sensor.last_update);
                                const temp = utils.safeNumber(sensor.last_reading);
                                const tempStatus = utils.getTemperatureStatus(temp);

                                return (
                                    <div
                                        key={sensor.sensor_id}
                                        onClick={() => handlers.selectSensor(sensor)}
                                        className={`group/card relative bg-background rounded border-2 p-2 cursor-pointer transition-all duration-200 hover:shadow-md ${isOnline
                                            ? 'border-emerald-200 hover:border-emerald-400'
                                            : 'border-red-200 hover:border-red-400'
                                            }`}
                                    >
                                        <div className="flex items-start justify-between mb-1.5">
                                            <div className="flex-1">
                                                <h4 className="font-semibold text-foreground text-[10px] md:text-xs">
                                                    {sensor.sensor_id.replace('REAL_TEMP_', 'S')}
                                                </h4>
                                            </div>
                                            {isOnline ? (
                                                <div className="flex items-center justify-center w-5 h-5 md:w-6 md:h-6 rounded-full bg-emerald-50">
                                                    <FaWifi className="w-2.5 h-2.5 md:w-3 md:h-3 text-emerald-600" />
                                                </div>
                                            ) : (
                                                <div className="flex items-center justify-center w-5 h-5 md:w-6 md:h-6 rounded-full bg-red-50">
                                                    <FaTimes className="w-2.5 h-2.5 md:w-3 md:h-3 text-red-600" />
                                                </div>
                                            )}
                                        </div>

                                        <div
                                            className="text-base md:text-lg font-bold mb-1.5 transition-colors"
                                            style={{ color: isOnline ? tempStatus.color : '#dc2626' }}
                                        >
                                            {isOnline ? utils.formatTemp(temp) : 'OFF'}
                                        </div>

                                        <div className="space-y-0.5 text-[9px] md:text-[10px] text-muted-foreground">
                                            <div className="flex items-center gap-0.5">
                                                <svg className="w-2 h-2 md:w-2.5 md:h-2.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                                </svg>
                                                <span className="truncate">({sensor.x_coordinate}, {sensor.y_coordinate})</span>
                                            </div>

                                            {sensor.mqtt_topic && (
                                                <div className="flex items-center gap-0.5">
                                                    <svg className="w-2 h-2 md:w-2.5 md:h-2.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                                                    </svg>
                                                    <span className="truncate">{sensor.mqtt_topic.split('/').pop()}</span>
                                                </div>
                                            )}

                                            {isOnline && (
                                                <div className="flex items-center gap-0.5">
                                                    <svg className="w-2 h-2 md:w-2.5 md:h-2.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                    </svg>
                                                    <span className="truncate">{new Date(sensor.last_update).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                                </div>
                                            )}
                                        </div>

                                        {isOnline && (
                                            <div className="absolute top-1 right-1 opacity-0 group-hover/card:opacity-100 transition-opacity">
                                                <span className="inline-flex items-center gap-0.5 px-1 py-0.5 bg-emerald-50 text-emerald-700 text-[9px] font-medium rounded-full">
                                                    <span className="w-0.5 h-0.5 bg-emerald-500 rounded-full animate-pulse"></span>
                                                    Live
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </div>
        );
    };


    // TAILWIND VERSION - Spatial Map Component
    const SpatialMap = () => {
        const bounds = mapCalculations.getBounds();
        const stats = mapCalculations.getStats();
        const mapWidth = 800;
        const mapHeight = 600;
        const padding = 50;

        const scaleX = (x) => ((x - bounds.minX) / (bounds.maxX - bounds.minX)) * (mapWidth - 2 * padding) + padding;
        const scaleY = (y) => ((y - bounds.minY) / (bounds.maxY - bounds.minY)) * (mapHeight - 2 * padding) + padding;

        return (
            <div className="mx-2 my-2 md:mx-4 md:my-3 bg-card rounded-lg border border-border shadow-sm overflow-hidden">
                <div className="px-3 py-2 md:px-4 md:py-2.5 bg-gradient-to-r from-gray-50 to-gray-100 border-b border-border flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                    <h3 className="text-sm md:text-base font-semibold text-foreground">{t('Temperature Map')}</h3>
                    {stats && (
                        <div className="text-xs text-muted-foreground">
                            {t('Avg')}: {utils.formatTemp(stats.avg)} | {t('Range')}: {utils.formatTemp(stats.min)} - {utils.formatTemp(stats.max)}
                        </div>
                    )}
                </div>

                <div className="p-2 md:p-4 bg-white relative">
                    <svg
                        width={mapWidth}
                        height={mapHeight}
                        className="mx-auto w-full h-auto max-w-full"
                        viewBox={`0 0 ${mapWidth} ${mapHeight}`}
                        preserveAspectRatio="xMidYMid meet"
                    >
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

                        {/* Sensors */}
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
                                        r={isReal ? 10 : 7}
                                        fill={isOnline ? tempStatus.color : '#9ca3af'}
                                        stroke={isReal ? '#1f2937' : '#ffffff'}
                                        strokeWidth={isReal ? 2.5 : 1.5}
                                        className="cursor-pointer hover:opacity-80 transition-opacity"
                                        onClick={() => handlers.selectSensor(sensor)}
                                        onMouseEnter={(e) => handlers.showTooltip(e,
                                            `${sensor.sensor_id}\n${utils.formatTemp(temp)}\n${t('Position')}: (${sensor.x_coordinate}, ${sensor.y_coordinate})\n${t('Status')}: ${isOnline ? t('Online') : t('Offline')}`
                                        )}
                                        onMouseLeave={handlers.hideTooltip}
                                    />
                                    {isReal && (
                                        <text
                                            x={x}
                                            y={y + 20}
                                            textAnchor="middle"
                                            className="text-[10px] md:text-xs font-semibold fill-gray-700"
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
                                        x={x - 8}
                                        y={y - 8}
                                        width={16}
                                        height={16}
                                        fill={isActive ? '#f59e0b' : '#e5e7eb'}
                                        stroke="#374151"
                                        strokeWidth="1.5"
                                        rx="2"
                                        className="cursor-pointer hover:opacity-80 transition-opacity"
                                        onClick={() => handlers.selectActuator(actuator)}
                                        onMouseEnter={(e) => handlers.showTooltip(e,
                                            `${actuator.actuator_id}\n${t('Type')}: ${actuator.actuator_type}\n${t('Output')}: ${output.toFixed(1)}%\n${t('Position')}: (${actuator.x_coordinate}, ${actuator.y_coordinate})`
                                        )}
                                        onMouseLeave={handlers.hideTooltip}
                                    />
                                    <text
                                        x={x}
                                        y={y + 3}
                                        textAnchor="middle"
                                        className="text-xs pointer-events-none"
                                    >
                                        {getActuatorIcon(actuator.actuator_type)}
                                    </text>
                                </g>
                            );
                        })}
                    </svg>

                    {/* Legend */}
                    <div className="absolute bottom-0.5 right-0.5 md:bottom-1 md:right-1 bg-white/90 backdrop-blur-sm rounded border border-border p-1 md:p-1.5 shadow-md">
                        <div className="text-[9px] md:text-[10px] font-semibold text-foreground mb-0.5">{t('Legend')}</div>
                        <div className="space-y-0.5">
                            <div className="flex items-center gap-1">
                                <div className="w-1.5 h-1.5 md:w-2 md:h-2 rounded-full bg-gray-700 border border-white"></div>
                                <span className="text-[8px] md:text-[9px] text-muted-foreground">{t('Real')}</span>
                            </div>
                            <div className="flex items-center gap-1">
                                <div className="w-1.5 h-1.5 md:w-2 md:h-2 rounded-full bg-blue-500"></div>
                                <span className="text-[8px] md:text-[9px] text-muted-foreground">{t('Simulated')}</span>
                            </div>
                            <div className="flex items-center gap-1">
                                <div className="w-1.5 h-1.5 md:w-2 md:h-2 bg-amber-500 border border-gray-700 rounded-sm"></div>
                                <span className="text-[8px] md:text-[9px] text-muted-foreground">{t('Actuator')}</span>
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
            <div className="flex flex-col items-center justify-center min-h-[400px] p-12">
                <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600 mb-4"></div>
                <p className="text-muted-foreground">{t('Loading spatial data...')}</p>
            </div>
        );
    }
    // Error state
    if (ui.error) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[400px] p-12">
                <div className="flex items-center gap-3 text-red-600 mb-4">
                    <FaExclamationTriangle className="text-2xl" />
                    <span className="text-lg font-semibold">{t('Error Loading Data')}</span>
                </div>
                <p className="text-muted-foreground mb-6">{ui.error}</p>
                <button
                    onClick={handlers.refresh}
                    className="px-6 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg font-medium transition-colors"
                >
                    {t('Try Again')}
                </button>
            </div>
        );
    }

    // Main render
    return (
        <div className={`relative w-full transition-all duration-300 ${ui.isFullscreen
            ? 'fixed inset-0 z-50 bg-background overflow-auto'
            : 'rounded-xl border border-border bg-card'
            }`}>
            <ControlBar />
            <RealSensorStatus />

            {data.sensors.length === 0 ? (
                <div className="flex flex-col items-center justify-center min-h-[400px] p-12 text-center mx-6 my-6">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-50 text-blue-600 mb-4">
                        <FaInfoCircle className="w-8 h-8" />
                    </div>
                    <h3 className="text-xl font-semibold text-foreground mb-2">
                        {t('No Sensors Found')}
                    </h3>
                    <p className="text-sm text-muted-foreground max-w-md">
                        {t('Configure sensors with coordinates')}
                    </p>
                </div>
            ) : (
                <SpatialMap />
            )}

            {tooltip.visible && (
                <div
                    className="fixed z-50 px-3 py-2 text-sm font-medium text-white bg-gray-900 rounded-lg shadow-lg pointer-events-none whitespace-pre-line animate-in fade-in-0 zoom-in-95 duration-200"
                    style={{ left: tooltip.x, top: tooltip.y }}
                >
                    {tooltip.content}
                    <div className="absolute w-2 h-2 bg-gray-900 transform rotate-45 -translate-x-1/2 left-1/2 -bottom-1"></div>
                </div>
            )}
        </div>
    );
};

export default SpatialTemperatureMap;
