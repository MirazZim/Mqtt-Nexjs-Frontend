'use client';

import React, { useState, useEffect, useContext } from 'react';
import { createSocket } from '../../../lib/socket';
import AuthContext from '../../../context/AuthContext';
import { usePathname } from 'next/navigation';
import { useTranslation } from '../../../app/i18n/client.js';

const BowlFanStatus = ({ selectedLocation }) => {
    const { user } = useContext(AuthContext);

    const pathname = usePathname();
    const lng = pathname.split("/")[1];
    const { t } = useTranslation(lng, "bowlfan");

    // ✅ FIX: Store keys, not translated text
    const [fanStatus, setFanStatus] = useState({
        statusKey: null,           // Changed from 'status'
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
            console.log('🌀 Bowl Fan Status connected');
            setConnected(true);

            socketConnection.emit('registerUser', {
                userId: user.id,
                room: selectedLocation
            });
            console.log(`🌀 Registered for location: ${selectedLocation}`);
        });

        socketConnection.on('disconnect', () => {
            console.log('🌀 Bowl Fan Status disconnected');
            setConnected(false);
        });

        socketConnection.on('bowlFanUpdate', (data) => {
            console.log('🌀 Fan status update:', data);

            const isFanOn = data.state === 'FO' || parseInt(data.state) === 1;

            // ✅ FIX: Store keys instead of translated text
            setFanStatus({
                statusKey: isFanOn ? 'ON' : 'OFF',  // Store key
                messageKey: isFanOn ? 'Temp High, Fan is ON' : 'Temp normal, Fan off',  // Store key
                active: isFanOn,
                lastUpdate: new Date()
            });
        });

        return () => {
            socketConnection.disconnect();
        };
    }, [user, selectedLocation]); // ✅ FIX: Removed 't' from dependencies

    return (
        <div className={`p-4 rounded-lg border transition-all ${fanStatus.active
            ? 'bg-red-50 border-red-300 shadow-md'
            : 'bg-green-50 border-green-300 shadow-sm'
            }`}>
            {/* Title with Bowl Name */}
            <div className="flex items-center justify-between mb-3">
                <div>
                    <h3 className="text-sm font-bold text-gray-800">
                        🌀{t('Bowl Cooling System')}
                    </h3>
                    <p className="text-xs text-gray-500 mt-0.5">
                        {t('Bowl Name')}: {t('Fermentation Tank 01')}
                    </p>
                </div>
                <div className={`px-3 py-1 rounded-full text-xs font-semibold ${fanStatus.active
                    ? 'bg-red-200 text-red-700'
                    : 'bg-green-200 text-green-700'
                    }`}>
                    {/* ✅ FIX: Translate key at render time */}
                    {fanStatus.statusKey ? t(fanStatus.statusKey) : t('OFFLINE')}
                </div>
            </div>

            {/* Message */}
            <p className={`text-sm font-medium mb-3 ${fanStatus.active ? 'text-red-700' : 'text-green-700'
                }`}>
                {/* ✅ FIX: Translate key at render time */}
                {t(fanStatus.messageKey)}
            </p>

            {/* Footer */}
            <div className="flex items-center justify-between text-xs text-gray-600 pt-2 border-t border-gray-200">
                <span>
                    {fanStatus.lastUpdate
                        ? fanStatus.lastUpdate.toLocaleTimeString()
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

export default BowlFanStatus;
