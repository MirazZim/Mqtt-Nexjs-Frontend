'use client';

import React, { useState, useEffect, useContext } from 'react';
import { createSocket } from '../../../lib/socket';
import AuthContext from '../../../context/AuthContext';
import { usePathname } from 'next/navigation';  // ✅ ADD THIS
import { useTranslation } from '../../../app/i18n/client.js';  // ✅ ADD THIS

const BowlFanStatus = ({ selectedLocation }) => {
    const { user } = useContext(AuthContext);

    // ✅ ADD THESE LINES
    const pathname = usePathname();
    const lng = pathname.split("/")[1];
    const { t } = useTranslation(lng, "bowlfan");

    const [fanStatus, setFanStatus] = useState({
        status: null,
        message: t('Waiting for status...'),
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

            // ✅ FIXED: Use registerUser instead of joinLocation
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

        // ✅ FIXED: Listen to bowlFanUpdate (not bowlFanStatus)
        socketConnection.on('bowlFanUpdate', (data) => {
            console.log('🌀 Fan status update:', data);

            const isFanOn = data.state === 'FO' || parseInt(data.state) === 1;

            setFanStatus({
                status: isFanOn ? t('ON') : t('OFF'),
                message: isFanOn ? t('Temp High, Fan is ON') : t('Temp normal, Fan off'),
                active: isFanOn,
                lastUpdate: new Date()
            });
        });

        return () => {
            socketConnection.disconnect();
        };
    }, [user, selectedLocation, t]);

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
                    {fanStatus.status || t('OFFLINE')}
                </div>
            </div>

            {/* Message */}
            <p className={`text-sm font-medium mb-3 ${fanStatus.active ? 'text-red-700' : 'text-green-700'
                }`}>
                {fanStatus.message}
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
