"use client";
import React, { useState, useEffect, useContext, useMemo, useRef, useCallback } from 'react';
import {
    LineChart,
    AreaChart,
    Line,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer
} from 'recharts';
import AuthContext from '../../context/AuthContext';
import { Card, CardContent, CardHeader } from "../ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { usePathname } from 'next/navigation';
import { useTranslation } from '../../app/i18n/client.js';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

const EnvironmentChart = ({ selectedLocation }) => {
    const { user, socket } = useContext(AuthContext);
    const pathname = usePathname();
    const lng = pathname.split("/")[1];
    const { t } = useTranslation(lng, "chart");

    const isMountedRef = useRef(true);
    const [availableSensors, setAvailableSensors] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [selectedPeriod, setSelectedPeriod] = useState('1h');
    const [chartType, setChartType] = useState('area');
    const [lastUpdate, setLastUpdate] = useState(null);

    // ✅ NEW: Multi-chart state
    const [viewMode, setViewMode] = useState('multi'); // 'single' or 'multi'
    const [activeSensorTypes, setActiveSensorTypes] = useState(new Set(['temperature']));

    // ✅ NEW: Store measurements for each sensor type
    const [measurementsBySensor, setMeasurementsBySensor] = useState({});
    const [currentSensors, setCurrentSensors] = useState({});

    const sensorTypeConfigs = useMemo(() => ({
        temperature: { label: t("Temperature (°C)"), color: "#ef4444", icon: "🌡️" },
        humidity: { label: t("Humidity (%)"), color: "#3b82f6", icon: "💧" },
        airflow: { label: t("Airflow (m/s)"), color: "#8b5cf6", icon: "💨" },
        co2_level: { label: t("CO2 (ppm)"), color: "#f59e0b", icon: "🫧" },
        sugar_level: { label: t("Sugar (Brix)"), color: "#ec4899", icon: "🍬" },
        bowl_temp: { label: t("Bowl Temp (°C)"), color: "#14b8a6", icon: "🍲" },
        sonar_distance: { label: t("Distance (cm)"), color: "#06b6d4", icon: "📏" }
    }), [t]);

    useEffect(() => {
        isMountedRef.current = true;
        return () => { isMountedRef.current = false; };
    }, []);

    useEffect(() => {
        console.log(`📊 [EnvironmentChart] Location changed to: ${selectedLocation}`);
        setMeasurementsBySensor({});
        setCurrentSensors({});
        setError(null);
    }, [selectedLocation]);

    // Fetch sensors
    useEffect(() => {
        const fetchSensors = async () => {
            if (!user?.token || !selectedLocation) {
                setError(t('Please log in'));
                setLoading(false);
                return;
            }

            try {
                const response = await fetch(
                    `${API_BASE_URL}/api/sensors?location=${encodeURIComponent(selectedLocation)}`,
                    {
                        headers: {
                            'Authorization': `Bearer ${user.token}`,
                            'Content-Type': 'application/json'
                        },
                        cache: 'no-store'
                    }
                );

                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                const result = await response.json();

                if (result.status === 'success' && result.sensors && isMountedRef.current) {
                    console.log(`📊 Found ${result.sensors.length} sensors for ${selectedLocation}`);
                    setAvailableSensors(result.sensors);
                }
            } catch (err) {
                if (isMountedRef.current) setError(`${t('Failed')}: ${err.message}`);
            }
        };

        fetchSensors();
    }, [user, selectedLocation, t]);

    const availableSensorTypes = useMemo(() => {
        const types = new Set();
        availableSensors.forEach(sensor => {
            if (sensor.type_code && sensor.is_active) types.add(sensor.type_code.toLowerCase());
        });
        return Array.from(types);
    }, [availableSensors]);

    // ✅ NEW: Find sensors for all active types
    useEffect(() => {
        const findSensors = async () => {
            if (availableSensors.length === 0 || !user?.token) {
                setCurrentSensors({});
                return;
            }

            const typesToFetch = viewMode === 'single'
                ? Array.from(activeSensorTypes).slice(0, 1)
                : Array.from(activeSensorTypes);

            const newCurrentSensors = {};

            for (const sensorType of typesToFetch) {
                const sensorsOfType = availableSensors
                    .filter(s => s.type_code?.toLowerCase() === sensorType.toLowerCase() && s.is_active)
                    .sort((a, b) => a.id - b.id);

                if (sensorsOfType.length === 0) continue;

                // Find sensor with recent data
                for (const sensor of sensorsOfType) {
                    try {
                        const response = await fetch(
                            `${API_BASE_URL}/api/environment/${sensor.id}?period=1h`,
                            {
                                headers: { 'Authorization': `Bearer ${user.token}`, 'Content-Type': 'application/json' },
                                cache: 'no-store'
                            }
                        );

                        if (response.ok) {
                            const result = await response.json();
                            if (result.status === 'success' && result.data?.length > 0) {
                                newCurrentSensors[sensorType] = sensor;
                                break;
                            }
                        }
                    } catch (err) {
                        console.error(`Error checking sensor ${sensor.id}:`, err);
                    }
                }

                // Fallback to first sensor
                if (!newCurrentSensors[sensorType]) {
                    newCurrentSensors[sensorType] = sensorsOfType[0];
                }
            }

            if (isMountedRef.current) setCurrentSensors(newCurrentSensors);
        };

        findSensors();
    }, [activeSensorTypes, availableSensors, user, viewMode]);

    // ✅ NEW: Fetch data for all active sensors
    useEffect(() => {
        const fetchAllData = async () => {
            if (Object.keys(currentSensors).length === 0 || !user?.token) {
                setLoading(false);
                return;
            }

            try {
                setLoading(true);
                setError(null);

                const fetchPromises = Object.entries(currentSensors).map(async ([sensorType, sensor]) => {
                    const response = await fetch(
                        `${API_BASE_URL}/api/environment/${sensor.id}?period=${selectedPeriod}`,
                        {
                            headers: { 'Authorization': `Bearer ${user.token}`, 'Content-Type': 'application/json' },
                            cache: 'no-store',
                            next: { revalidate: 0 }
                        }
                    );

                    if (!response.ok) throw new Error(`HTTP ${response.status}`);
                    const result = await response.json();

                    return {
                        sensorType,
                        data: result.status === 'success' ? result.data || [] : []
                    };
                });

                const results = await Promise.all(fetchPromises);

                if (isMountedRef.current) {
                    const newMeasurements = {};
                    results.forEach(({ sensorType, data }) => {
                        newMeasurements[sensorType] = data;
                    });
                    setMeasurementsBySensor(newMeasurements);
                    setLastUpdate(new Date());
                }
            } catch (err) {
                if (isMountedRef.current) {
                    setError(`${t('Failed')}: ${err.message}`);
                }
            } finally {
                if (isMountedRef.current) setLoading(false);
            }
        };

        fetchAllData();
    }, [currentSensors, selectedPeriod, user, t]);

    // ✅ NEW: Real-time updates for all active sensors
    useEffect(() => {
        if (!socket || Object.keys(currentSensors).length === 0 || !selectedLocation) return;

        socket.emit('joinLocation', selectedLocation);

        Object.values(currentSensors).forEach(sensor => {
            socket.emit('joinSensor', sensor.id);
        });

        const handleSensorData = (data) => {
            if (data.location !== selectedLocation && data.roomId !== selectedLocation) return;

            Object.entries(currentSensors).forEach(([sensorType, sensor]) => {
                const matchesSensor =
                    data.sensorId === sensor.id ||
                    data.sensor_id === sensor.id ||
                    (data.sensorType === sensorType && data.location === selectedLocation);

                if (matchesSensor && isMountedRef.current) {
                    setMeasurementsBySensor(prev => {
                        const newPoint = {
                            timestamp: data.timestamp || new Date().toISOString(),
                            value: parseFloat(data.value),
                            quality: data.quality || 'good'
                        };

                        const updated = [...(prev[sensorType] || []), newPoint];

                        const limits = {
                            '1h': 360,
                            '6h': 720,
                            '24h': 1440,
                            '7d': 2016,
                            '30d': 4320
                        };

                        const limit = limits[selectedPeriod] || 1000;
                        return {
                            ...prev,
                            [sensorType]: updated.slice(-limit)
                        };
                    });

                    setLastUpdate(new Date());
                }
            });
        };

        socket.on('sensorData', handleSensorData);
        socket.on('sensorUpdate', handleSensorData);
        socket.on('environmentUpdate', handleSensorData);
        socket.on('newMeasurement', handleSensorData);

        return () => {
            socket.emit('leaveLocation', selectedLocation);
            Object.values(currentSensors).forEach(sensor => {
                socket.emit('leaveSensor', sensor.id);
            });
            socket.off('sensorData', handleSensorData);
            socket.off('sensorUpdate', handleSensorData);
            socket.off('environmentUpdate', handleSensorData);
            socket.off('newMeasurement', handleSensorData);
        };
    }, [socket, currentSensors, selectedPeriod, selectedLocation]);

    // ✅ NEW: Toggle sensor type
    const toggleSensorType = useCallback((sensorType) => {
        setActiveSensorTypes(prev => {
            const newSet = new Set(prev);
            if (newSet.has(sensorType)) {
                if (newSet.size > 1) newSet.delete(sensorType);
            } else {
                newSet.add(sensorType);
            }
            return newSet;
        });
    }, []);

    const formatXAxisTick = useCallback((tickItem) => {
        const date = new Date(tickItem);
        if (['1h', '6h', '24h'].includes(selectedPeriod)) {
            return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        }
        return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }, [selectedPeriod]);

    const CustomTooltip = ({ active, payload, label }) => {
        if (!active || !payload || payload.length === 0) return null;
        const date = new Date(label);
        return (
            <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3">
                <p className="text-xs font-semibold text-gray-700 mb-2">
                    {date.toLocaleString()}
                </p>
                {payload.map((entry, index) => (
                    entry.value != null && (
                        <div key={index} className="flex items-center justify-between gap-3 text-xs">
                            <span className="flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
                                <span className="text-gray-600">{entry.name}:</span>
                            </span>
                            <span className="font-semibold text-gray-800">
                                {typeof entry.value === 'number' ? entry.value.toFixed(2) : 'N/A'}
                            </span>
                        </div>
                    )
                ))}
            </div>
        );
    };

    // ✅ NEW: Single Chart Component
    const SingleChart = React.memo(({ sensorType, measurements, config }) => {
        const processedData = useMemo(() => {
            if (!measurements || measurements.length === 0) return { chartData: [], yAxisDomain: [0, 100] };

            const maxPoints = 150;
            const sampledMeasurements = measurements.length > maxPoints
                ? measurements.filter((_, index) => index % Math.ceil(measurements.length / maxPoints) === 0)
                : measurements;

            const data = sampledMeasurements
                .map(m => {
                    const timestamp = new Date(m.timestamp).getTime();
                    const value = parseFloat(m.value);
                    if (!Number.isFinite(timestamp) || !Number.isFinite(value)) return null;
                    return { timestamp, value: Math.round(value * 100) / 100 };
                })
                .filter(Boolean)
                .sort((a, b) => a.timestamp - b.timestamp);

            const values = data.map(d => d.value);
            let domain = [0, 100];
            if (values.length > 0) {
                const min = Math.min(...values);
                const max = Math.max(...values);
                const padding = Math.max((max - min) * 0.1, 2);
                domain = [Math.floor(min - padding), Math.ceil(max + padding)];
            }

            return { chartData: data, yAxisDomain: domain };
        }, [measurements]);

        const ChartComponent = chartType === 'area' ? AreaChart : LineChart;

        if (processedData.chartData.length === 0) {
            return (
                <div className="flex items-center justify-center h-[300px]">
                    <p className="text-gray-600 text-sm">{t('No data for this period')}</p>
                </div>
            );
        }

        return (
            <div>
                <div className="flex items-center gap-2 mb-2">
                    <span className="text-sm font-medium">{config.icon} {config.label}</span>
                    {currentSensors[sensorType] && (
                        <span className="text-xs text-gray-500">({currentSensors[sensorType].sensor_name})</span>
                    )}
                </div>
                <div className="h-[300px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <ChartComponent data={processedData.chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                            <XAxis
                                dataKey="timestamp"
                                tickFormatter={formatXAxisTick}
                                stroke="#888888"
                                fontSize={10}
                                tickLine={false}
                                axisLine={false}
                            />
                            <YAxis domain={processedData.yAxisDomain} tickLine={false} axisLine={false} fontSize={10} width={50} />
                            <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#888', strokeWidth: 1, strokeDasharray: '5 5' }} />
                            <Legend />
                            {chartType === 'area' ? (
                                <Area
                                    type="monotone"
                                    dataKey="value"
                                    stroke={config.color}
                                    fill={config.color}
                                    fillOpacity={0.3}
                                    strokeWidth={2}
                                    name={config.label}
                                    connectNulls={true}
                                    dot={false}
                                    isAnimationActive={false}
                                />
                            ) : (
                                <Line
                                    type="monotone"
                                    dataKey="value"
                                    stroke={config.color}
                                    strokeWidth={2}
                                    name={config.label}
                                    connectNulls={true}
                                    dot={false}
                                    isAnimationActive={false}
                                />
                            )}
                        </ChartComponent>
                    </ResponsiveContainer>
                </div>
                {measurements.length > 0 && (
                    <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                        <div>
                            <p className="text-gray-500">{t('Points')}</p>
                            <p className="font-semibold">{measurements.length}</p>
                        </div>
                        <div>
                            <p className="text-gray-500">{t('Average')}</p>
                            <p className="font-semibold">
                                {(measurements.reduce((sum, m) => sum + m.value, 0) / measurements.length).toFixed(2)}
                            </p>
                        </div>
                        <div>
                            <p className="text-gray-500">{t('Latest')}</p>
                            <p className="font-semibold">
                                {measurements[measurements.length - 1]?.value.toFixed(2)}
                            </p>
                        </div>
                    </div>
                )}
            </div>
        );
    });

    SingleChart.displayName = 'SingleChart';

    return (
        <Card className="w-full">
            <CardHeader>
                <div className="space-y-3">
                    {/* Controls Row */}
                    <div className="flex items-center justify-between flex-wrap gap-2">
                        <div className="flex items-center gap-2">
                            <Select value={viewMode} onValueChange={setViewMode}>
                                <SelectTrigger className="w-[120px] h-7 text-xs">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="single" className="text-xs">📊 {t('Single')}</SelectItem>
                                    <SelectItem value="multi" className="text-xs">📈 {t('Multi')}</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="flex items-center gap-1.5">
                            <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
                                <SelectTrigger className="w-[100px] h-7 text-xs">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="1h" className="text-xs">⚡ {t('1 Hour')}</SelectItem>
                                    <SelectItem value="6h" className="text-xs">{t('6 Hours')}</SelectItem>
                                    <SelectItem value="24h" className="text-xs">{t('24 Hours')}</SelectItem>
                                    <SelectItem value="7d" className="text-xs">{t('7 Days')}</SelectItem>
                                    <SelectItem value="30d" className="text-xs">{t('30 Days')}</SelectItem>
                                </SelectContent>
                            </Select>

                            <Select value={chartType} onValueChange={setChartType}>
                                <SelectTrigger className="w-[85px] h-7 text-xs">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="line" className="text-xs">{t('Line')}</SelectItem>
                                    <SelectItem value="area" className="text-xs">{t('Area')}</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    {/* Sensor Type Toggles */}
                    <div className="flex flex-wrap gap-2">
                        {availableSensorTypes.map((type) => {
                            const config = sensorTypeConfigs[type] || {};
                            const isActive = activeSensorTypes.has(type);
                            return (
                                <button
                                    key={type}
                                    onClick={() => toggleSensorType(type)}
                                    className={`px-3 py-1.5 text-xs rounded-md border transition-all ${isActive
                                        ? 'bg-teal-600 text-white border-teal-600 shadow-sm'
                                        : 'bg-white text-gray-700 border-gray-300 hover:border-teal-400'
                                        }`}
                                >
                                    {config.icon} {type.charAt(0).toUpperCase() + type.slice(1)}
                                </button>
                            );
                        })}
                    </div>
                </div>
            </CardHeader>

            <CardContent className="pt-0 px-3 pb-3">
                {loading ? (
                    <div className="flex items-center justify-center h-[300px]">
                        <div className="text-center">
                            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600 mb-2"></div>
                            <p className="text-sm text-gray-600">{t('Loading data...')}</p>
                        </div>
                    </div>
                ) : error ? (
                    <div className="flex flex-col items-center justify-center h-[300px] gap-4">
                        <p className="text-red-600 text-sm">{error}</p>
                    </div>
                ) : (
                    <div className={`space-y-6 ${viewMode === 'multi' ? 'grid grid-cols-1 lg:grid-cols-2 gap-6' : ''}`}>
                        {Array.from(activeSensorTypes).map(sensorType => (
                            <SingleChart
                                key={sensorType}
                                sensorType={sensorType}
                                measurements={measurementsBySensor[sensorType] || []}
                                config={sensorTypeConfigs[sensorType]}
                            />
                        ))}
                    </div>
                )}

                {lastUpdate && (
                    <div className="mt-4 text-xs text-gray-500 text-center">
                        {t('Last updated')}: {lastUpdate.toLocaleTimeString()}
                    </div>
                )}
            </CardContent>
        </Card>
    );
};

export default EnvironmentChart;