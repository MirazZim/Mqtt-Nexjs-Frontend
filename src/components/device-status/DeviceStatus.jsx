"use client";
import React, { useState, useEffect, useContext, useRef } from 'react';
import { FaWifi, FaSignal } from 'react-icons/fa';
import { createSocket } from '../../lib/socket';
import AuthContext from '../../context/AuthContext';
import { usePathname } from 'next/navigation';
import { useTranslation } from '../../app/i18n/client.js';

const DeviceStatus = ({ selectedLocation }) => {
    const { user } = useContext(AuthContext);
    const pathname = usePathname();
    const lng = pathname.split("/")[1];
    const { t } = useTranslation(lng, "device-status");

    const [isInitialLoad, setIsInitialLoad] = useState(true);

    // Separate broker and sensor status
    const [brokerStatus, setBrokerStatus] = useState({
        connected: false,
        lastSeen: null,
        status: t('Connecting...'),
        lastHeartbeat: null
    });

    const [sensorStatus, setSensorStatus] = useState({
        active: false,
        lastDataReceived: null,
        status: t('No Data')
    });

    const [connectionStatus, setConnectionStatus] = useState(t('Connecting...'));

    const [controlState, setControlState] = useState({
        heaterState: false,
        coolerState: false,
        humidifierState: false,
        dehumidifierState: false,
        fanLevel: 0,
        controlMode: 'auto'
    });

    // Add sensor timeout ref for zero-delay detection
    const sensorTimeoutRef = useRef(null);

    // Set sensor timeout when data is received - ZERO DELAY LOGIC
    const setSensorTimeout = () => {
        if (sensorTimeoutRef.current) {
            clearTimeout(sensorTimeoutRef.current);
        }

        // 5 SECOND TIMEOUT for instant detection
        sensorTimeoutRef.current = setTimeout(() => {
            //console.log('⚡ DeviceStatus sensor timeout - no data for 5 seconds');
            setSensorStatus(prev => ({ ...prev, active: false, status: t('No Recent Data') }));
            if (brokerStatus.connected) {
                setConnectionStatus(t('Broker Connected - Sensor Timeout'));
            }
        }, 5000); // 5 second timeout
    };

    // Socket connection and broker status
    useEffect(() => {
        if (!user || !selectedLocation) return;

        const socket = createSocket(user.token);

        // Add broker health check interval
        const brokerHealthCheck = setInterval(() => {
            if (socket.connected) {
                // Update broker status with current timestamp
                setBrokerStatus(prev => ({
                    ...prev,
                    lastHeartbeat: new Date(),
                    status: t('Connected')
                }));

                // Optional: Send a ping to verify broker responsiveness
                socket.emit('ping');

                //console.log('💓 Broker health check - Connected');
            } else {
                // Broker is disconnected
                setBrokerStatus(prev => ({
                    ...prev,
                    connected: false,
                    status: t('Disconnected'),
                    lastHeartbeat: null
                }));

                setSensorStatus({
                    active: false,
                    lastDataReceived: null,
                    status: t('No Data')
                });

                setConnectionStatus(t('Broker Disconnected'));
                //console.log('💔 Broker health check - Disconnected');
            }
        }, 1000); // Check every 1 second

        // Broker connection events
        socket.on('connect', () => {
            // console.log('🔗 Broker connected');
            setBrokerStatus({
                connected: true,
                lastSeen: new Date(),
                status: t('Connected'),
                lastHeartbeat: new Date() // Add heartbeat timestamp
            });
            setConnectionStatus(t('Broker Connected - Waiting for Sensor Data'));
            socket.emit('joinLocation', selectedLocation);
        });

        socket.on('pong', () => {
            setBrokerStatus(prev => ({
                ...prev,
                lastHeartbeat: new Date()
            }));
        });

        socket.on('disconnect', () => {
            //console.log('🔗 Broker disconnected');
            setBrokerStatus({
                connected: false,
                lastSeen: null,
                status: t('Disconnected')
            });
            setSensorStatus({
                active: false,
                lastDataReceived: null,
                status: t('No Data')
            });
            setConnectionStatus(t('Disconnected'));

            // Clear sensor timeout when disconnected
            if (sensorTimeoutRef.current) {
                clearTimeout(sensorTimeoutRef.current);
                sensorTimeoutRef.current = null;
            }
        });

        // Sensor data events - ZERO DELAY updates
        socket.on('environmentUpdate', (data) => {
            if (data.location === selectedLocation && data.userId === user.id) {
                // console.log('📡 DeviceStatus sensor data received');

                // IMMEDIATE state update - ZERO DELAY
                setSensorStatus({
                    active: true,
                    lastDataReceived: new Date(),
                    status: t('Receiving Data')
                });
                setConnectionStatus(t('Broker & Sensors Connected'));

                // Reset sensor timeout
                setSensorTimeout();
            }
        });

        socket.on('environmentControlUpdate', (data) => {
            if (data.location === selectedLocation && data.userId === user.id) {
                //console.log('DeviceStatus control data received');

                // IMMEDIATE state updates - ZERO DELAY
                setControlState({
                    heaterState: data.heaterState || false,
                    coolerState: data.coolerState || false,
                    humidifierState: data.humidifierState || false,
                    dehumidifierState: data.dehumidifierState || false,
                    fanLevel: data.fanLevel || 0,
                    controlMode: data.controlMode || 'auto'
                });

                setSensorStatus(prev => ({
                    ...prev,
                    active: true,
                    lastDataReceived: new Date(),
                    status: t('Receiving Data')
                }));

                if (brokerStatus.connected) {
                    setConnectionStatus(t('Broker & Sensors Connected'));
                }

                // Reset sensor timeout
                setSensorTimeout();
            }
        });

        // Legacy support for temperature-only control updates
        socket.on('controlUpdate', (data) => {
            if (data.location === selectedLocation && data.userId === user.id) {
                // console.log('🌡️ DeviceStatus legacy control data received');

                setControlState(prev => ({
                    ...prev,
                    heaterState: data.heaterState || false,
                    coolerState: data.coolerState || false,
                    controlMode: data.controlMode || 'auto'
                }));

                setSensorStatus(prev => ({
                    ...prev,
                    active: true,
                    lastDataReceived: new Date(),
                    status: t('Receiving Data')
                }));

                if (brokerStatus.connected) {
                    setConnectionStatus(t('Broker & Sensors Connected'));
                }

                setSensorTimeout();
            }
        });

        socket.on('connect_error', (error) => {
            //  console.log('❌ DeviceStatus broker connection error:', error);
            setBrokerStatus({
                connected: false,
                lastSeen: null,
                status: t('Connection Error')
            });
            setConnectionStatus(t('Connection Error'));
        });

        return () => {
            // Clear broker health check interval
            clearInterval(brokerHealthCheck);
            // Cleanup sensor timeout
            if (sensorTimeoutRef.current) {
                clearTimeout(sensorTimeoutRef.current);
                sensorTimeoutRef.current = null;
            }
            socket.emit('leaveLocation', selectedLocation);
            socket.disconnect();
        };
    }, [user, selectedLocation, t]);

    useEffect(() => {
        // Delay initial load flag to prevent flash
        const timer = setTimeout(() => setIsInitialLoad(false), 3500);
        return () => clearTimeout(timer);
    }, []);

    const getOverallStatus = () => {
        if (brokerStatus.connected && sensorStatus.active) return 'online';
        if (brokerStatus.connected) return 'warning';
        return 'offline';
    };

    const formatTimestamp = (timestamp) => {
        if (!timestamp) return t('Never');
        return timestamp.toLocaleString();
    };

    return (
        <div className="space-y-2">
            {/* Header */}
            <div className="flex items-center gap-2 pb-2 border-b border-gray-200">
                <div className="w-7 h-7 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-md flex items-center justify-center text-white text-sm">
                    📡
                </div>
                <h2 className="text-base font-bold text-gray-800">{t('Device Status')}</h2>
            </div>

            {/* Location Info */}
            <div className="flex items-center gap-1.5 text-gray-600 bg-gray-50 px-2 py-1.5 rounded-md">
                <svg className="w-4 h-4 text-teal-600" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                </svg>
                <span className="text-xs">{t('Location:')}</span>
                <strong className="text-xs text-gray-800">{selectedLocation}</strong>
            </div>

            {/* Status Details */}
            <div className="space-y-2">

                {/* Broker Status Card */}
                <div className={`rounded-lg p-2 border transition-all duration-300 ${brokerStatus.connected
                    ? 'bg-green-50 border-green-200'
                    : 'bg-red-50 border-red-200'
                    }`}>
                    <div className="flex items-start gap-2">
                        <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${brokerStatus.connected
                            ? 'bg-green-100'
                            : 'bg-red-100'
                            }`}>
                            <FaWifi className={`text-sm ${brokerStatus.connected
                                ? 'text-green-600'
                                : 'text-red-600'
                                }`} />
                        </div>

                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 mb-0.5">
                                <h4 className="text-xs font-semibold text-gray-800">{t('MQTT Broker')}</h4>
                                <span className={`inline-block w-1.5 h-1.5 rounded-full ${brokerStatus.connected
                                    ? 'bg-green-500 animate-pulse'
                                    : 'bg-red-500'
                                    }`}></span>
                            </div>

                            <p className={`text-xs font-medium mb-1 ${brokerStatus.connected
                                ? 'text-green-700'
                                : 'text-red-700'
                                }`}>
                                {brokerStatus.status}
                            </p>

                            <div className="space-y-0.5 text-[10px] text-gray-600">
                                {brokerStatus.lastSeen && (
                                    <div className="flex items-center gap-1">
                                        <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                        {t('Connected:')} {formatTimestamp(brokerStatus.lastSeen)}
                                    </div>
                                )}
                                {brokerStatus.lastHeartbeat && (
                                    <div className="flex items-center gap-1">
                                        <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                        {t('Last check:')} {formatTimestamp(brokerStatus.lastHeartbeat)}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Sensor Status Card */}
                <div className={`rounded-lg p-2 border transition-all duration-300 ${sensorStatus.active
                    ? 'bg-blue-50 border-blue-200'
                    : brokerStatus.connected
                        ? 'bg-yellow-50 border-yellow-200'
                        : 'bg-gray-50 border-gray-200'
                    }`}>
                    <div className="flex items-start gap-2">
                        <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${sensorStatus.active
                            ? 'bg-blue-100'
                            : brokerStatus.connected
                                ? 'bg-yellow-100'
                                : 'bg-gray-100'
                            }`}>
                            <FaSignal className={`text-sm ${sensorStatus.active
                                ? 'text-blue-600'
                                : brokerStatus.connected
                                    ? 'text-yellow-600'
                                    : 'text-gray-600'
                                }`} />
                        </div>

                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 mb-0.5">
                                <h4 className="text-xs font-semibold text-gray-800">{t('Sensor Data Stream')}</h4>
                                <span className={`inline-block w-1.5 h-1.5 rounded-full ${sensorStatus.active
                                    ? 'bg-blue-500 animate-pulse'
                                    : brokerStatus.connected
                                        ? 'bg-yellow-500 animate-pulse'
                                        : 'bg-gray-400'
                                    }`}></span>
                            </div>

                            <p className={`text-xs font-medium mb-1 ${sensorStatus.active
                                ? 'text-blue-700'
                                : brokerStatus.connected
                                    ? 'text-yellow-700'
                                    : 'text-gray-700'
                                }`}>
                                {sensorStatus.status}
                            </p>

                            {sensorStatus.lastDataReceived && (
                                <div className="flex items-center gap-1 text-[10px] text-gray-600">
                                    <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                                    </svg>
                                    {t('Last data:')} {formatTimestamp(sensorStatus.lastDataReceived)}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Control Status or No Data Message */}
                {sensorStatus.active ? (
                    <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-lg p-3 border border-purple-200">
                        <div className="text-center">
                            <div className="inline-flex items-center justify-center w-10 h-10 bg-white rounded-full shadow-sm mb-1.5">
                                <svg className="w-5 h-5 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                            </div>
                            <p className="text-xs font-medium text-gray-700">
                                ✅ {t('All systems operational')}
                            </p>
                            <p className="text-[10px] text-gray-500 mt-0.5">
                                {t('Sensors are actively streaming data')}
                            </p>
                        </div>
                    </div>
                ) : (
                    <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-lg p-3 border border-gray-200 text-center">
                        <div className="inline-flex items-center justify-center w-10 h-10 bg-white rounded-full shadow-sm mb-1.5">
                            <svg className={`w-5 h-5 ${brokerStatus.connected ? 'text-yellow-500 animate-pulse' : 'text-gray-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        </div>
                        <p className="text-xs font-medium text-gray-700">
                            {brokerStatus.connected
                                ? `⏳ ${t('Waiting for sensor data...')}`
                                : `📵 ${t('Connect to broker first')}`
                            }
                        </p>
                        <p className="text-[10px] text-gray-500 mt-0.5">
                            {brokerStatus.connected
                                ? t('5 second timeout for sensor activation')
                                : t('Establish broker connection to receive data')
                            }
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default DeviceStatus;
