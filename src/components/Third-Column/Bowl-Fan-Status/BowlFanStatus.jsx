"use client";
import React, { useState, useEffect, useContext } from 'react';
import { createSocket } from '../../../lib/socket';
import AuthContext from '../../../context/AuthContext';

const BowlFanStatus = ({ selectedLocation }) => {
    const { user } = useContext(AuthContext);

    const [fanStatus, setFanStatus] = useState({
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
            console.log('🌀 Bowl Fan Status connected');
            setConnected(true);
            socketConnection.emit('joinLocation', selectedLocation);
        });

        socketConnection.on('disconnect', () => {
            console.log('🌀 Bowl Fan Status disconnected');
            setConnected(false);
        });

        socketConnection.on('bowlFanStatus', (data) => {
            if (data.location === selectedLocation) {
                console.log('🌀 Fan status update:', data.message);

                setFanStatus({
                    status: data.status,
                    message: data.message,
                    active: data.fanState,
                    lastUpdate: new Date()
                });
            }
        });

        return () => {
            socketConnection.disconnect();
        };
    }, [user, selectedLocation]);

    return (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            {/* Header */}
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-gradient-to-br from-amber-500 to-orange-500 rounded-lg flex items-center justify-center">
                        <span className="text-lg">🌀</span>
                    </div>
                    <div>
                        <h3 className="text-sm font-semibold text-gray-800">Bowl Fan</h3>
                        <p className="text-xs text-gray-500">Cooling System</p>
                    </div>
                </div>

                {/* Connection Status */}
                <div className={`w-2 h-2 rounded-full ${connected ? 'bg-green-500 animate-pulse' : 'bg-gray-300'}`}></div>
            </div>

            {/* Status Display */}
            <div className={`p-3 rounded-lg border-2 transition-all ${fanStatus.active
                ? 'bg-green-50 border-green-200'
                : 'bg-gray-50 border-gray-200'
                }`}>
                <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-gray-600">Status</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${fanStatus.active
                        ? 'bg-green-100 text-green-700'
                        : 'bg-gray-200 text-gray-600'
                        }`}>
                        {fanStatus.active ? 'RUNNING' : 'STANDBY'}
                    </span>
                </div>

                <div className="flex items-center gap-2 mb-2">
                    <span className="text-2xl">{fanStatus.active ? '🌀' : '💤'}</span>
                    <p className="text-sm font-medium text-gray-800 leading-tight">
                        {fanStatus.message}
                    </p>
                </div>

                {fanStatus.lastUpdate && (
                    <p className="text-xs text-gray-500 mt-2">
                        Updated: {fanStatus.lastUpdate.toLocaleTimeString()}
                    </p>
                )}
            </div>

            {/* Status Code Display */}
            {fanStatus.status && (
                <div className="mt-3 flex items-center justify-between text-xs">
                    <span className="text-gray-500">Signal Code:</span>
                    <code className="px-2 py-1 bg-gray-100 rounded font-mono text-gray-700">
                        {fanStatus.status}
                    </code>
                </div>
            )}
        </div>
    );
};

export default BowlFanStatus;
