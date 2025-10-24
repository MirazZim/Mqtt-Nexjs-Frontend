'use client'

import React, { useState, useEffect, useContext, lazy, Suspense } from 'react';
import CurrentEnvironment from '../components/current-Environment/CurrentEnvironment.jsx';
import DeviceStatus from '../components/device-status/DeviceStatus.jsx';
import EnvironmentControl from '../components/environment-control/EnvironmentControl.jsx';
import LocationSelector from '../components/locationSelector/LocationSelector.jsx';
import AuthContext from '../context/AuthContext.jsx';
import BowlFanStatus from '../components/Third-Column/Bowl-Fan-Status/BowlFanStatus.jsx';
import SonarPumpStatus from '../components/Third-Column/Sonar-pump-status/SonarPumpStatus.jsx';

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
        <div className="h-screen flex flex-col bg-gray-100 overflow-hidden w-[95vw] mx-auto rounded-lg border">
            {/* Compact Top Header */}
            <div className="bg-gradient-to-r from-teal-700 via-teal-600 to-blue-600 px-4 py-2 flex items-center justify-between shadow-lg">
                <h1 className="text-white text-xl font-bold tracking-wide">
                    Sake Brewing Monitoring System
                </h1>
                {/* Device Status Hover Dropdown */}
                <div className="relative group">
                    <button className="flex items-center gap-2 px-3 py-1.5 text-white text-sm font-medium rounded hover:bg-teal-700 transition-colors">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        Device Status
                        <svg className="w-3 h-3 transition-transform group-hover:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                    </button>

                    {/* Invisible bridge to maintain hover */}
                    <div className="absolute right-0 top-full h-2 w-80 invisible group-hover:visible" />

                    {/* Dropdown Content - Shows on Hover */}
                    <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-lg shadow-2xl border border-gray-200 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-300 z-50">
                        <div className="p-3">
                            <h3 className="text-sm font-semibold text-gray-800 mb-2 pb-2 border-b border-gray-200">Device Status</h3>
                            <DeviceStatus selectedLocation={selectedLocation} />
                        </div>
                    </div>
                </div>
            </div>

            {/* Compact Sub-header with Device Status Dropdown */}
            <div className="bg-teal-800 px-4 py-2 flex items-center justify-between shadow-md">
                <div className="flex items-center gap-4">
                    <LocationSelector
                        selectedLocation={selectedLocation}
                        onLocationChange={handleLocationChange}
                    />
                </div>
            </div>

            {/* Main Content Area - Fixed Height */}
            <div className="flex-1 p-2 overflow-hidden">
                <div className="grid grid-cols-12 gap-3 h-full">

                    {/* LEFT COLUMN - Sensors & Controls (Device Status Removed) */}
                    <div className="col-span-3 space-y-2 overflow-y-auto">

                        {/* Current Environment */}
                        <div className="bg-white rounded-lg shadow-md p-2">
                            <CurrentEnvironment selectedLocation={selectedLocation} />
                        </div>

                        {/* Environment Control */}
                        <div className="bg-white rounded-lg shadow-md p-3">
                            <h3 className="text-sm font-semibold text-gray-800 mb-2">Environment Control</h3>
                            <EnvironmentControl
                                selectedLocation={selectedLocation}
                                targetTemperature={targetTemperature}
                                setTargetTemperature={setTargetTemperature}
                            />
                        </div>
                    </div>

                    {/* MIDDLE COLUMN - Charts */}
                    <div className="col-span-6 space-y-2 overflow-y-auto">

                        <div className="col-span-9 space-y-6">


                            {/* Temperature Chart */}
                            <div className="bg-white rounded-lg shadow-md p-3 text-black">
                                <div className="flex items-center justify-between">
                                    <h2 className="text-base font-semibold text-gray-800">Temperature</h2>
                                    <div className="flex gap-1.5">
                                        <button className="p-1.5 hover:bg-gray-100 rounded transition-colors">
                                            <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                            </svg>
                                        </button>
                                        <button className="p-1.5 hover:bg-gray-100 rounded transition-colors">
                                            <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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

                            {/* Spatial Temperature Map */}
                            {showHeavyComponents ? (
                                <div className="bg-white rounded-lg shadow-md p-1">
                                    {isLoadingLocations ? (
                                        <div className="flex justify-center items-center h-[400px] text-base text-gray-600 bg-gray-50 rounded-lg">
                                            <i className="fas fa-spinner fa-spin mr-2"></i>
                                            Loading temperature data...
                                        </div>
                                    ) : (
                                        <ComponentLoader height={700}>
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


                    {/* RIGHT COLUMN - New Sensors Section */}
                    <div className="col-span-3 space-y-2 overflow-y-auto">

                        {/* New Sensors Card 1 */}
                        <div className="bg-white rounded-lg shadow-md p-3">
                            <h3 className="text-sm font-semibold text-gray-800 mb-2 flex items-center gap-2">
                                <span className="text-base">📊</span>
                                Additional Sensors
                            </h3>

                            <div className="space-y-2">
                                {/* Sensor Item */}
                                <div className="bg-gray-50 rounded-md p-2 border border-gray-200">
                                    <div className="space-y-4">
                                        {/* Bowl Fan Status Component */}
                                        <BowlFanStatus selectedLocation={selectedLocation} />

                                        {/* Sonar Pump Status Component */}
                                        <SonarPumpStatus selectedLocation={selectedLocation} />
                                    </div>


                                </div>
                            </div>
                        </div>

                        {/* New Sensors Card 2 */}
                        <div className="bg-white rounded-lg shadow-md p-3">
                            <h3 className="text-sm font-semibold text-gray-800 mb-2 flex items-center gap-2">
                                <span className="text-base">⚡</span>
                                Power Monitoring
                            </h3>
                            <div className="space-y-2">
                                <div className="bg-gray-50 rounded-md p-2 border border-gray-200">
                                    <div className="flex items-center justify-between mb-1">
                                        <span className="text-xs font-medium text-gray-700">Voltage</span>
                                        <span className="inline-flex h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse"></span>
                                    </div>
                                    <div className="text-lg font-bold text-purple-600">220V</div>
                                    <div className="text-xs text-gray-500 mt-1">Stable</div>
                                </div>

                                <div className="bg-gray-50 rounded-md p-2 border border-gray-200">
                                    <div className="flex items-center justify-between mb-1">
                                        <span className="text-xs font-medium text-gray-700">Current</span>
                                        <span className="inline-flex h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse"></span>
                                    </div>
                                    <div className="text-lg font-bold text-orange-600">2.4A</div>
                                    <div className="text-xs text-gray-500 mt-1">Normal</div>
                                </div>
                            </div>
                        </div>

                        {/* New Sensors Card 3 */}
                        <div className="bg-white rounded-lg shadow-md p-3">
                            <h3 className="text-sm font-semibold text-gray-800 mb-2 flex items-center gap-2">
                                <span className="text-base">🔔</span>
                                System Alerts
                            </h3>
                            <div className="space-y-1.5">
                                <div className="bg-green-50 border border-green-200 rounded-md p-2">
                                    <div className="flex items-center gap-1.5">
                                        <span className="text-green-600 text-xs">✓</span>
                                        <span className="text-xs text-gray-700">All systems operational</span>
                                    </div>
                                    <div className="text-xs text-gray-500 mt-0.5">Updated 2 min ago</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>



    );
};

export default Dashboard;