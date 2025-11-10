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

    // ✅ FIX: Remove t() from initial state - use plain strings or null
    const [brokerStatus, setBrokerStatus] = useState({
        connected: false,
        lastSeen: null,
        statusKey: 'Connecting..', // Store key, not translated text
        lastHeartbeat: null
    });

    const [sensorStatus, setSensorStatus] = useState({
        active: false,
        lastDataReceived: null,
        statusKey: 'No Data' // Store key, not translated text
    });

    const [connectionStatusKey, setConnectionStatusKey] = useState('Connecting...');
    const sensorTimeoutRef = useRef(null);

    // Set sensor timeout when data is received
    const setSensorTimeout = () => {
        if (sensorTimeoutRef.current) {
            clearTimeout(sensorTimeoutRef.current);
        }

        sensorTimeoutRef.current = setTimeout(() => {
            setSensorStatus(prev => ({
                ...prev,
                active: false,
                statusKey: 'No Recent Data' // ✅ Store key
            }));
            if (brokerStatus.connected) {
                setConnectionStatusKey('Broker Connected - Sensor Timeout');
            }
        }, 5000);
    };

    // Socket connection and broker status
    useEffect(() => {
        if (!user || !selectedLocation) return;

        const socket = createSocket(user.token);

        const brokerHealthCheck = setInterval(() => {
            if (socket.connected) {
                setBrokerStatus(prev => ({
                    ...prev,
                    lastHeartbeat: new Date(),
                    statusKey: 'Connected' // ✅ Store key
                }));
                socket.emit('ping');
            } else {
                setBrokerStatus(prev => ({
                    ...prev,
                    connected: false,
                    statusKey: 'Disconnected', // ✅ Store key
                    lastHeartbeat: null
                }));

                setSensorStatus({
                    active: false,
                    lastDataReceived: null,
                    statusKey: 'No Data' // ✅ Store key
                });

                setConnectionStatusKey('Broker Disconnected');
            }
        }, 1000);

        socket.on('connect', () => {
            setBrokerStatus({
                connected: true,
                lastSeen: new Date(),
                statusKey: 'Connected', // ✅ Store key
                lastHeartbeat: new Date()
            });
            setConnectionStatusKey('Broker Connected - Waiting for Sensor Data');
            socket.emit('joinLocation', selectedLocation);
        });

        socket.on('pong', () => {
            setBrokerStatus(prev => ({
                ...prev,
                lastHeartbeat: new Date()
            }));
        });

        socket.on('disconnect', () => {
            setBrokerStatus({
                connected: false,
                lastSeen: null,
                statusKey: 'Disconnected' // ✅ Store key
            });
            setSensorStatus({
                active: false,
                lastDataReceived: null,
                statusKey: 'No Data' // ✅ Store key
            });
            setConnectionStatusKey('Disconnected');

            if (sensorTimeoutRef.current) {
                clearTimeout(sensorTimeoutRef.current);
                sensorTimeoutRef.current = null;
            }
        });

        socket.on('environmentUpdate', (data) => {
            if (data.location === selectedLocation && data.userId === user.id) {
                setSensorStatus({
                    active: true,
                    lastDataReceived: new Date(),
                    statusKey: 'Receiving Data' // ✅ Store key
                });
                setConnectionStatusKey('Broker & Sensors Connected');
                setSensorTimeout();
            }
        });

        socket.on('environmentControlUpdate', (data) => {
            if (data.location === selectedLocation && data.userId === user.id) {
                setSensorStatus(prev => ({
                    ...prev,
                    active: true,
                    lastDataReceived: new Date(),
                    statusKey: 'Receiving Data' // ✅ Store key
                }));

                if (brokerStatus.connected) {
                    setConnectionStatusKey('Broker & Sensors Connected');
                }
                setSensorTimeout();
            }
        });

        socket.on('controlUpdate', (data) => {
            if (data.location === selectedLocation && data.userId === user.id) {
                setSensorStatus(prev => ({
                    ...prev,
                    active: true,
                    lastDataReceived: new Date(),
                    statusKey: 'Receiving Data' // ✅ Store key
                }));

                if (brokerStatus.connected) {
                    setConnectionStatusKey('Broker & Sensors Connected');
                }
                setSensorTimeout();
            }
        });

        socket.on('connect_error', (error) => {
            setBrokerStatus({
                connected: false,
                lastSeen: null,
                statusKey: 'Connection Error' // ✅ Store key
            });
            setConnectionStatusKey('Connection Error');
        });

        return () => {
            clearInterval(brokerHealthCheck);
            if (sensorTimeoutRef.current) {
                clearTimeout(sensorTimeoutRef.current);
                sensorTimeoutRef.current = null;
            }
            socket.emit('leaveLocation', selectedLocation);
            socket.disconnect();
        };
    }, [user, selectedLocation]); // ✅ Remove 't' from dependencies

    useEffect(() => {
        const timer = setTimeout(() => setIsInitialLoad(false), 3500);
        return () => clearTimeout(timer);
    }, []);

    const formatTimestamp = (timestamp) => {
        if (!timestamp) return t('Never');
        return timestamp.toLocaleString();
    };

    return (
        <div className="space-y-2">
            <div className="flex items-center gap-2 pb-2 border-b border-gray-200">
                <div className="w-7 h-7 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-md flex items-center justify-center text-white text-sm">
                    📡
                </div>
                <h2 className="text-base font-bold text-gray-800">{t('Device Status')}</h2>
            </div>

            <div className="flex items-center gap-1.5 text-gray-600 bg-gray-50 px-2 py-1.5 rounded-md">
                <svg className="w-4 h-4 text-teal-600" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                </svg>
                <span className="text-xs">{t('Location:')}</span>
                <strong className="text-xs text-gray-800">{selectedLocation}</strong>
            </div>

            <div className="space-y-2">
                {/* Broker Status Card */}
                <div className={`rounded-lg p-2 border transition-all duration-300 ${brokerStatus.connected
                        ? 'bg-green-50 border-green-200'
                        : 'bg-red-50 border-red-200'
                    }`}>
                    <div className="flex items-start gap-2">
                        <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${brokerStatus.connected ? 'bg-green-100' : 'bg-red-100'
                            }`}>
                            <FaWifi className={`text-sm ${brokerStatus.connected ? 'text-green-600' : 'text-red-600'
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

                            {/* ✅ FIX: Translate the key at render time */}
                            <p className={`text-xs font-medium mb-1 ${brokerStatus.connected ? 'text-green-700' : 'text-red-700'
                                }`}>
                                {t(brokerStatus.statusKey)}
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

                            {/* ✅ FIX: Translate the key at render time */}
                            <p className={`text-xs font-medium mb-1 ${sensorStatus.active
                                    ? 'text-blue-700'
                                    : brokerStatus.connected
                                        ? 'text-yellow-700'
                                        : 'text-gray-700'
                                }`}>
                                {t(sensorStatus.statusKey)}
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
