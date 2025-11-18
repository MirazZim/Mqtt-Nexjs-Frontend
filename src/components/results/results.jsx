"use client";
import React, { useState, useEffect } from 'react';
import { useTranslation } from '../../app/i18n/client.js';
import { usePathname } from 'next/navigation';

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

    // ✅ Listen for actuatorUpdate and filter by room code
    useEffect(() => {
        if (!socket || !selectedLocation) {
            console.warn('[FermentationResult] Missing socket or selectedLocation');
            return;
        }

        // ✅ Join location-based room
        console.log(`[FermentationResult] Joining location_${selectedLocation}`);
        socket.emit('joinRoom', `location_${selectedLocation}`);

        const handleActuatorUpdate = (data) => {
            console.log('[FermentationResult] actuatorUpdate received:', data);

            // ✅ Filter for results actuator type
            if (data.actuatorType !== 'results') {
                return;
            }

            // ✅ Match by room code (flexible matching)
            const roomMatches =
                data.roomCode == selectedLocation ||
                String(data.roomCode) === String(selectedLocation);

            if (!roomMatches) {
                console.log(`[FermentationResult] Ignoring result from room ${data.roomCode} (expected ${selectedLocation})`);
                return;
            }

            console.log(`[FermentationResult] ✅ Processing results update:`, data);

            // Update state
            setResultStatus({
                message: data.message || data.status || 'Status received',
                status: data.status || 'UNKNOWN',
                lastUpdate: new Date(),
                isActive: data.state === 1 || data.numericState === 1
            });
        };

        // Register listener
        socket.on('actuatorUpdate', handleActuatorUpdate);
        console.log('[FermentationResult] Registered actuatorUpdate listener for:', selectedLocation);

        return () => {
            socket.off('actuatorUpdate', handleActuatorUpdate);
        };
    }, [socket, selectedLocation]);

    // Helper function to determine status color and icon
    const getStatusDisplay = () => {
        const message = resultStatus.message.toLowerCase();

        if (message.includes('complete')) {
            return {
                bgColor: 'from-green-50 to-emerald-50',
                borderColor: 'border-green-200',
                icon: '✅',
                iconBg: 'bg-green-100',
                textColor: 'text-green-700',
                dotColor: 'bg-green-500'
            };
        } else if (message.includes('ongoing') || message.includes('going')) {
            return {
                bgColor: 'from-blue-50 to-cyan-50',
                borderColor: 'border-blue-200',
                icon: '🔄',
                iconBg: 'bg-blue-100',
                textColor: 'text-blue-700',
                dotColor: 'bg-blue-500'
            };
        } else if (message.includes('check') || message.includes('off')) {
            return {
                bgColor: 'from-amber-50 to-yellow-50',
                borderColor: 'border-amber-200',
                icon: '⚠️',
                iconBg: 'bg-amber-100',
                textColor: 'text-amber-700',
                dotColor: 'bg-amber-500'
            };
        } else if (message.includes('waiting')) {
            return {
                bgColor: 'from-gray-50 to-slate-50',
                borderColor: 'border-gray-200',
                icon: '⏳',
                iconBg: 'bg-gray-100',
                textColor: 'text-gray-600',
                dotColor: 'bg-gray-400'
            };
        } else {
            return {
                bgColor: 'from-red-50 to-rose-50',
                borderColor: 'border-red-200',
                icon: '❌',
                iconBg: 'bg-red-100',
                textColor: 'text-red-700',
                dotColor: 'bg-red-500'
            };
        }
    };

    const statusDisplay = getStatusDisplay();

    return (
        <div className={`bg-gradient-to-br ${statusDisplay.bgColor} rounded-lg p-4 border-2 ${statusDisplay.borderColor} shadow-sm hover:shadow-md transition-all`}>
            {/* Header */}
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                    <div className={`w-8 h-8 ${statusDisplay.iconBg} rounded-full flex items-center justify-center text-lg`}>
                        {statusDisplay.icon}
                    </div>
                    <h3 className="text-sm font-bold text-gray-800">
                        {t('Fermentation Status')}
                    </h3>
                </div>
                {resultStatus.lastUpdate && (
                    <span className={`inline-flex h-2 w-2 rounded-full ${statusDisplay.dotColor} animate-pulse`}></span>
                )}
            </div>

            {/* Status Message */}
            <div className={`${statusDisplay.textColor} text-base font-semibold mb-3 leading-relaxed`}>
                {resultStatus.message}
            </div>

            {/* Last Update Timestamp */}
            {resultStatus.lastUpdate && (
                <div className="pt-2 border-t border-gray-200/50 flex items-center gap-1.5 text-10px text-gray-500">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>{t('Updated:')} {resultStatus.lastUpdate.toLocaleTimeString()}</span>
                </div>
            )}

            {/* Debug Info */}
            {process.env.NODE_ENV === 'development' && (
                <div className="mt-2 p-2 bg-gray-100 rounded text-9px font-mono text-gray-600">
                    Room: {selectedLocation} | Status: {resultStatus.status}
                </div>
            )}
        </div>
    );
};

export default FermentationResult;
