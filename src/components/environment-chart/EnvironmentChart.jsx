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
} from 'recharts';
import AuthContext from '../../context/AuthContext';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "../ui/card";
import {
    ChartContainer,
    ChartTooltip,
    ChartTooltipContent,
    ChartLegend,
    ChartLegendContent,
} from "../ui/chart";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "../ui/select";

// Enhanced throttle utility function
const throttle = (func, delay) => {
    let timeoutId;
    let lastExecTime = 0;
    return function (...args) {
        const currentTime = Date.now();
        if (currentTime - lastExecTime > delay) {
            func.apply(this, args);
            lastExecTime = currentTime;
        } else {
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => {
                func.apply(this, args);
                lastExecTime = Date.now();
            }, delay - (currentTime - lastExecTime));
        }
    };
};

// Chart configuration for shadcn
const chartConfig = {
    temperature: {
        label: "Temperature (°C)",
        color: "hsl(var(--chart-1))",
    },
    humidity: {
        label: "Humidity (%)",
        color: "#4cc9f0",
    },
    airflow: {
        label: "Airflow (m/s)",
        color: "#4361ee",
    },
};

// Memoized Chart Component for Performance
const MemoizedChart = React.memo(({
    data,
    chartType,
    selectedMetrics,
    tempDomain,
    humidityDomain,
    airflowDomain,
    formatXAxisTick,
    chartKey
}) => {
    const ChartComponent = chartType === 'area' ? AreaChart : LineChart;

    return (
        <ChartContainer config={chartConfig} className="h-[250px] w-full">
            <ChartComponent
                key={chartKey}
                data={data}
                margin={{ top: 10, right: 20, left: 20, bottom: 10 }}
            >
                <defs>
                    <linearGradient id="fillTemperature" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#f72585" stopOpacity={0.8} />
                        <stop offset="95%" stopColor="#f72585" stopOpacity={0.1} />
                    </linearGradient>
                    <linearGradient id="fillHumidity" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#4cc9f0" stopOpacity={0.8} />
                        <stop offset="95%" stopColor="#4cc9f0" stopOpacity={0.1} />
                    </linearGradient>
                    <linearGradient id="fillAirflow" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#4361ee" stopOpacity={0.8} />
                        <stop offset="95%" stopColor="#4361ee" stopOpacity={0.1} />
                    </linearGradient>
                </defs>

                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" vertical={false} />

                <XAxis
                    dataKey="timestamp"
                    type="number"
                    scale="time"
                    domain={['dataMin', 'dataMax']}
                    tickFormatter={formatXAxisTick}
                    tickLine={false}
                    axisLine={false}
                    tickMargin={4}
                    minTickGap={30}
                    className="text-[10px]"
                    height={30}
                />

                {/* Dynamic temperature Y-axis (left) */}
                {selectedMetrics.temperature && (
                    <YAxis
                        yAxisId="temperature"
                        orientation="left"
                        domain={tempDomain}
                        tickFormatter={(value) => `${Math.round(value * 10) / 10}°C`}
                        tickLine={false}
                        axisLine={false}
                        className="text-[10px]"
                        width={50}
                    />
                )}

                {/* Dynamic humidity Y-axis (right) */}
                {selectedMetrics.humidity && (
                    <YAxis
                        yAxisId="humidity"
                        orientation="right"
                        domain={humidityDomain}
                        tickFormatter={(value) => `${Math.round(value)}%`}
                        tickLine={false}
                        axisLine={false}
                        className="text-xs"
                        width={60}
                    />
                )}

                {/* Airflow Y-axis (uses temperature axis if no temperature selected) */}
                {selectedMetrics.airflow && !selectedMetrics.temperature && (
                    <YAxis
                        yAxisId="airflow"
                        orientation="left"
                        domain={airflowDomain}
                        tickFormatter={(value) => `${Math.round(value * 10) / 10} m/s`}
                        tickLine={false}
                        axisLine={false}
                        className="text-xs"
                        width={60}
                    />
                )}

                <ChartTooltip
                    content={
                        <ChartTooltipContent
                            labelFormatter={(value) => new Date(value).toLocaleString()}
                            indicator="dot"
                        />
                    }
                />
                <ChartLegend content={<ChartLegendContent />} />

                {/* Temperature line/area */}
                {selectedMetrics.temperature && (
                    chartType === 'area' ? (
                        <Area
                            yAxisId="temperature"
                            type="monotone"
                            dataKey="temperature"
                            stroke="var(--color-temperature)"
                            fill="url(#fillTemperature)"
                            strokeWidth={2}
                            dot={false}
                            connectNulls={false}
                        />
                    ) : (
                        <Line
                            yAxisId="temperature"
                            type="monotone"
                            dataKey="temperature"
                            stroke="var(--color-temperature)"
                            strokeWidth={2}
                            dot={false}
                            connectNulls={false}
                        />
                    )
                )}

                {/* Humidity line/area */}
                {selectedMetrics.humidity && (
                    chartType === 'area' ? (
                        <Area
                            yAxisId="humidity"
                            type="monotone"
                            dataKey="humidity"
                            stroke="var(--color-humidity)"
                            fill="url(#fillHumidity)"
                            strokeWidth={2}
                            dot={false}
                            connectNulls={false}
                        />
                    ) : (
                        <Line
                            yAxisId="humidity"
                            type="monotone"
                            dataKey="humidity"
                            stroke="var(--color-humidity)"
                            strokeWidth={2}
                            dot={false}
                            connectNulls={false}
                        />
                    )
                )}

                {/* Airflow line/area */}
                {selectedMetrics.airflow && (
                    chartType === 'area' ? (
                        <Area
                            yAxisId={selectedMetrics.temperature ? "temperature" : "airflow"}
                            type="monotone"
                            dataKey="airflow"
                            stroke="var(--color-airflow)"
                            fill="url(#fillAirflow)"
                            strokeWidth={2}
                            dot={false}
                            connectNulls={false}
                        />
                    ) : (
                        <Line
                            yAxisId={selectedMetrics.temperature ? "temperature" : "airflow"}
                            type="monotone"
                            dataKey="airflow"
                            stroke="var(--color-airflow)"
                            strokeWidth={2}
                            dot={false}
                            connectNulls={false}
                        />
                    )
                )}
            </ChartComponent>
        </ChartContainer>
    );
});

const EnvironmentChart = ({ selectedLocation }) => {
    const { user, socket } = useContext(AuthContext);
    const chartContainerRef = useRef(null);
    const isInitialMount = useRef(true);

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [selectedDays, setSelectedDays] = useState(5); // Default to 5 minutes
    const [chartType, setChartType] = useState('area');
    const [selectedMetrics, setSelectedMetrics] = useState({
        temperature: true,
        humidity: true,
        airflow: false
    });
    const [measurements, setMeasurements] = useState([]);
    const [lastUpdate, setLastUpdate] = useState(null);
    const [isConnected, setIsConnected] = useState(false);

    // Stable chart key for React optimization
    const chartKey = useMemo(() =>
        `${selectedLocation}-${selectedDays}-${chartType}-${Object.entries(selectedMetrics).filter(([, v]) => v).map(([k]) => k).join('-')}`,
        [selectedLocation, selectedDays, selectedMetrics, chartType]
    );

    // Data validation utilities (memoized)
    const validateAndCleanTimestamp = useCallback((timestamp) => {
        const date = new Date(timestamp).getTime();
        return Number.isFinite(date) && date > 0;
    }, []);

    const cleanNumericValue = useCallback((value) => {
        if (value === null || value === undefined) return null;
        const numValue = parseFloat(value);
        return Number.isFinite(numValue) ? numValue : null;
    }, []);

    const validateAndCleanData = useCallback((data) => {
        if (!Array.isArray(data)) {
            console.warn('Invalid data format - not an array');
            return [];
        }

        return data
            .filter(measurement => {
                if (!measurement || !measurement.created_at) {
                    return false;
                }
                return validateAndCleanTimestamp(measurement.created_at);
            })
            .map(measurement => {
                const cleanMeasurement = { ...measurement };
                ['temperature', 'humidity', 'airflow'].forEach(key => {
                    cleanMeasurement[key] = cleanNumericValue(measurement[key]);
                });
                return cleanMeasurement;
            });
    }, [validateAndCleanTimestamp, cleanNumericValue]);

    // Filter data for last 5 minutes (super fast!)
    const filterLast5Minutes = useCallback((data) => {
        const now = Date.now();
        const fiveMinutesAgo = now - (5 * 60 * 1000); // 5 minutes in milliseconds

        return data.filter(measurement => {
            const timestamp = new Date(measurement.created_at).getTime();
            return timestamp >= fiveMinutesAgo;
        });
    }, []);

    // Enhanced data processing with intelligent sampling and Y-axis calculation
    const { chartData, axisDomains } = useMemo(() => {
        if (!measurements || measurements.length === 0) {
            return {
                chartData: [],
                axisDomains: {
                    tempDomain: [0, 100],
                    humidityDomain: [0, 100],
                    airflowDomain: [0, 10]
                }
            };
        }

        // Filter data based on selected time period
        let filteredMeasurements = measurements;
        if (selectedDays === 5) { // 5 minutes
            filteredMeasurements = filterLast5Minutes(measurements);
        }

        // Enhanced performance with adaptive sampling
        const maxPoints = selectedDays === 5 ? 50 : // 5 minutes - keep all points
            selectedDays <= 1 ? 200 :
                selectedDays <= 7 ? 150 : 100;

        const sampledMeasurements = filteredMeasurements.length > maxPoints
            ? filteredMeasurements.filter((_, index) => index % Math.ceil(filteredMeasurements.length / maxPoints) === 0)
            : filteredMeasurements;

        const processedData = sampledMeasurements
            .map(measurement => {
                const timestamp = new Date(measurement.created_at).getTime();
                if (!Number.isFinite(timestamp)) return null;

                const dataPoint = {
                    timestamp,
                    time: new Date(timestamp).toLocaleTimeString(),
                    fullTime: new Date(timestamp).toLocaleString()
                };

                // Add metrics with validation
                if (selectedMetrics.temperature) {
                    const temp = parseFloat(measurement.temperature);
                    dataPoint.temperature = (Number.isFinite(temp) && temp > -50 && temp < 100)
                        ? Math.round(temp * 100) / 100 : null;
                }

                if (selectedMetrics.humidity) {
                    const humid = parseFloat(measurement.humidity);
                    dataPoint.humidity = (Number.isFinite(humid) && humid >= 0 && humid <= 100)
                        ? Math.round(humid * 100) / 100 : null;
                }

                if (selectedMetrics.airflow) {
                    const flow = parseFloat(measurement.airflow);
                    dataPoint.airflow = (Number.isFinite(flow) && flow >= 0 && flow <= 10)
                        ? Math.round(flow * 100) / 100 : null;
                }

                return dataPoint;
            })
            .filter(Boolean)
            .sort((a, b) => a.timestamp - b.timestamp);

        // Intelligent Y-axis domain calculations
        const temps = processedData.map(d => d.temperature).filter(v => v !== null);
        const humidities = processedData.map(d => d.humidity).filter(v => v !== null);
        const airflows = processedData.map(d => d.airflow).filter(v => v !== null);

        // Temperature domain with intelligent padding
        let tempDomain = [0, 100];
        if (temps.length > 0) {
            const tempMin = Math.min(...temps);
            const tempMax = Math.max(...temps);
            const tempRange = tempMax - tempMin;
            const tempPadding = Math.max(tempRange * 0.1, 2);
            tempDomain = [tempMin - tempPadding, tempMax + tempPadding];
        }

        // Humidity domain - adaptive based on actual range
        let humidityDomain = [0, 100];
        if (humidities.length > 0) {
            const humidMin = Math.min(...humidities);
            const humidMax = Math.max(...humidities);
            const humidRange = humidMax - humidMin;

            if (humidRange < 20) {
                const center = (humidMin + humidMax) / 2;
                humidityDomain = [Math.max(0, center - 10), Math.min(100, center + 10)];
            } else {
                const humidPadding = humidRange * 0.05;
                humidityDomain = [
                    Math.max(0, humidMin - humidPadding),
                    Math.min(100, humidMax + humidPadding)
                ];
            }
        }

        // Airflow domain
        let airflowDomain = [0, 10];
        if (airflows.length > 0) {
            const airflowMin = Math.min(...airflows);
            const airflowMax = Math.max(...airflows);
            const airflowRange = airflowMax - airflowMin;
            const airflowPadding = Math.max(airflowRange * 0.1, 0.5);
            airflowDomain = [
                Math.max(0, airflowMin - airflowPadding),
                airflowMax + airflowPadding
            ];
        }

        return {
            chartData: processedData,
            axisDomains: {
                tempDomain,
                humidityDomain,
                airflowDomain
            }
        };
    }, [measurements, selectedMetrics, selectedDays, filterLast5Minutes]);

    // Enhanced throttled real-time updates (faster for 5 minutes)
    const throttledMeasurementUpdate = useCallback(
        throttle((newMeasurement) => {
            const cleanedMeasurement = {
                ...newMeasurement,
                temperature: cleanNumericValue(newMeasurement.temperature),
                humidity: cleanNumericValue(newMeasurement.humidity),
                airflow: cleanNumericValue(newMeasurement.airflow)
            };

            setMeasurements(prevMeasurements => {
                const maxDataPoints = selectedDays === 5 ? 100 : // 5 minutes - smaller buffer
                    selectedDays <= 1 ? 500 : 200;
                const updatedMeasurements = [...prevMeasurements, cleanedMeasurement];
                return updatedMeasurements.slice(-maxDataPoints);
            });

            setLastUpdate(new Date());
        }, selectedDays === 5 ? 500 : selectedDays <= 1 ? 1000 : 2000), // Faster updates for 5 minutes
        [cleanNumericValue, selectedDays]
    );

    // Socket connection and data management
    useEffect(() => {
        if (!socket || !selectedLocation || !user) {
            setIsConnected(false);
            setMeasurements([]);
            return;
        }

        setLoading(true);
        setError(null);
        setIsConnected(true);
        isInitialMount.current = true;

        socket.emit('joinLocation', selectedLocation);
        socket.emit('requestChartData', { location: selectedLocation, days: selectedDays });

        const handleChartDataUpdate = (data) => {
            if (data.location === selectedLocation) {
                const cleanedData = validateAndCleanData(data.measurements || []);
                setMeasurements(cleanedData);
                setError(null);
                setLoading(false);
                setLastUpdate(new Date());
                isInitialMount.current = false;
            }
        };

        const handleNewMeasurement = (newMeasurement) => {
            if (!newMeasurement || !validateAndCleanTimestamp(newMeasurement.created_at)) {
                return;
            }
            throttledMeasurementUpdate(newMeasurement);
        };

        const handleChartError = () => {
            setError('Failed to load chart data');
            setLoading(false);
        };

        socket.on('chartDataUpdate', handleChartDataUpdate);
        socket.on('newMeasurement', handleNewMeasurement);
        socket.on('chartError', handleChartError);

        return () => {
            socket.emit('leaveLocation', selectedLocation);
            socket.off('chartDataUpdate', handleChartDataUpdate);
            socket.off('newMeasurement', handleNewMeasurement);
            socket.off('chartError', handleChartError);
            throttledMeasurementUpdate.cancel?.();
        };
    }, [socket, selectedLocation, user, selectedDays, validateAndCleanData, validateAndCleanTimestamp, throttledMeasurementUpdate]);

    // Event handlers
    const handleMetricToggle = (metric) => {
        setSelectedMetrics(prev => ({
            ...prev,
            [metric]: !prev[metric]
        }));
    };

    const handleChartTypeChange = (type) => {
        setChartType(type);
    };

    const handleRefresh = () => {
        if (socket && selectedLocation && user) {
            setLoading(true);
            setError(null);
            socket.emit('requestChartData', { location: selectedLocation, days: selectedDays });
        }
    };

    // CSV Download function
    const downloadCSV = useCallback(() => {
        if (measurements.length === 0) {
            alert('No data available to download');
            return;
        }

        const headers = ['Timestamp', 'Date', 'Time', 'Location'];
        if (selectedMetrics.temperature) headers.push('Temperature (°C)');
        if (selectedMetrics.humidity) headers.push('Humidity (%)');
        if (selectedMetrics.airflow) headers.push('Airflow (m/s)');

        const csvData = [
            headers.join(','),
            ...measurements.map(measurement => {
                const date = new Date(measurement.created_at);
                const row = [
                    `"${measurement.created_at}"`,
                    `"${date.toLocaleDateString()}"`,
                    `"${date.toLocaleTimeString()}"`,
                    `"${selectedLocation}"`
                ];

                if (selectedMetrics.temperature) row.push(measurement.temperature || 'N/A');
                if (selectedMetrics.humidity) row.push(measurement.humidity || 'N/A');
                if (selectedMetrics.airflow) row.push(measurement.airflow || 'N/A');

                return row.join(',');
            })
        ].join('\n');

        const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        const filename = `environment-${selectedLocation.replace(/\s+/g, '-').toLowerCase()}-${selectedDays === 5 ? '5min' : selectedDays + 'days'}-${new Date().toISOString().split('T')[0]}.csv`;

        link.setAttribute('href', url);
        link.setAttribute('download', filename);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }, [measurements, selectedLocation, selectedDays, selectedMetrics]);

    // Memoized Format X-axis ticks (enhanced for 5 minutes)
    const formatXAxisTick = useCallback((tickItem) => {
        if (selectedDays === 5) { // 5 minutes
            return new Date(tickItem).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit'
            });
        } else if (selectedDays === 1) {
            return new Date(tickItem).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit'
            });
        } else if (selectedDays === 7) {
            return new Date(tickItem).toLocaleDateString([], {
                month: 'short',
                day: 'numeric',
                hour: '2-digit'
            });
        } else {
            return new Date(tickItem).toLocaleDateString([], {
                month: 'short',
                day: 'numeric'
            });
        }
    }, [selectedDays]);

    const shouldRenderChart = chartData.length > 0 && !loading && !error;

    return (
        <Card className="w-full">
            <CardHeader >
                <div className="flex items-center justify-between flex-wrap">

                    {/* Center: Metric Toggles */}
                    <div className="flex items-center gap-2 flex-wrap">
                        <label className="flex items-center gap-1 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={selectedMetrics.temperature}
                                onChange={() => handleMetricToggle('temperature')}
                                className="w-3 h-3 rounded border-gray-300"
                            />
                            <span className="text-xs">🌡️ Temp</span>
                        </label>
                        <label className="flex items-center gap-1 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={selectedMetrics.humidity}
                                onChange={() => handleMetricToggle('humidity')}
                                className="w-3 h-3 rounded border-gray-300"
                            />
                            <span className="text-xs">💧 Humid</span>
                        </label>
                        <label className="flex items-center gap-1 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={selectedMetrics.airflow}
                                onChange={() => handleMetricToggle('airflow')}
                                className="w-3 h-3 rounded border-gray-300"
                            />
                            <span className="text-xs">💨 Air</span>
                        </label>
                    </div>

                    {/* Right: Controls */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                        {/* Time Range Selector */}
                        <Select
                            value={selectedDays.toString()}
                            onValueChange={(value) => setSelectedDays(Number(value))}
                        >
                            <SelectTrigger className="w-[110px] h-7 text-xs">
                                <SelectValue placeholder="Range" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="5" className="text-xs">⚡ 5 Min</SelectItem>
                                <SelectItem value="1" className="text-xs">24 Hr</SelectItem>
                                <SelectItem value="7" className="text-xs">7 Days</SelectItem>
                                <SelectItem value="30" className="text-xs">30 Days</SelectItem>
                            </SelectContent>
                        </Select>

                        {/* Chart Type Selector */}
                        <Select value={chartType} onValueChange={setChartType}>
                            <SelectTrigger className="w-[85px] h-7 text-xs">
                                <SelectValue placeholder="Type" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="line" className="text-xs">Line</SelectItem>
                                <SelectItem value="area" className="text-xs">Area</SelectItem>
                            </SelectContent>
                        </Select>

                        {/* Refresh Button */}
                        <button
                            onClick={handleRefresh}
                            disabled={loading}
                            className="px-2 py-1 text-xs rounded border border-gray-300 hover:bg-gray-50 disabled:opacity-50"
                            title="Refresh data"
                        >
                            🔄
                        </button>

                        {/* Download CSV Button */}
                        <button
                            onClick={downloadCSV}
                            disabled={loading || measurements.length === 0}
                            className="px-2 py-1 text-xs rounded border border-gray-300 hover:bg-gray-50 disabled:opacity-50"
                            title="Download CSV"
                        >
                            📥
                        </button>
                    </div>
                </div>
            </CardHeader>

            <CardContent className="pt-0 px-3 pb-3" ref={chartContainerRef}>
                {loading ? (
                    <div className="flex items-center justify-center h-[400px]">
                        <div className="text-center">
                            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600 mb-2"></div>
                            <p className="text-sm text-gray-600">Loading chart data...</p>
                        </div>
                    </div>
                ) : error ? (
                    <div className="flex flex-col items-center justify-center h-[400px] gap-4">
                        <p className="text-red-600">{error}</p>
                        <button
                            onClick={handleRefresh}
                            className="px-4 py-2 text-sm font-medium rounded-md bg-teal-600 text-white hover:bg-teal-700 transition-colors"
                        >
                            Retry
                        </button>
                    </div>
                ) : measurements.length === 0 ? (
                    <div className="flex items-center justify-center h-[400px]">
                        <p className="text-gray-600">No data available for the selected period</p>
                    </div>
                ) : shouldRenderChart ? (
                    <MemoizedChart
                        data={chartData}
                        chartType={chartType}
                        selectedMetrics={selectedMetrics}
                        tempDomain={axisDomains.tempDomain}
                        humidityDomain={axisDomains.humidityDomain}
                        airflowDomain={axisDomains.airflowDomain}
                        formatXAxisTick={formatXAxisTick}
                        chartKey={chartKey}
                    />
                ) : null}
            </CardContent>
        </Card>
    );
};

export default EnvironmentChart;
