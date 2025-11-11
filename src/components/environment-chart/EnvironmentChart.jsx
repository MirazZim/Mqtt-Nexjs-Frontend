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
import { usePathname } from 'next/navigation';  // ✅ ADD THIS
import { useTranslation } from '../../app/i18n/client.js';  // ✅ ADD THIS

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

const EnvironmentChart = ({ selectedLocation }) => {
    const { user, socket } = useContext(AuthContext);

    // ✅ ADD THESE LINES
    const pathname = usePathname();
    const lng = pathname.split("/")[1];
    const { t } = useTranslation(lng, "chart");

    const isMountedRef = useRef(true);
    const [availableSensors, setAvailableSensors] = useState([]);
    const [selectedSensorType, setSelectedSensorType] = useState('temperature');
    const [currentSensor, setCurrentSensor] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [selectedPeriod, setSelectedPeriod] = useState('1h');
    const [chartType, setChartType] = useState('area');
    const [measurements, setMeasurements] = useState([]);
    const [lastUpdate, setLastUpdate] = useState(null);

    // ✅ UPDATE: sensorTypeConfigs with translation function
    const sensorTypeConfigs = useMemo(() => ({
        temperature: { label: t("Temperature (°C)"), color: "#ef4444", icon: "🌡️" },
        humidity: { label: t("Humidity (%)"), color: "#3b82f6", icon: "💧" },
        airflow: { label: t("Airflow (m/s)"), color: "#8b5cf6", icon: "💨" },
        co2_level: { label: t("CO2 (ppm)"), color: "#f59e0b", icon: "🫧" },
        sugar_level: { label: t("Sugar (Brix)"), color: "#ec4899", icon: "🍬" },
        bowl_temp: { label: t("Bowl Temp (°C)"), color: "#14b8a6", icon: "🍲" },
        sonar_distance: { label: t("Distance (cm)"), color: "#06b6d4", icon: "📏" }
    }), [t]);

    // Mount tracking
    useEffect(() => {
        isMountedRef.current = true;
        return () => { isMountedRef.current = false; };
    }, []);

    useEffect(() => {
        console.log(`📊 [EnvironmentChart] Location changed to: ${selectedLocation}`);

        // Reset state when location changes
        setMeasurements([]);
        setCurrentSensor(null);
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
                // ✅ CORRECT: Pass location as query parameter
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
                    // ❌ REMOVE THIS LINE - Backend already filtered!
                    // const locationSensors = result.sensors.filter(
                    //     sensor => sensor.location === selectedLocation
                    // );

                    // ✅ CORRECT: Use sensors directly (already filtered by backend)
                    console.log(`📊 Found ${result.sensors.length} sensors for ${selectedLocation}`);
                    setAvailableSensors(result.sensors);
                }
            } catch (err) {
                if (isMountedRef.current) setError(`${t('Failed')}: ${err.message}`);
            }
        };

        fetchSensors();
    }, [user, selectedLocation, t]);

    // Available sensor types
    const availableSensorTypes = useMemo(() => {
        const types = new Set();
        availableSensors.forEach(sensor => {
            if (sensor.type_code && sensor.is_active) types.add(sensor.type_code.toLowerCase());
        });
        return Array.from(types);
    }, [availableSensors]);

    // Find sensor with data
    useEffect(() => {
        const findSensor = async () => {
            if (availableSensors.length === 0 || !selectedSensorType || !user?.token) {
                setCurrentSensor(null);
                return;
            }

            const sensorsOfType = availableSensors
                .filter(s => s.type_code?.toLowerCase() === selectedSensorType.toLowerCase() && s.is_active)
                .sort((a, b) => a.id - b.id);

            if (sensorsOfType.length === 0) {
                setCurrentSensor(null);
                return;
            }

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
                            if (isMountedRef.current) setCurrentSensor(sensor);
                            return;
                        }
                    }
                } catch (err) {
                    console.error(`Error checking sensor ${sensor.id}:`, err);
                }
            }

            // Fallback to first sensor
            if (isMountedRef.current) setCurrentSensor(sensorsOfType[0]);
        };

        findSensor();
    }, [selectedSensorType, availableSensors, user]);

    // Fetch historical data
    useEffect(() => {
        const fetchData = async () => {
            if (!currentSensor || !user?.token) {
                setLoading(false);
                return;
            }

            try {
                setLoading(true);
                setError(null);

                const response = await fetch(
                    `${API_BASE_URL}/api/environment/${currentSensor.id}?period=${selectedPeriod}`,
                    {
                        headers: { 'Authorization': `Bearer ${user.token}`, 'Content-Type': 'application/json' },
                        cache: 'no-store',
                        next: { revalidate: 0 }
                    }
                );

                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                const result = await response.json();

                if (result.status === 'success' && isMountedRef.current) {
                    setMeasurements(result.data || []);
                    setLastUpdate(new Date());
                } else if (isMountedRef.current) {
                    setError(result.message || t('No data for this period'));
                    setMeasurements([]);
                }
            } catch (err) {
                if (isMountedRef.current) {
                    setError(`${t('Failed')}: ${err.message}`);
                    setMeasurements([]);
                }
            } finally {
                if (isMountedRef.current) setLoading(false);
            }
        };

        fetchData();
    }, [currentSensor, selectedPeriod, user, t]);

    // Real-time Socket.IO updates
    useEffect(() => {
        if (!socket || !currentSensor || !selectedLocation) return;

        console.log(`🔌 Real-time updates: sensor_${currentSensor.id} in ${selectedLocation}`);

        // ✅ ADD: Join location-specific room
        socket.emit('joinLocation', selectedLocation);
        socket.emit('joinSensor', currentSensor.id);

        const handleSensorData = (data) => {
            // ✅ ADD: Filter by location
            if (data.location !== selectedLocation) {
                console.log(`📊 Ignoring data from different location: ${data.location}`);
                return;
            }

            if (data.sensorId === currentSensor.id && isMountedRef.current) {
                console.log(`📊 Live update for ${selectedLocation}: ${data.value}`);

                setMeasurements(prev => {
                    const newPoint = {
                        timestamp: data.timestamp,
                        value: parseFloat(data.value),
                        quality: data.quality || 'good'
                    };

                    const updated = [...prev, newPoint];

                    const limits = {
                        '1h': 360,
                        '6h': 720,
                        '24h': 1440,
                        '7d': 2016,
                        '30d': 4320
                    };

                    const limit = limits[selectedPeriod] || 1000;
                    return updated.slice(-limit);
                });

                setLastUpdate(new Date());
            }
        };

        socket.on('sensorData', handleSensorData);

        return () => {
            socket.emit('leaveLocation', selectedLocation);
            socket.emit('leaveSensor', currentSensor.id);
            socket.off('sensorData', handleSensorData);
        };
    }, [socket, currentSensor, selectedPeriod, selectedLocation])

    // Process chart data with sampling
    const { chartData, yAxisDomain } = useMemo(() => {
        if (!measurements || measurements.length === 0) {
            return { chartData: [], yAxisDomain: [0, 100] };
        }

        const maxPoints = 150;
        const sampledMeasurements = measurements.length > maxPoints
            ? measurements.filter((_, index) => index % Math.ceil(measurements.length / maxPoints) === 0)
            : measurements;

        const processedData = sampledMeasurements
            .map(m => {
                const timestamp = new Date(m.timestamp).getTime();
                const value = parseFloat(m.value);
                if (!Number.isFinite(timestamp) || !Number.isFinite(value)) return null;
                return { timestamp, value: Math.round(value * 100) / 100 };
            })
            .filter(Boolean)
            .sort((a, b) => a.timestamp - b.timestamp);

        const values = processedData.map(d => d.value);
        let domain = [0, 100];
        if (values.length > 0) {
            const min = Math.min(...values);
            const max = Math.max(...values);
            const padding = Math.max((max - min) * 0.1, 2);
            domain = [Math.floor(min - padding), Math.ceil(max + padding)];
        }

        return { chartData: processedData, yAxisDomain: domain };
    }, [measurements]);

    // Format X-axis
    const formatXAxisTick = useCallback((tickItem) => {
        const date = new Date(tickItem);
        if (['1h', '6h', '24h'].includes(selectedPeriod)) {
            return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        }
        return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }, [selectedPeriod]);

    // Download CSV
    const downloadCSV = useCallback(() => {
        if (measurements.length === 0) return alert(t('No data to download'));

        const headers = ['Timestamp', 'Date', 'Time', 'Sensor', 'Value', 'Unit'];
        const csvData = [
            headers.join(','),
            ...measurements.map(m => {
                const date = new Date(m.timestamp);
                return [
                    `"${m.timestamp}"`,
                    `"${date.toLocaleDateString()}"`,
                    `"${date.toLocaleTimeString()}"`,
                    `"${currentSensor?.sensor_name || selectedSensorType}"`,
                    m.value,
                    `"${currentSensor?.unit || ''}"`
                ].join(',');
            })
        ].join('\n');

        const blob = new Blob([csvData], { type: 'text/csv' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `${currentSensor?.sensor_name || selectedSensorType}-${selectedPeriod}-${new Date().toISOString().split('T')[0]}.csv`;
        link.click();
        URL.revokeObjectURL(link.href);
    }, [measurements, selectedSensorType, currentSensor, selectedPeriod, t]);

    const handleRefresh = useCallback(() => {
        if (currentSensor && user) {
            setLoading(true);
            setError(null);
            setMeasurements([]);
        }
    }, [currentSensor, user]);

    const sensorConfig = useMemo(() => {
        return sensorTypeConfigs[selectedSensorType] || sensorTypeConfigs.temperature;
    }, [selectedSensorType, sensorTypeConfigs]);

    const shouldRenderChart = chartData.length > 0 && !loading && !error;

    // ✅ Custom Tooltip Component (moved inside to access t())
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

    // ✅ Memoized Chart Component
    const MemoizedChart = React.memo(({ data, chartType, sensorConfig, yAxisDomain, formatXAxisTick }) => {
        const ChartComponent = chartType === 'area' ? AreaChart : LineChart;

        return (
            <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <ChartComponent data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                        <XAxis
                            dataKey="timestamp"
                            tickFormatter={formatXAxisTick}
                            stroke="#888888"
                            fontSize={10}
                            tickLine={false}
                            axisLine={false}
                        />
                        <YAxis domain={yAxisDomain} tickLine={false} axisLine={false} fontSize={10} width={50} />
                        <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#888', strokeWidth: 1, strokeDasharray: '5 5' }} />
                        <Legend />
                        {chartType === 'area' ? (
                            <Area
                                type="monotone"
                                dataKey="value"
                                stroke={sensorConfig.color}
                                fill={sensorConfig.color}
                                fillOpacity={0.3}
                                strokeWidth={2}
                                name={sensorConfig.label}
                                connectNulls={true}
                                dot={false}
                                isAnimationActive={false}
                            />
                        ) : (
                            <Line
                                type="monotone"
                                dataKey="value"
                                stroke={sensorConfig.color}
                                strokeWidth={2}
                                name={sensorConfig.label}
                                connectNulls={true}
                                dot={false}
                                isAnimationActive={false}
                            />
                        )}
                    </ChartComponent>
                </ResponsiveContainer>
            </div>
        );
    });

    MemoizedChart.displayName = 'MemoizedChart';

    return (
        <Card className="w-full">
            <CardHeader>
                <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                        <span className="text-xs font-medium">{sensorConfig.icon}</span>
                        <Select value={selectedSensorType} onValueChange={setSelectedSensorType}>
                            <SelectTrigger className="w-[150px] h-7 text-xs">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {availableSensorTypes.map((type) => {
                                    const config = sensorTypeConfigs[type] || {};
                                    return (
                                        <SelectItem key={type} value={type} className="text-xs">
                                            {config.icon} {type.charAt(0).toUpperCase() + type.slice(1)}
                                        </SelectItem>
                                    );
                                })}
                            </SelectContent>
                        </Select>
                        {currentSensor && (
                            <span className="text-xs text-gray-500">({currentSensor.sensor_name})</span>
                        )}
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

                        <button
                            onClick={handleRefresh}
                            disabled={loading}
                            className="px-2 py-1 text-xs rounded border border-gray-300 hover:bg-gray-50 disabled:opacity-50"
                            title={t('Refresh')}
                        >
                            🔄
                        </button>

                        <button
                            onClick={downloadCSV}
                            disabled={loading || measurements.length === 0}
                            className="px-2 py-1 text-xs rounded border border-gray-300 hover:bg-gray-50 disabled:opacity-50"
                            title={t('Download CSV')}
                        >
                            📥
                        </button>
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
                        <button onClick={handleRefresh} className="px-4 py-2 text-sm rounded-md bg-teal-600 text-white hover:bg-teal-700">
                            {t('Retry')}
                        </button>
                    </div>
                ) : !currentSensor ? (
                    <div className="flex items-center justify-center h-[300px]">
                        <p className="text-gray-600 text-sm">{t('No sensor found')} {selectedSensorType}</p>
                    </div>
                ) : measurements.length === 0 ? (
                    <div className="flex items-center justify-center h-[300px]">
                        <p className="text-gray-600 text-sm">{t('No data for this period')}</p>
                    </div>
                ) : shouldRenderChart ? (
                    <MemoizedChart
                        data={chartData}
                        chartType={chartType}
                        sensorConfig={sensorConfig}
                        yAxisDomain={yAxisDomain}
                        formatXAxisTick={formatXAxisTick}
                    />
                ) : null}

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

                {lastUpdate && (
                    <div className="mt-2 text-xs text-gray-500 text-center">
                        {t('Last updated')}: {lastUpdate.toLocaleTimeString()}
                    </div>
                )}
            </CardContent>
        </Card>
    );
};

export default EnvironmentChart;
