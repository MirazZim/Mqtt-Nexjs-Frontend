'use client'

import React, { useState, useEffect, useContext, lazy, Suspense } from 'react';
import CurrentEnvironment from '../components/current-Environment/CurrentEnvironment.jsx';
import DeviceStatus from '../components/device-status/DeviceStatus.jsx';
import EnvironmentControl from '../components/environment-control/EnvironmentControl.jsx';
import LocationSelector from '../components/locationSelector/LocationSelector.jsx';
import AuthContext from '../context/AuthContext.jsx';

// Lazy load heavy components
const EnvironmentChart = lazy(() => import('../components/environment-chart/EnvironmentChart.jsx'));
const SpatialTemperatureMap = lazy(() => import('../components/spatial-temperatureMap/SpatialTemperatureMap.jsx'));

// Optimized loading component
const ComponentLoader = ({ children, height = 200 }) => (
    <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: `${height}px`,
        fontSize: '1rem',
        color: '#888'
    }}>
        {children}
    </div>
);

// Rest of your Dashboard component code
const ChartLoader = () => (
    <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '400px',
        background: '#f8f9fa',
        borderRadius: '8px',
        color: '#666'
    }}>
        <i className="fas fa-spinner fa-spin" style={{ marginRight: '10px' }}></i>
        Loading charts...
    </div>
);


const Dashboard = () => {
    const [selectedLocation, setSelectedLocation] = useState(() => {
        const savedLocation = localStorage.getItem('selectedLocation');
        return savedLocation || 'main-room';
    });

    const { socket } = useContext(AuthContext);
    const [targetTemperature, setTargetTemperature] = useState(() => {
        const savedTemp = localStorage.getItem('targetTemperature');
        return savedTemp ? parseFloat(savedTemp) : 22.0;
    });

    const [delayStats, setDelayStats] = useState({
        server_processing: { avg: 0, min: 0, max: 0, latest: 0, samples: 0 },
        socket_emission: { avg: 0, min: 0, max: 0, latest: 0, samples: 0 },
        total_e2e: { avg: 0, min: 0, max: 0, latest: 0, samples: 0 },
        frontend_rendering: { avg: 0, min: 0, max: 0, latest: 0, samples: 0 }
    });

    // State for progressive loading
    const [showHeavyComponents, setShowHeavyComponents] = useState(false);
    const [locationsData, setLocationsData] = useState(null);
    const [isLoadingLocations, setIsLoadingLocations] = useState(false);

    // Save to localStorage
    useEffect(() => {
        localStorage.setItem('selectedLocation', selectedLocation);
    }, [selectedLocation]);

    useEffect(() => {
        localStorage.setItem('targetTemperature', targetTemperature.toString());
    }, [targetTemperature]);

    // Load heavy components after initial render
    useEffect(() => {
        const timer = setTimeout(() => {
            setShowHeavyComponents(true);
        }, 1000); // 1 second delay for critical components to load first

        return () => clearTimeout(timer);
    }, []);

    // Preload locations data independently
    useEffect(() => {
        if (!showHeavyComponents) return;

        const loadLocationsData = async () => {
            setIsLoadingLocations(true);
            try {
                // Add cache busting and timeout
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

                const response = await fetch('/api/locations', {
                    signal: controller.signal,
                    headers: {
                        'Cache-Control': 'no-cache',
                        'Pragma': 'no-cache'
                    }
                });

                clearTimeout(timeoutId);

                if (response.ok) {
                    const data = await response.json();
                    setLocationsData(data);
                }
            } catch (error) {
                if (error.name !== 'AbortError') {
                    console.log('Failed to load locations data:', error);
                }
            } finally {
                setIsLoadingLocations(false);
            }
        };

        loadLocationsData();
    }, [showHeavyComponents]);

    // Handle delay stats updates
    useEffect(() => {
        if (!socket) return;

        const handleDelayStatsUpdate = (payload) => {
            if (payload?.delay_stats) {
                setDelayStats(prev => ({ ...prev, ...payload.delay_stats }));
            }
        };

        socket.on('delayStatsUpdate', handleDelayStatsUpdate);

        return () => {
            socket.off('delayStatsUpdate', handleDelayStatsUpdate);
        };
    }, [socket]);

    const handleLocationChange = (location) => {
        setSelectedLocation(location);
    };

    return (
        <div className="dashboard">
            <div className="dashboard-header">
                <h1>🌡️ Environmental Monitoring & Control System</h1>
            </div>

            <div className="dashboard-grid">
                {/* Critical Path Components - Load First */}
                <div className="dashboard-card full-width">
                    <LocationSelector
                        selectedLocation={selectedLocation}
                        onLocationChange={handleLocationChange}
                    />
                </div>

                <div className="dashboard-card">
                    <CurrentEnvironment selectedLocation={selectedLocation} />
                </div>

                <div className="dashboard-card">
                    <DeviceStatus selectedLocation={selectedLocation} />
                </div>

                <div className="dashboard-card">
                    <EnvironmentControl
                        selectedLocation={selectedLocation}
                        targetTemperature={targetTemperature}
                        setTargetTemperature={setTargetTemperature}
                    />
                </div>

                {/* Lazy Load Charts */}
                <div className="chart-section">
                    <Suspense fallback={<ChartLoader />}>
                        <EnvironmentChart
                            selectedLocation={selectedLocation}
                            socket={socket}
                        />
                    </Suspense>
                </div>

                {/* Heavy Components - Load After Critical Path */}
                {showHeavyComponents ? (
                    <>
                        {/* Spatial Temperature Map with preloaded data */}
                        <div className="dashboard-card full-width spatial-map-card">
                            {isLoadingLocations ? (
                                <div style={{
                                    display: 'flex',
                                    justifyContent: 'center',
                                    alignItems: 'center',
                                    height: '400px',
                                    fontSize: '16px',
                                    color: '#666',
                                    background: '#f8f9fa',
                                    borderRadius: '8px'
                                }}>
                                    <i className="fas fa-spinner fa-spin" style={{ marginRight: '10px' }}></i>
                                    Loading temperature data...
                                </div>
                            ) : (
                                <ComponentLoader height={400}>
                                    <SpatialTemperatureMap
                                        selectedLocation="sensor-room"
                                        targetTemperature={22}
                                        preloadedData={locationsData}
                                    />
                                </ComponentLoader>
                            )}
                        </div>

                        {/* Other lazy components can be added here as needed */}
                        {/*
            <div className="dashboard-card full-width">
              <ComponentLoader>
                <DelayMonitor delayStats={delayStats} />
              </ComponentLoader>
            </div>
            */}
                    </>
                ) : (
                    // Loading placeholder for heavy components
                    <div className="dashboard-card full-width" style={{ height: '400px', background: '#f8f9fa', display: 'flex', justifyContent: 'center', alignItems: 'center', borderRadius: '8px' }}>
                        <div style={{ textAlign: 'center', color: '#666' }}>
                            <i className="fas fa-hourglass-half fa-2x" style={{ marginBottom: '10px' }}></i>
                            <div>Loading advanced features...</div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Dashboard;