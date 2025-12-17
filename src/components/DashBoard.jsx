'use client'

import React, { useState, useEffect, useContext, lazy, Suspense } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import CurrentEnvironment from '../components/current-Environment/CurrentEnvironment.jsx';
import DeviceStatus from '../components/device-status/DeviceStatus.jsx';
import EnvironmentControl from '../components/environment-control/EnvironmentControl.jsx';
import LocationSelector from '../components/locationSelector/LocationSelector.jsx';
import AuthContext from '../context/AuthContext.jsx';
import BowlFanStatus from '../components/Third-Column/Bowl-Fan-Status/BowlFanStatus.jsx';
import SonarPumpStatus from '../components/Third-Column/Sonar-pump-status/SonarPumpStatus.jsx';
import IPCamera from '../components/Third-Column/Ip-camera/ip-camera.jsx';
import FermentationResult from './results/results.jsx';
import { useTranslation } from '../app/i18n/client.js';
import API_BASE_URL from '../config/api.js';
import Chatbot from '../components/chatbot/Chatbot.jsx';


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
    const pathname = usePathname();
    const router = useRouter();
    const lng = pathname.split("/")[1];
    const { t } = useTranslation(lng, "dashboard");
    // ✅ GET BOTH socket AND user from AuthContext
    const { socket, user } = useContext(AuthContext);

    // ✅ ADD currentRoom state
    const [currentRoom, setCurrentRoom] = useState(null);

    const [selectedLocation, setSelectedLocation] = useState(() => {
        const savedLocation = localStorage.getItem('selectedLocation');
        return savedLocation || 'main-room';
    });
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
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    // Language switching function
    const changeLanguage = (newLang) => {
        const currentPath = pathname.split('/').slice(2).join('/'); // Remove language prefix
        router.push(`/${newLang}/${currentPath}`);
    };

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

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (isDropdownOpen && !event.target.closest('.relative.group')) {
                setIsDropdownOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isDropdownOpen]);

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
            <div className="bg-linear-to-r from-teal-700 via-teal-600 to-blue-600 px-2 md:px-3 lg:px-4 py-1.5 md:py-1.5 lg:py-2 flex items-center justify-between shadow-lg">
                <h1 className="text-white text-sm md:text-base lg:text-xl font-bold tracking-wide">
                    {t('Sake Brewing Monitoring System')}
                </h1>

                <div className="flex items-center gap-1.5 md:gap-2 lg:gap-3">
                    {/* Eye-catching Language Switcher - Extra Small on Mobile */}
                    <div className="hidden lg:flex items-center gap-0.5 bg-white/10 backdrop-blur-lg rounded-2xl p-1.5 border border-white/20 shadow-2xl">
                        <button
                            onClick={() => changeLanguage('en')}
                            className={`px-4 py-2.5 text-sm font-bold rounded-xl transition-all duration-300 transform hover:scale-105 ${lng === 'en'
                                ? 'bg-white text-cyan-600 shadow-lg shadow-cyan-500/40 ring-2 ring-white'
                                : 'text-white hover:bg-cyan-500/30 hover:text-cyan-100 border border-transparent hover:border-cyan-400/50'
                                }`}
                        >
                            EN
                        </button>
                        <div className="w-px h-4 bg-linear-to-b from-transparent via-white/40 to-transparent"></div>
                        <button
                            onClick={() => changeLanguage('ja')}
                            className={`px-4 py-2.5 text-sm font-bold rounded-xl transition-all duration-300 transform hover:scale-105 ${lng === 'ja'
                                ? 'bg-white text-pink-600 shadow-lg shadow-pink-500/40 ring-2 ring-white'
                                : 'text-white hover:bg-pink-500/30 hover:text-pink-100 border border-transparent hover:border-pink-400/50'
                                }`}
                        >
                            日本語
                        </button>
                    </div>

                    {/* Device Status - Click for Mobile/Tablet, Hover for Desktop */}
                    <div className="relative group">
                        <button
                            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                            className="flex items-center gap-1 md:gap-1.5 lg:gap-2 px-2 md:px-2.5 lg:px-3 py-1 md:py-1 lg:py-1.5 text-white text-xs md:text-xs lg:text-sm font-medium rounded hover:bg-teal-700 transition-colors"
                        >
                            <svg className="w-3 h-3 md:w-3.5 md:h-3.5 lg:w-4 lg:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            {t('Device Status')}
                            <svg
                                className={`w-2.5 h-2.5 md:w-2.5 md:h-2.5 lg:w-3 lg:h-3 transition-transform ${isDropdownOpen ? 'rotate-180' : ''} lg:group-hover:rotate-180`}
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                        </button>

                        {/* Invisible bridge - Desktop only */}
                        <div className="hidden lg:block absolute right-0 top-full h-2 w-80 invisible group-hover:visible" />

                        {/* Dropdown Content - Click for Mobile/Tablet, Hover for Desktop */}
                        <div className={`
                        absolute right-0 top-full mt-2 w-60 md:w-72 lg:w-80 bg-white rounded-lg shadow-2xl border border-gray-200 z-50 transition-all duration-300
                        ${isDropdownOpen ? 'opacity-100 visible lg:opacity-0 lg:invisible' : 'opacity-0 invisible'}
                        lg:group-hover:opacity-100 lg:group-hover:visible
                    `}>
                            <div className="p-2 md:p-2.5 lg:p-3">
                                <h3 className="text-xs md:text-xs lg:text-sm font-semibold text-gray-800 mb-2 pb-2 border-b border-gray-200">
                                    {t('Device Status')}
                                </h3>
                                <DeviceStatus selectedLocation={selectedLocation} />
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Compact Sub-header */}
            <div className="bg-teal-800 px-2 md:px-3 lg:px-4 py-1.5 md:py-1.5 lg:py-2 flex items-center justify-between shadow-md">
                <div className="flex items-center gap-2 md:gap-3 lg:gap-4">
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
                            <h3 className="text-sm font-semibold text-gray-800 mb-2">{t('Environment Control')}</h3>
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

                            {/* ✅ Pass roomId to FermentationResult */}
                            <FermentationResult
                                socket={socket}
                                selectedLocation={selectedLocation}

                            />
                            {/* Temperature Chart */}
                            <div className="bg-white rounded-lg shadow-md p-3 text-black">
                                <div className="flex items-center justify-between">
                                    <h2 className="text-base font-semibold text-gray-800">{t('Temperature')}</h2>
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
                                            {t('Loading temperature data...')}
                                        </div>
                                    ) : (
                                        <ComponentLoader height={700}>
                                            {/* <SpatialTemperatureMap
                                                selectedLocation="sensor-room"
                                                targetTemperature={22}
                                                preloadedData={locationsData}
                                            /> */}
                                        </ComponentLoader>
                                    )}
                                </div>
                            ) : (
                                <div className="bg-gray-50 rounded-lg shadow-md h-[400px] flex justify-center items-center">
                                    <div className="text-center text-gray-600">
                                        <i className="fas fa-hourglass-half fa-2x mb-2"></i>
                                        <div>{t('Loading advanced features...')}</div>
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
                                {t('Additional Sensors')}
                            </h3>

                            <IPCamera selectedLocation={selectedLocation} />

                            <Chatbot />

                            {/* <div className="space-y-2"> */}
                            {/* Sensor Item */}
                            {/* <div className="bg-gray-50 rounded-md p-2 border border-gray-200"> */}
                            {/* <div className="space-y-4"> */}
                            {/* Bowl Fan Status Component */}
                            {/* <BowlFanStatus selectedLocation={selectedLocation} /> */}

                            {/* Sonar Pump Status Component */}
                            {/* <SonarPumpStatus selectedLocation={selectedLocation} /> */}
                            {/* </div> */}
                            {/* </div> */}
                            {/* </div> */}
                        </div>

                        {/* New Sensors Card 2 */}
                        <div className="bg-white rounded-lg shadow-md p-3">
                            <h3 className="text-sm font-semibold text-gray-800 mb-2 flex items-center gap-2">
                                <span className="text-base">⚡</span>
                                {t('Power Monitoring')}
                            </h3>
                            <div className="space-y-2">
                                <div className="bg-gray-50 rounded-md p-2 border border-gray-200">
                                    <div className="flex items-center justify-between mb-1">
                                        <span className="text-xs font-medium text-gray-700">{t('Voltage')}</span>
                                        <span className="inline-flex h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse"></span>
                                    </div>
                                    <div className="text-lg font-bold text-purple-600">220V</div>
                                    <div className="text-xs text-gray-500 mt-1">{t('Stable')}</div>
                                </div>

                                <div className="bg-gray-50 rounded-md p-2 border border-gray-200">
                                    <div className="flex items-center justify-between mb-1">
                                        <span className="text-xs font-medium text-gray-700">{t('Current')}</span>
                                        <span className="inline-flex h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse"></span>
                                    </div>
                                    <div className="text-lg font-bold text-orange-600">2.4A</div>
                                    <div className="text-xs text-gray-500 mt-1">{t('Normal')}</div>
                                </div>
                            </div>
                        </div>

                        {/* New Sensors Card 3 */}
                        <div className="bg-white rounded-lg shadow-md p-3">
                            <h3 className="text-sm font-semibold text-gray-800 mb-2 flex items-center gap-2">
                                <span className="text-base">🔔</span>
                                {t('System Alerts')}
                            </h3>
                            <div className="space-y-1.5">
                                <div className="bg-green-50 border border-green-200 rounded-md p-2">
                                    <div className="flex items-center gap-1.5">
                                        <span className="text-green-600 text-xs">✓</span>
                                        <span className="text-xs text-gray-700">{t('All systems operational')}</span>
                                    </div>
                                    <div className="text-xs text-gray-500 mt-0.5">{t('Updated 2 min ago')}</div>
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
