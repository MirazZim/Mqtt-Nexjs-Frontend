"use client";
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslation } from '../../app/i18n/client.js';
import { usePathname } from 'next/navigation';

// ✅ Helper: Normalize room code for consistent comparison
const normalizeRoomCode = (value) => {
    if (value === null || value === undefined) return null;
    return String(value).trim();
};

// ✅ Helper: Check if room matches (extracted to avoid duplication)
const doesRoomMatch = (dataRoomCode, selectedLocation) => {
    const normalizedData = normalizeRoomCode(dataRoomCode);
    const normalizedSelected = normalizeRoomCode(selectedLocation);
    return normalizedData !== null && normalizedData === normalizedSelected;
};

// ✅ Helper: Deep equality check for actuator data
const isActuatorDataEqual = (prev, next) => {
    if (!prev || !next) return prev === next;
    return (
        prev.state === next.state &&
        prev.rawState === next.rawState &&
        prev.message === next.message &&
        prev.timestamp === next.timestamp
    );
};

// ✅ Memoized status display calculator (moved outside component)
const calculateStatusDisplay = (message) => {
    const lowerMessage = (message || '').toLowerCase();

    if (lowerMessage.includes('complete')) {
        return {
            bgColor: 'from-green-50 to-emerald-50',
            borderColor: 'border-green-200',
            icon: '✅',
            iconBg: 'bg-green-100',
            textColor: 'text-green-700',
            dotColor: 'bg-green-500'
        };
    }
    if (lowerMessage.includes('ongoing') || lowerMessage.includes('going')) {
        return {
            bgColor: 'from-blue-50 to-cyan-50',
            borderColor: 'border-blue-200',
            icon: '🔄',
            iconBg: 'bg-blue-100',
            textColor: 'text-blue-700',
            dotColor: 'bg-blue-500'
        };
    }
    if (lowerMessage.includes('check') || lowerMessage.includes('off')) {
        return {
            bgColor: 'from-amber-50 to-yellow-50',
            borderColor: 'border-amber-200',
            icon: '⚠️',
            iconBg: 'bg-amber-100',
            textColor: 'text-amber-700',
            dotColor: 'bg-amber-500'
        };
    }
    if (lowerMessage.includes('waiting')) {
        return {
            bgColor: 'from-gray-50 to-slate-50',
            borderColor: 'border-gray-200',
            icon: '⏳',
            iconBg: 'bg-gray-100',
            textColor: 'text-gray-600',
            dotColor: 'bg-gray-400'
        };
    }
    return {
        bgColor: 'from-red-50 to-rose-50',
        borderColor: 'border-red-200',
        icon: '❌',
        iconBg: 'bg-red-100',
        textColor: 'text-red-700',
        dotColor: 'bg-red-500'
    };
};

// ✅ Memoized actuator status display calculator
const calculateActuatorStatusDisplay = (actuator) => {
    const state = (actuator?.state || '').toUpperCase();
    const rawState = (actuator?.rawState || '').toUpperCase();

    if (state === 'ACTIVE' || state === 'ON' || rawState === 'AF' || rawState === 'FO' || rawState === 'PO') {
        return {
            bgColor: 'from-green-50 to-emerald-50',
            borderColor: 'border-green-200',
            icon: '🟢',
            iconBg: 'bg-green-100',
            textColor: 'text-green-700',
            dotColor: 'bg-green-500',
            statusLabel: state || 'ACTIVE'
        };
    }
    if (state === 'COMPLETE' || rawState === 'FFC') {
        return {
            bgColor: 'from-emerald-50 to-teal-50',
            borderColor: 'border-emerald-200',
            icon: '✅',
            iconBg: 'bg-emerald-100',
            textColor: 'text-emerald-700',
            dotColor: 'bg-emerald-500',
            statusLabel: 'COMPLETE'
        };
    }
    if (state === 'ONGOING' || rawState === 'FFO') {
        return {
            bgColor: 'from-blue-50 to-cyan-50',
            borderColor: 'border-blue-200',
            icon: '🔄',
            iconBg: 'bg-blue-100',
            textColor: 'text-blue-700',
            dotColor: 'bg-blue-500',
            statusLabel: 'ONGOING'
        };
    }
    if (state === 'CLOSED' || state === 'OFF' || rawState === 'CF' || rawState === 'FS' || rawState === 'PS') {
        return {
            bgColor: 'from-gray-50 to-slate-50',
            borderColor: 'border-gray-200',
            icon: '⚪',
            iconBg: 'bg-gray-100',
            textColor: 'text-gray-600',
            dotColor: 'bg-gray-400',
            statusLabel: state || 'OFF'
        };
    }
    return {
        bgColor: 'from-amber-50 to-yellow-50',
        borderColor: 'border-amber-200',
        icon: '❓',
        iconBg: 'bg-amber-100',
        textColor: 'text-amber-700',
        dotColor: 'bg-amber-500',
        statusLabel: state || 'UNKNOWN'
    };
};

// ✅ Memoized ActuatorCard component to prevent unnecessary re-renders
const ActuatorCard = React.memo(({ actuatorType, actuator, formatActuatorType, formatTimestamp }) => {
    const display = useMemo(() => calculateActuatorStatusDisplay(actuator), [actuator?.state, actuator?.rawState]);
    const formattedTime = useMemo(() => formatTimestamp(actuator?.timestamp), [actuator?.timestamp]);

    return (
        <div className={`bg-gradient-to-br ${display.bgColor} rounded-lg p-3 border-2 ${display.borderColor} shadow-sm hover:shadow-md transition-all`}>
            <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                    <div className={`w-7 h-7 ${display.iconBg} rounded-full flex items-center justify-center text-sm`}>
                        {display.icon}
                    </div>
                    <div>
                        <h4 className="text-xs font-bold text-gray-800">
                            {actuator.actuatorName || formatActuatorType(actuatorType)}
                        </h4>
                        {actuator.topic && (
                            <span className="text-[10px] text-gray-500">Topic: {actuator.topic}</span>
                        )}
                    </div>
                </div>
                <span className={`inline-flex h-2 w-2 rounded-full ${display.dotColor} animate-pulse`}></span>
            </div>
            <div className="flex items-center gap-2 mb-2">
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${display.textColor} ${display.iconBg}`}>
                    {display.statusLabel}
                </span>
                {actuator.rawState && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-gray-200 text-gray-600">
                        {actuator.rawState}
                    </span>
                )}
            </div>
            <div className={`${display.textColor} text-sm font-medium mb-2 leading-relaxed`}>
                {actuator.message || `Status: ${actuator.state}`}
            </div>
            {formattedTime && (
                <div className="pt-2 border-t border-gray-200/50 flex items-center gap-1.5 text-[10px] text-gray-500">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>{formattedTime}</span>
                </div>
            )}
        </div>
    );
});

ActuatorCard.displayName = 'ActuatorCard';

const FermentationResult = ({ socket, selectedLocation }) => {
    const pathname = usePathname();
    const lng = pathname.split("/")[1];
    const { t } = useTranslation(lng, "fermentation-result");

    const [resultStatus, setResultStatus] = useState({
        message: 'Waiting for status...',
        status: 'UNKNOWN',
        lastUpdate: null,
        isActive: false
    });

    const [actuatorData, setActuatorData] = useState({});

    // ✅ Memoized helper functions
    const formatActuatorType = useCallback((actuatorType) => {
        if (!actuatorType) return 'Unknown';
        return actuatorType
            .replace(/_/g, ' ')
            .replace(/status$/i, '')
            .trim()
            .split(' ')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
            .join(' ');
    }, []);

    const formatTimestamp = useCallback((timestamp) => {
        if (!timestamp) return null;
        const date = new Date(timestamp);
        return isNaN(date.getTime()) ? null : date.toLocaleTimeString();
    }, []);

    // ✅ Memoized status display
    const statusDisplay = useMemo(
        () => calculateStatusDisplay(resultStatus.message),
        [resultStatus.message]
    );

    // ✅ Memoized actuator entries
    const actuatorEntries = useMemo(
        () => Object.entries(actuatorData),
        [actuatorData]
    );

    const hasActuators = actuatorEntries.length > 0;

    useEffect(() => {
        if (!socket || !selectedLocation) {
            console.warn('[FermentationResult] Missing socket or selectedLocation');
            return;
        }

        // Clear data on location change
        setActuatorData({});
        setResultStatus({
            message: 'Waiting for status...',
            status: 'UNKNOWN',
            lastUpdate: null,
            isActive: false
        });

        console.log(`[FermentationResult] Joining location_${selectedLocation}`);
        socket.emit('joinRoom', `location_${selectedLocation}`);

        const handleActuatorUpdate = (data) => {
            // ✅ Use normalized room matching
            if (!doesRoomMatch(data.roomCode, selectedLocation)) {
                return;
            }

            const newActuatorData = {
                actuatorId: data.actuatorId,
                actuatorType: data.actuatorType,
                actuatorName: data.actuatorName,
                state: data.state,
                rawState: data.rawState,
                message: data.message,
                timestamp: data.timestamp,
                topic: data.topic,
                roomName: data.roomName
            };

            // ✅ Only update if data actually changed
            setActuatorData(prev => {
                const existing = prev[data.actuatorType];
                if (isActuatorDataEqual(existing, newActuatorData)) {
                    return prev; // No change, return same reference
                }
                return { ...prev, [data.actuatorType]: newActuatorData };
            });

            // Update legacy resultStatus for specific actuator types
            if (data.actuatorType === 'results' || 
                data.actuatorType === 'sugar_fermentation_status' || 
                data.topic === 'sugarT') {
                setResultStatus(prev => {
                    const newMessage = data.message || data.state || 'Status received';
                    const newStatus = data.state || 'UNKNOWN';
                    const newIsActive = data.state === 'ACTIVE' || data.state === 'ON' || 
                                       data.state === 'ONGOING' || data.rawState === 'FFO';
                    
                    // Only update if changed
                    if (prev.message === newMessage && prev.status === newStatus && prev.isActive === newIsActive) {
                        return prev;
                    }
                    return {
                        message: newMessage,
                        status: newStatus,
                        lastUpdate: new Date(),
                        isActive: newIsActive
                    };
                });
            }
        };

        socket.on('actuatorUpdate', handleActuatorUpdate);

        return () => {
            socket.off('actuatorUpdate', handleActuatorUpdate);
        };
    }, [socket, selectedLocation]);

    return (
        <div className="space-y-4">
            {hasActuators && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {actuatorEntries.map(([actuatorType, actuator]) => (
                        <ActuatorCard
                            key={actuatorType}
                            actuatorType={actuatorType}
                            actuator={actuator}
                            formatActuatorType={formatActuatorType}
                            formatTimestamp={formatTimestamp}
                        />
                    ))}
                </div>
            )}

            {!hasActuators && (
                <div className={`bg-gradient-to-br ${statusDisplay.bgColor} rounded-lg p-4 border-2 ${statusDisplay.borderColor} shadow-sm hover:shadow-md transition-all`}>
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                            <div className={`w-8 h-8 ${statusDisplay.iconBg} rounded-full flex items-center justify-center text-lg`}>
                                {statusDisplay.icon}
                            </div>
                            <h3 className="text-sm font-bold text-gray-800">{t('Fermentation Status')}</h3>
                        </div>
                        {resultStatus.lastUpdate && (
                            <span className={`inline-flex h-2 w-2 rounded-full ${statusDisplay.dotColor} animate-pulse`}></span>
                        )}
                    </div>
                    <div className={`${statusDisplay.textColor} text-base font-semibold mb-3 leading-relaxed`}>
                        {resultStatus.message}
                    </div>
                    {resultStatus.lastUpdate && (
                        <div className="pt-2 border-t border-gray-200/50 flex items-center gap-1.5 text-[10px] text-gray-500">
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <span>{t('Updated:')} {resultStatus.lastUpdate.toLocaleTimeString()}</span>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default FermentationResult;
