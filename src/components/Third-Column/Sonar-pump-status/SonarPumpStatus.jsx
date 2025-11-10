'use client';

import React, { useState, useEffect, useContext } from 'react';
import { createSocket } from '../../../lib/socket';
import AuthContext from '../../../context/AuthContext';
import { usePathname } from 'next/navigation';
import { useTranslation } from '../../../app/i18n/client.js';

const SonarPumpStatus = ({ selectedLocation }) => {
    const { user } = useContext(AuthContext);

    const pathname = usePathname();
    const lng = pathname.split("/")[1];
    const { t } = useTranslation(lng, "pump");

    // ✅ FIX: Store keys, not translated text
    const [pumpStatus, setPumpStatus] = useState({
        statusKey: null,                      // Changed from 'status'
        messageKey: 'Waiting for status...',  // Changed from 'message'
        active: false,
        lastUpdate: null
    });
    const [socket, setSocket] = useState(null);
    const [connected, setConnected] = useState(false);

    useEffect(() => {
        if (!user || !selectedLocation) return;

        const socketConnection = createSocket(user.token);
        setSocket(socketConnection);

        socketConnection.on('connect', () => {
            console.log('💦 Sonar Pump Status connected');
            setConnected(true);

            socketConnection.emit('registerUser', {
                userId: user.id,
                room: selectedLocation
            });
            console.log(`💦 Registered for location: ${selectedLocation}`);
        });

        socketConnection.on('disconnect', () => {
            console.log('💦 Sonar Pump Status disconnected');
            setConnected(false);
        });

        socketConnection.on('pumpUpdate', (data) => {
            console.log('💦 Pump status update:', data);

            const isPumpOn = data.state === 'PO' || parseInt(data.state) === 1;

            // ✅ FIX: Store keys instead of translated text
            setPumpStatus({
                statusKey: isPumpOn ? 'ON' : 'OFF',  // Store key
                messageKey: isPumpOn ? 'Water level low, Pump is ON' : 'Water level normal, Pump is Off',  // Store key
                active: isPumpOn,
                lastUpdate: new Date()
            });
        });

        return () => {
            socketConnection.disconnect();
        };
    }, [user, selectedLocation]); // ✅ FIX: Removed 't' from dependencies

    return (
        <div className={`p-4 rounded-lg border transition-all ${pumpStatus.active
                ? 'bg-orange-50 border-orange-300 shadow-md'
                : 'bg-green-50 border-green-300 shadow-sm'
            }`}>
            {/* Title with Bowl Name */}
            <div className="flex items-center justify-between mb-3">
                <div>
                    <h3 className="text-sm font-bold text-gray-800">
                        💧{t('Water Level Control')}
                    </h3>
                    <p className="text-xs text-gray-500 mt-0.5">
                        {t('Bowl')}: {t('Fermentation Tank 01')}
                    </p>
                </div>
                <div className={`px-3 py-1 rounded-full text-xs font-semibold ${pumpStatus.active
                        ? 'bg-orange-200 text-orange-700'
                        : 'bg-green-200 text-green-700'
                    }`}>
                    {/* ✅ FIX: Translate key at render time */}
                    {pumpStatus.statusKey ? t(pumpStatus.statusKey) : t('OFFLINE')}
                </div>
            </div>

            {/* Message */}
            <p className={`text-sm font-medium mb-3 ${pumpStatus.active ? 'text-orange-700' : 'text-green-700'
                }`}>
                {/* ✅ FIX: Translate key at render time */}
                {t(pumpStatus.messageKey)}
            </p>

            {/* Footer */}
            <div className="flex items-center justify-between text-xs text-gray-600 pt-2 border-t border-gray-200">
                <span>
                    {pumpStatus.lastUpdate
                        ? pumpStatus.lastUpdate.toLocaleTimeString()
                        : t('Awaiting data...')
                    }
                </span>
                {!connected && (
                    <span className="text-red-600 font-medium">{t('Offline')}</span>
                )}
            </div>
        </div>
    );
};

export default SonarPumpStatus;
