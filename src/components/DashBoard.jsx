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
    const [activeTab, setActiveTab] = useState('left');

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
    const [isDarkMode, setIsDarkMode] = useState(() => {
        if (typeof window !== 'undefined') {
            const savedMode = localStorage.getItem('darkMode');
            return savedMode === 'true';
        }
        return false;
    });

    // Apply dark mode class to document
    useEffect(() => {
        if (isDarkMode) {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
        localStorage.setItem('darkMode', isDarkMode.toString());
    }, [isDarkMode]);

    const toggleDarkMode = () => {
        setIsDarkMode(prev => !prev);
    };

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
        <div className="h-screen flex flex-col bg-gray-100 dark:bg-gray-900 overflow-hidden w-[95vw] mx-auto rounded-lg border dark:border-gray-700 transition-colors duration-300">
            {/* Compact Top Header */}
            <div className="bg-linear-to-r from-teal-700 via-teal-600 to-blue-600 dark:from-gray-800 dark:via-gray-700 dark:to-gray-800 px-2 md:px-3 lg:px-4 py-1.5 md:py-1.5 lg:py-2 flex items-center justify-between shadow-lg transition-colors duration-300">
                <h1 className="text-white text-sm md:text-base lg:text-xl font-bold tracking-wide">
                    {t('Sake Brewing Monitoring System')}
                </h1>

                <div className="flex items-center gap-1.5 md:gap-2 lg:gap-3">
                    {/* Dark/Light Mode Toggle */}
                    <button
                        onClick={toggleDarkMode}
                        className="flex items-center justify-center w-8 h-8 md:w-9 md:h-9 lg:w-10 lg:h-10 bg-white/10 backdrop-blur-lg rounded-xl border border-white/20 shadow-lg hover:bg-white/20 transition-all duration-300 transform hover:scale-105 active:scale-95"
                        aria-label={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
                    >
                        {isDarkMode ? (
                            <svg className="w-4 h-4 md:w-5 md:h-5 text-yellow-300" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" clipRule="evenodd" />
                            </svg>
                        ) : (
                            <svg className="w-4 h-4 md:w-5 md:h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                                <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
                            </svg>
                        )}
                    </button>

                    {/* Eye-catching Language Switcher - Extra Small on Mobile */}
                    <div className="hidden lg:flex items-center gap-0.5 bg-white/10 backdrop-blur-lg rounded-2xl p-1.5 border border-white/20 shadow-2xl">
                        <button
                            onClick={() => changeLanguage('en')}
                            className={`px-4 py-2.5 text-sm font-bold rounded-xl transition-all duration-300 transform hover:scale-105 ${lng === 'en'
                                ? 'bg-white text-cyan-600 shadow-lg shadow-cyan-500/40 ring-2 ring-white dark:bg-gray-200 dark:text-cyan-700'
                                : 'text-white hover:bg-cyan-500/30 hover:text-cyan-100 border border-transparent hover:border-cyan-400/50'
                                }`}
                        >
                            EN
                        </button>
                        <div className="w-px h-4 bg-linear-to-b from-transparent via-white/40 to-transparent"></div>
                        <button
                            onClick={() => changeLanguage('ja')}
                            className={`px-4 py-2.5 text-sm font-bold rounded-xl transition-all duration-300 transform hover:scale-105 ${lng === 'ja'
                                ? 'bg-white text-pink-600 shadow-lg shadow-pink-500/40 ring-2 ring-white dark:bg-gray-200 dark:text-pink-700'
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
                            className="flex items-center gap-1 md:gap-1.5 lg:gap-2 px-2 md:px-2.5 lg:px-3 py-1 md:py-1 lg:py-1.5 text-white text-xs md:text-xs lg:text-sm font-medium rounded hover:bg-teal-700 dark:hover:bg-gray-600 transition-colors"
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
                        absolute right-0 top-full mt-2 w-60 md:w-72 lg:w-80 bg-white dark:bg-gray-800 rounded-lg shadow-2xl border border-gray-200 dark:border-gray-700 z-50 transition-all duration-300
                        ${isDropdownOpen ? 'opacity-100 visible lg:opacity-0 lg:invisible' : 'opacity-0 invisible'}
                        lg:group-hover:opacity-100 lg:group-hover:visible
                    `}>
                            <div className="p-2 md:p-2.5 lg:p-3">
                                <h3 className="text-xs md:text-xs lg:text-sm font-semibold text-gray-800 dark:text-gray-200 mb-2 pb-2 border-b border-gray-200 dark:border-gray-700">
                                    {t('Device Status')}
                                </h3>
                                <DeviceStatus selectedLocation={selectedLocation} />
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Compact Sub-header */}
            <div className="bg-teal-800 dark:bg-gray-800 px-2 md:px-3 lg:px-4 py-1.5 md:py-1.5 lg:py-2 flex items-center justify-between shadow-md transition-colors duration-300">
                <div className="flex items-center gap-2 md:gap-3 lg:gap-4">
                    <LocationSelector
                        selectedLocation={selectedLocation}
                        onLocationChange={handleLocationChange}
                    />
                </div>
            </div>
            {/* Main Content Area - Fixed Height */}
            <div className="flex-1 overflow-y-auto pb-16 pt-2">
                {/* DESKTOP LAYOUT - Unchanged (>= 1024px) */}
                <div className="hidden lg:grid grid-cols-12 gap-3 h-full">
                    {/* LEFT COLUMN - Sensors & Controls */}
                    <div className="col-span-3 space-y-2 overflow-y-auto">
                        {/* Current Environment */}
                        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-2 transition-colors duration-300">
                            <CurrentEnvironment selectedLocation={selectedLocation} />
                        </div>

                        {/* Environment Control */}
                        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-3 transition-colors duration-300">
                            <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-2">{t('Environment Control')}</h3>
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
                            <FermentationResult
                                socket={socket}
                                selectedLocation={selectedLocation}
                            />

                            {/* Temperature Chart */}
                            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-3 text-black dark:text-white transition-colors duration-300">
                                <div className="flex items-center justify-between">
                                    <h2 className="text-base font-semibold text-gray-800 dark:text-gray-200">{t('Temperature')}</h2>
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
                                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-1 transition-colors duration-300">
                                    {isLoadingLocations ? (
                                        <div className="flex justify-center items-center h-[400px] text-base text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-700 rounded-lg">
                                            <i className="fas fa-spinner fa-spin mr-2"></i>
                                            {t('Loading temperature data...')}
                                        </div>
                                    ) : (
                                        <ComponentLoader height={700}>
                                            {/* <SpatialTemperatureMap /> */}
                                        </ComponentLoader>
                                    )}
                                </div>
                            ) : (
                                <div className="bg-gray-50 dark:bg-gray-800 rounded-lg shadow-md h-[400px] flex justify-center items-center transition-colors duration-300">
                                    <div className="text-center text-gray-600 dark:text-gray-400">
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
                        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-3 transition-colors duration-300">
                            <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-2 flex items-center gap-2">
                                <span className="text-base">📊</span>
                                {t('Additional Sensors')}
                            </h3>
                            <IPCamera selectedLocation={selectedLocation} />
                            <Chatbot />
                        </div>

                        {/* New Sensors Card 2 */}
                        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-3 transition-colors duration-300">
                            <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-2 flex items-center gap-2">
                                <span className="text-base">⚡</span>
                                {t('Power Monitoring')}
                            </h3>
                            <div className="space-y-2">
                                <div className="bg-gray-50 dark:bg-gray-700 rounded-md p-2 border border-gray-200 dark:border-gray-600">
                                    <div className="flex items-center justify-between mb-1">
                                        <span className="text-xs font-medium text-gray-700 dark:text-gray-300">{t('Voltage')}</span>
                                        <span className="inline-flex h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse"></span>
                                    </div>
                                    <div className="text-lg font-bold text-purple-600 dark:text-purple-400">220V</div>
                                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">{t('Stable')}</div>
                                </div>

                                <div className="bg-gray-50 dark:bg-gray-700 rounded-md p-2 border border-gray-200 dark:border-gray-600">
                                    <div className="flex items-center justify-between mb-1">
                                        <span className="text-xs font-medium text-gray-700 dark:text-gray-300">{t('Current')}</span>
                                        <span className="inline-flex h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse"></span>
                                    </div>
                                    <div className="text-lg font-bold text-orange-600 dark:text-orange-400">2.4A</div>
                                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">{t('Normal')}</div>
                                </div>
                            </div>
                        </div>

                        {/* New Sensors Card 3 */}
                        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-3 transition-colors duration-300">
                            <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-2 flex items-center gap-2">
                                <span className="text-base">🔔</span>
                                {t('System Alerts')}
                            </h3>
                            <div className="space-y-1.5">
                                <div className="bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-700 rounded-md p-2">
                                    <div className="flex items-center gap-1.5">
                                        <span className="text-green-600 dark:text-green-400 text-xs">✓</span>
                                        <span className="text-xs text-gray-700 dark:text-gray-300">{t('All systems operational')}</span>
                                    </div>
                                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{t('Updated 2 min ago')}</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* MOBILE/TABLET LAYOUT - Glassy Design (< 1024px) */}
                <div className="lg:hidden flex flex-col h-full relative bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 transition-colors duration-300">
                    {/* Content Area - Scrollable */}
                    <div className="flex-1 overflow-y-auto pb-24 pt-2">
                        {/* LEFT COLUMN CONTENT - Controls */}
                        {activeTab === 'left' && (
                            <div className="space-y-4 tab-content px-2">
                                {/* Current Environment */}
                                <div className="glass-card dark:glass-card-dark rounded-2xl p-4">
                                    <CurrentEnvironment selectedLocation={selectedLocation} />
                                </div>

                                {/* Environment Control */}
                                <div className="glass-card dark:glass-card-dark rounded-2xl p-4">
                                    <h3 className="text-sm font-bold text-gray-800 dark:text-gray-200 mb-3 flex items-center gap-2">
                                        <span className="text-2xl">🎛️</span>
                                        <span className="bg-gradient-to-r from-blue-600 to-purple-600 dark:from-blue-400 dark:to-purple-400 bg-clip-text text-transparent">
                                            {t('Environment Control')}
                                        </span>
                                    </h3>
                                    <EnvironmentControl
                                        selectedLocation={selectedLocation}
                                        targetTemperature={targetTemperature}
                                        setTargetTemperature={setTargetTemperature}
                                    />
                                </div>
                            </div>
                        )}

                        {/* MIDDLE COLUMN CONTENT - Charts */}
                        {activeTab === 'middle' && (
                            <div className="space-y-4 tab-content px-2">
                                <div className="glass-card dark:glass-card-dark rounded-2xl p-4">
                                    <FermentationResult
                                        socket={socket}
                                        selectedLocation={selectedLocation}
                                    />
                                </div>

                                {/* Temperature Chart */}
                                <div className="glass-card dark:glass-card-dark rounded-2xl p-4">
                                    <div className="flex items-center justify-between mb-3">
                                        <h2 className="text-base font-bold text-gray-800 dark:text-gray-200 flex items-center gap-2">
                                            <span className="text-2xl">🌡️</span>
                                            <span className="bg-gradient-to-r from-orange-600 to-red-600 dark:from-orange-400 dark:to-red-400 bg-clip-text text-transparent">
                                                {t('Temperature')}
                                            </span>
                                        </h2>
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
                                    <div className="glass-card dark:glass-card-dark rounded-2xl p-3">
                                        {isLoadingLocations ? (
                                            <div className="flex justify-center items-center h-[300px] text-base text-gray-700 dark:text-gray-300">
                                                <i className="fas fa-spinner fa-spin mr-2"></i>
                                                {t('Loading temperature data...')}
                                            </div>
                                        ) : (
                                            <ComponentLoader height={500}>
                                                {/* <SpatialTemperatureMap /> */}
                                            </ComponentLoader>
                                        )}
                                    </div>
                                ) : (
                                    <div className="glass-card dark:glass-card-dark rounded-2xl h-[300px] flex justify-center items-center">
                                        <div className="text-center text-gray-700 dark:text-gray-300">
                                            <i className="fas fa-hourglass-half fa-2x mb-2"></i>
                                            <div className="text-sm font-medium">{t('Loading advanced features...')}</div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* RIGHT COLUMN CONTENT - Sensors */}
                        {activeTab === 'right' && (
                            <div className="space-y-4 tab-content px-2">
                                {/* Additional Sensors Card */}
                                <div className="glass-card dark:glass-card-dark rounded-2xl p-4">
                                    <h3 className="text-sm font-bold text-gray-800 dark:text-gray-200 mb-3 flex items-center gap-2">
                                        <span className="text-2xl">📊</span>
                                        <span className="bg-gradient-to-r from-green-600 to-teal-600 dark:from-green-400 dark:to-teal-400 bg-clip-text text-transparent">
                                            {t('Additional Sensors')}
                                        </span>
                                    </h3>
                                    <IPCamera selectedLocation={selectedLocation} />
                                    <Chatbot />
                                </div>

                                {/* Power Monitoring Card */}
                                <div className="glass-card dark:glass-card-dark rounded-2xl p-4">
                                    <h3 className="text-sm font-bold text-gray-800 dark:text-gray-200 mb-4 flex items-center gap-2">
                                        <span className="text-2xl">⚡</span>
                                        <span className="bg-gradient-to-r from-yellow-600 to-orange-600 dark:from-yellow-400 dark:to-orange-400 bg-clip-text text-transparent">
                                            {t('Power Monitoring')}
                                        </span>
                                    </h3>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="glass-card dark:glass-card-dark rounded-xl p-3 glow-effect">
                                            <div className="flex items-center justify-between mb-2">
                                                <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">{t('Voltage')}</span>
                                                <span className="inline-flex h-2.5 w-2.5 rounded-full bg-gradient-to-r from-green-400 to-emerald-500 animate-pulse shadow-lg shadow-green-500/50"></span>
                                            </div>
                                            <div className="text-3xl font-black bg-gradient-to-r from-purple-600 to-pink-600 dark:from-purple-400 dark:to-pink-400 bg-clip-text text-transparent">
                                                220V
                                            </div>
                                            <div className="text-xs text-gray-600 dark:text-gray-400 mt-1 font-semibold">{t('Stable')}</div>
                                        </div>

                                        <div className="glass-card dark:glass-card-dark rounded-xl p-3 glow-effect">
                                            <div className="flex items-center justify-between mb-2">
                                                <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">{t('Current')}</span>
                                                <span className="inline-flex h-2.5 w-2.5 rounded-full bg-gradient-to-r from-green-400 to-emerald-500 animate-pulse shadow-lg shadow-green-500/50"></span>
                                            </div>
                                            <div className="text-3xl font-black bg-gradient-to-r from-orange-600 to-red-600 dark:from-orange-400 dark:to-red-400 bg-clip-text text-transparent">
                                                2.4A
                                            </div>
                                            <div className="text-xs text-gray-600 dark:text-gray-400 mt-1 font-semibold">{t('Normal')}</div>
                                        </div>
                                    </div>
                                </div>

                                {/* System Alerts Card */}
                                <div className="glass-card dark:glass-card-dark rounded-2xl p-4">
                                    <h3 className="text-sm font-bold text-gray-800 dark:text-gray-200 mb-3 flex items-center gap-2">
                                        <span className="text-2xl">🔔</span>
                                        <span className="bg-gradient-to-r from-blue-600 to-cyan-600 dark:from-blue-400 dark:to-cyan-400 bg-clip-text text-transparent">
                                            {t('System Alerts')}
                                        </span>
                                    </h3>
                                    <div className="space-y-2">
                                        <div className="glass-card dark:glass-card-dark rounded-xl p-3 border-green-300 dark:border-green-700">
                                            <div className="flex items-center gap-2">
                                                <span className="text-green-600 dark:text-green-400 text-lg font-bold">✓</span>
                                                <span className="text-xs text-gray-700 dark:text-gray-300 flex-1 font-semibold">{t('All systems operational')}</span>
                                            </div>
                                            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 ml-7">{t('Updated 2 min ago')}</div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Bottom Navigation Bar - Compact & Extra Blurry */}
                    <div className="fixed bottom-0 left-0 right-0 lg:hidden glass-nav dark:glass-nav-dark z-50">
                        <div className="flex items-center justify-around px-2 py-0.5 max-w-lg mx-auto">
                            {/* Controls Tab */}
                            <button
                                onClick={() => setActiveTab('left')}
                                className={`flex flex-col items-center justify-center py-1.5 px-3 rounded-xl transition-all duration-300 transform ${activeTab === 'left'
                                    ? 'glass-button-active text-white scale-105 -translate-y-1'
                                    : 'glass-button dark:glass-button-dark text-gray-600 dark:text-gray-300 hover:scale-105'
                                    }`}
                            >
                                <span className="text-xl mb-0.5">🎛️</span>
                                <span className={`text-[10px] font-bold ${activeTab === 'left' ? 'text-white' : 'text-gray-700 dark:text-gray-300'}`}>
                                    {t('Data Controls')}
                                </span>
                            </button>

                            {/* Charts Tab */}
                            <button
                                onClick={() => setActiveTab('middle')}
                                className={`flex flex-col items-center justify-center py-1.5 px-3 rounded-xl transition-all duration-300 transform ${activeTab === 'middle'
                                    ? 'glass-button-active text-white scale-105 -translate-y-1'
                                    : 'glass-button dark:glass-button-dark text-gray-600 dark:text-gray-300 hover:scale-105'
                                    }`}
                            >
                                <span className="text-xl mb-0.5">📈</span>
                                <span className={`text-[10px] font-bold ${activeTab === 'middle' ? 'text-white' : 'text-gray-700 dark:text-gray-300'}`}>
                                    {t('Charts')}
                                </span>
                            </button>

                            {/* Sensors Tab */}
                            <button
                                onClick={() => setActiveTab('right')}
                                className={`flex flex-col items-center justify-center py-1.5 px-3 rounded-xl transition-all duration-300 transform ${activeTab === 'right'
                                    ? 'glass-button-active text-white scale-105 -translate-y-1'
                                    : 'glass-button dark:glass-button-dark text-gray-600 dark:text-gray-300 hover:scale-105'
                                    }`}
                            >
                                <span className="text-xl mb-0.5">📊</span>
                                <span className={`text-[10px] font-bold ${activeTab === 'right' ? 'text-white' : 'text-gray-700 dark:text-gray-300'}`}>
                                    {t('AI & Camera')}
                                </span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>

        </div>
    );
};

export default Dashboard;
