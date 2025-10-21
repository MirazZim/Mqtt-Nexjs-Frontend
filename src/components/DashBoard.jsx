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
        <div className="min-h-screen bg-gray-100">
            {/* Top Header with Gradient */}
            <div className="bg-gradient-to-r from-teal-700 via-teal-600 to-blue-600 px-6 py-4 flex items-center justify-between shadow-lg">
                <h1 className="text-white text-3xl font-bold tracking-wide">
                    Sake Monitoring System
                </h1>

            </div>

            {/* Sub-header with Navigation */}
            <div className="bg-teal-800 px-6 py-3 flex items-center justify-between shadow-md">


                <div className="flex items-center gap-3">
                    <LocationSelector
                        selectedLocation={selectedLocation}
                        onLocationChange={handleLocationChange}
                    />
                </div>
            </div>

            {/* Main Content Area */}
            <div className="p-2">
                <div className="grid grid-cols-12 gap-6">

                    {/* LEFT SIDEBAR - Sensors & Device Status */}
                    <div className="col-span-3 space-y-4">

                        {/* CurrentEnvironment - 4 Channel Cards will be here */}
                        <div className="bg-white rounded-lg shadow-md p-4 text-black">
                            <CurrentEnvironment selectedLocation={selectedLocation} />
                        </div>

                        {/* Device Status */}
                        <div className="bg-white rounded-lg shadow-md p-6 text-black">
                            <h3 className="text-lg font-semibold text-gray-800 mb-4">Device Status</h3>
                            <DeviceStatus selectedLocation={selectedLocation} />
                        </div>

                        {/* Environment Control */}
                        <div className="bg-white rounded-lg shadow-md p-6 text-black">
                            <h3 className="text-lg font-semibold text-gray-800 mb-4">Environment Control</h3>
                            <EnvironmentControl
                                selectedLocation={selectedLocation}
                                targetTemperature={targetTemperature}
                                setTargetTemperature={setTargetTemperature}
                            />
                        </div>
                    </div>

                    {/* RIGHT MAIN AREA - Charts */}
                    <div className="col-span-9 space-y-6">

                        {/* Temperature Chart */}
                        <div className="bg-white rounded-lg shadow-md p-6 text-black">
                            <div className="flex items-center justify-between mb-4">
                                <h2 className="text-xl font-semibold text-gray-800">Temperature</h2>
                                <div className="flex gap-2">
                                    <button className="p-2 hover:bg-gray-100 rounded transition-colors">
                                        <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                        </svg>
                                    </button>
                                    <button className="p-2 hover:bg-gray-100 rounded transition-colors">
                                        <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                                        </svg>
                                    </button>
                                </div>
                            </div>
                            <Suspense fallback={<ChartLoader />}>
                                <EnvironmentChart
                                    selectedLocation={selectedLocation}
                                    socket={socket}
                                    type="temperature"
                                />
                            </Suspense>
                        </div>

                        {/* Humidity Chart */}
                        {/* <div className="bg-white rounded-lg shadow-md p-6 text-black">
                            <div className="flex items-center justify-between mb-4">
                                <h2 className="text-xl font-semibold text-gray-800">Humidity</h2>
                                <div className="flex gap-2">
                                    <button className="p-2 hover:bg-gray-100 rounded transition-colors">
                                        <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                        </svg>
                                    </button>
                                    <button className="p-2 hover:bg-gray-100 rounded transition-colors">
                                        <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                                        </svg>
                                    </button>
                                </div>
                            </div>
                            <Suspense fallback={<ChartLoader />}>
                                <EnvironmentChart
                                    selectedLocation={selectedLocation}
                                    socket={socket}
                                    type="humidity"
                                />
                            </Suspense>
                        </div> */}

                        {/* Spatial Temperature Map */}
                        {showHeavyComponents ? (
                            <div className="bg-white rounded-lg shadow-md p-6">
                                <h3 className="text-lg font-semibold text-gray-800 mb-4">Spatial Temperature Map</h3>
                                {isLoadingLocations ? (
                                    <div className="flex justify-center items-center h-[400px] text-base text-gray-600 bg-gray-50 rounded-lg">
                                        <i className="fas fa-spinner fa-spin mr-2"></i>
                                        Loading temperature data...
                                    </div>
                                ) : (
                                    <ComponentLoader height={950}>
                                        <SpatialTemperatureMap
                                            selectedLocation="sensor-room"
                                            targetTemperature={22}
                                            preloadedData={locationsData}
                                        />
                                    </ComponentLoader>
                                )}
                            </div>
                        ) : (
                            <div className="bg-gray-50 rounded-lg shadow-md h-[400px] flex justify-center items-center">
                                <div className="text-center text-gray-600">
                                    <i className="fas fa-hourglass-half fa-2x mb-2"></i>
                                    <div>Loading advanced features...</div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Dashboard;