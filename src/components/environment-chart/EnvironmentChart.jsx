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

// Memoized Chart Component for Performance
const MemoizedChart = React.memo(({
    data,
    chartType,
    selectedMetrics,
    tempDomain,
    humidityDomain,
    airflowDomain,
    formatXAxisTick,
    CustomTooltip,
    chartKey
}) => {
    const ChartComponent = chartType === 'area' ? AreaChart : LineChart;

    return (
        <div className="chart-wrapper stable-chart-wrapper">
            <ResponsiveContainer width="100%" height={400}>
                <ChartComponent
                    key={chartKey}
                    data={data}
                    margin={{ top: 20, right: 60, left: 20, bottom: 20 }}
                >
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis
                        dataKey="timestamp"
                        type="number"
                        scale="time"
                        domain={['dataMin', 'dataMax']}
                        tickFormatter={formatXAxisTick}
                        stroke="#666"
                        fontSize={11}
                        minTickGap={30} // Tighter spacing for 5-minute view
                    />

                    {/* Dynamic temperature Y-axis (left) */}
                    {selectedMetrics.temperature && (
                        <YAxis
                            yAxisId="temperature"
                            orientation="left"
                            domain={tempDomain}
                            stroke="#f72585"
                            tickFormatter={(value) => `${Math.round(value * 10) / 10}°C`}
                            fontSize={12}
                            width={60}
                        />
                    )}

                    {/* Dynamic humidity Y-axis (right) */}
                    {selectedMetrics.humidity && (
                        <YAxis
                            yAxisId="humidity"
                            orientation="right"
                            domain={humidityDomain}
                            stroke="#4cc9f0"
                            tickFormatter={(value) => `${Math.round(value)}%`}
                            fontSize={12}
                            width={60}
                        />
                    )}

                    {/* Airflow Y-axis (uses temperature axis if no temperature selected) */}
                    {selectedMetrics.airflow && !selectedMetrics.temperature && (
                        <YAxis
                            yAxisId="airflow"
                            orientation="left"
                            domain={airflowDomain}
                            stroke="#4361ee"
                            tickFormatter={(value) => `${Math.round(value * 10) / 10} m/s`}
                            fontSize={12}
                            width={60}
                        />
                    )}

                    <Tooltip content={<CustomTooltip />} />
                    <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />

                    {/* Temperature line/area */}
                    {selectedMetrics.temperature && (
                        chartType === 'area' ? (
                            <Area
                                yAxisId="temperature"
                                type="monotone"
                                dataKey="temperature"
                                name="Temperature (°C)"
                                stroke="#f72585"
                                fill="#f72585"
                                fillOpacity={0.3}
                                strokeWidth={2}
                                dot={false}
                                connectNulls={false}
                            />
                        ) : (
                            <Line
                                yAxisId="temperature"
                                type="monotone"
                                dataKey="temperature"
                                name="Temperature (°C)"
                                stroke="#f72585"
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
                                name="Humidity (%)"
                                stroke="#4cc9f0"
                                fill="#4cc9f0"
                                fillOpacity={0.3}
                                strokeWidth={2}
                                dot={false}
                                connectNulls={false}
                            />
                        ) : (
                            <Line
                                yAxisId="humidity"
                                type="monotone"
                                dataKey="humidity"
                                name="Humidity (%)"
                                stroke="#4cc9f0"
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
                                name="Airflow (m/s)"
                                stroke="#4361ee"
                                fill="#4361ee"
                                fillOpacity={0.3}
                                strokeWidth={2}
                                dot={false}
                                connectNulls={false}
                            />
                        ) : (
                            <Line
                                yAxisId={selectedMetrics.temperature ? "temperature" : "airflow"}
                                type="monotone"
                                dataKey="airflow"
                                name="Airflow (m/s)"
                                stroke="#4361ee"
                                strokeWidth={2}
                                dot={false}
                                connectNulls={false}
                            />
                        )
                    )}
                </ChartComponent>
            </ResponsiveContainer>
        </div>
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

    // Memoized Custom Tooltip Component
    const CustomTooltip = useCallback(({ active, payload, label }) => {
        if (active && payload && payload.length) {
            return (
                <div className="custom-tooltip">
                    <p className="tooltip-time">{`Time: ${new Date(label).toLocaleString()}`}</p>
                    {payload.map((entry, index) => (
                        <p key={index} style={{ color: entry.color }}>
                            {`${entry.name}: ${entry.value}${entry.name.includes('Temperature') ? '°C' :
                                entry.name.includes('Humidity') ? '%' :
                                    entry.name.includes('Airflow') ? ' m/s' : ''
                                }`}
                        </p>
                    ))}
                </div>
            );
        }
        return null;
    }, []);

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
        <div className="environment-chart stable-container">
            <div className="chart-controls">
                <div className="chart-title">
                    <h2>Environment Monitoring</h2>
                    <div className="chart-info">
                        {/* <span className="data-points">Data Points: {measurements.length}</span> */}
                        {lastUpdate && (
                            <span className="last-update">Last Update: {lastUpdate.toLocaleTimeString()}</span>
                        )}
                    </div>
                </div>

                <div className="control-row">
                    <div className="metric-toggles">
                        <label className="metric-toggle">
                            <input
                                type="checkbox"
                                checked={selectedMetrics.temperature}
                                onChange={() => handleMetricToggle('temperature')}
                            />
                            🌡️ Temperature
                        </label>
                        <label className="metric-toggle">
                            <input
                                type="checkbox"
                                checked={selectedMetrics.humidity}
                                onChange={() => handleMetricToggle('humidity')}
                            />
                            💧 Humidity
                        </label>
                        {/* <label className="metric-toggle">
                            <input
                                type="checkbox"
                                checked={selectedMetrics.airflow}
                                onChange={() => handleMetricToggle('airflow')}
                            />
                            💨 Airflow
                        </label> */}
                    </div>

                    <div className="control-buttons">
                        <div className="chart-type-toggle">
                            {/* <button
                                className={`chart-type-btn ${chartType === 'line' ? 'active' : ''}`}
                                onClick={() => handleChartTypeChange('line')}
                                title="Line Chart"
                            >
                                📈 Line
                            </button> */}
                            <button
                                className={`chart-type-btn ${chartType === 'area' ? 'active' : ''}`}
                                onClick={() => handleChartTypeChange('area')}
                                title="Area Chart with Gradients"
                            >
                                📊 Area
                            </button>

                            <button
                                className="refresh-btn"
                                onClick={handleRefresh}
                                disabled={loading}
                            >
                                {loading ? (
                                    <>
                                        <div className="loading-spinner"></div>
                                        Loading...
                                    </>
                                ) : (
                                    '🔄 Refresh'
                                )}
                            </button>

                            <button
                                className="download-btn"
                                onClick={downloadCSV}
                                disabled={loading || measurements.length === 0}
                                title={`Download ${measurements.length} data points as CSV`}
                            >
                                Download CSV 📥
                            </button>
                        </div>

                        <select
                            className="days-select"
                            value={selectedDays}
                            onChange={(e) => setSelectedDays(Number(e.target.value))}
                        >
                            <option value={5}>⚡ Last 5 Minutes</option>
                            <option value={1}>Last 24 Hours</option>
                            <option value={7}>Last 7 Days</option>
                            <option value={30}>Last 30 Days</option>
                        </select>
                    </div>
                </div>

                {/* <div className={`live-indicator ${isConnected ? 'real-time-active' : ''}`}>
                    <div className={`live-dot ${isConnected ? 'connected pulsing' : 'disconnected'}`}></div>
                    {isConnected ? '🟢 LIVE' : '🔴 OFFLINE'}
                </div> */}
            </div>

            <div className="chart-wrapper stable-chart-wrapper" ref={chartContainerRef}>
                {loading ? (
                    <div className="chart-loading">
                        <div className="loading-spinner"></div>
                        Loading chart data...
                    </div>
                ) : error ? (
                    <div className="chart-error">
                        {error}
                        <button className="retry-btn" onClick={handleRefresh}>
                            Retry
                        </button>
                    </div>
                ) : measurements.length === 0 ? (
                    <div className="chart-no-data">
                        No data available for the selected period
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
                        CustomTooltip={CustomTooltip}
                        chartKey={chartKey}
                    />
                ) : null}
            </div>
        </div>
    );
};

export default EnvironmentChart;
