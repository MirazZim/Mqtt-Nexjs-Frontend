'use client';

import React, { useState, useEffect, useContext } from 'react';
import { createSocket } from '../../../lib/socket';
import AuthContext from '../../../context/AuthContext';

const SonarPumpStatus = ({ selectedLocation }) => {
    const { user } = useContext(AuthContext);
    const [pumpStatus, setPumpStatus] = useState({
        status: null,
        message: 'Waiting for status...',
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

            // ✅ FIXED: Use registerUser instead of joinLocation
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

        // ✅ FIXED: Listen to pumpUpdate (not sonarPumpStatus)
        socketConnection.on('pumpUpdate', (data) => {
            console.log('💦 Pump status update:', data);

            const isPumpOn = data.state === 'PO' || parseInt(data.state) === 1;

            setPumpStatus({
                status: isPumpOn ? 'ON' : 'OFF',
                message: isPumpOn ? '💧 Water level low, Pump is ON' : '✅ Water level normal, Pump is Off',
                active: isPumpOn,
                lastUpdate: new Date()
            });
        });

        return () => {
            socketConnection.disconnect();
        };
    }, [user, selectedLocation]);

    return (
        <div className={`p-4 rounded-lg border transition-all ${pumpStatus.active
            ? 'bg-orange-50 border-orange-300 shadow-md'
            : 'bg-green-50 border-green-300 shadow-sm'
            }`}>
            {/* Title with Bowl Name */}
            <div className="flex items-center justify-between mb-3">
                <div>
                    <h3 className="text-sm font-bold text-gray-800">
                        💧Water Level Control
                    </h3>
                    <p className="text-xs text-gray-500 mt-0.5">
                        Bowl: Fermentation Tank 01
                    </p>
                </div>
                <div className={`px-3 py-1 rounded-full text-xs font-semibold ${pumpStatus.active
                    ? 'bg-orange-200 text-orange-700'
                    : 'bg-green-200 text-green-700'
                    }`}>
                    {pumpStatus.status || 'OFFLINE'}
                </div>
            </div>

            {/* Message */}
            <p className={`text-sm font-medium mb-3 ${pumpStatus.active ? 'text-orange-700' : 'text-green-700'
                }`}>
                {pumpStatus.message}
            </p>

            {/* Footer */}
            <div className="flex items-center justify-between text-xs text-gray-600 pt-2 border-t border-gray-200">
                <span>
                    {pumpStatus.lastUpdate
                        ? pumpStatus.lastUpdate.toLocaleTimeString()
                        : 'Awaiting data...'
                    }
                </span>
                {!connected && <span className="text-red-600 font-medium">⚠️ Offline</span>}
            </div>
        </div>
    );
};

export default SonarPumpStatus;
