"use client";
import React, { useState, useEffect, useContext, useRef } from 'react';
import { FaWifi, FaSignal, FaFire, FaSnowflake, FaTint, FaWind } from 'react-icons/fa';
import { createSocket } from '../../lib/socket';
import AuthContext from '../../context/AuthContext';


const DeviceStatus = ({ selectedLocation }) => {
    const { user } = useContext(AuthContext);
    const [isInitialLoad, setIsInitialLoad] = useState(true);

    // Separate broker and sensor status
    const [brokerStatus, setBrokerStatus] = useState({
        connected: false,
        lastSeen: null,
        status: 'Connecting...',
        lastHeartbeat: null
    });


    const [sensorStatus, setSensorStatus] = useState({
        active: false,
        lastDataReceived: null,
        status: 'No Data'
    });

    const [connectionStatus, setConnectionStatus] = useState('Connecting...');

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

        // 1 SECOND TIMEOUT for instant detection
        sensorTimeoutRef.current = setTimeout(() => {
            //console.log('⚡ DeviceStatus sensor timeout - no data for 1 second');
            setSensorStatus(prev => ({ ...prev, active: false, status: 'No Recent Data' }));
            if (brokerStatus.connected) {
                setConnectionStatus('🟡 Broker Connected - Sensor Timeout');
            }
        }, 5000); // 1 second timeout
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
                    status: 'Connected'
                }));

                // Optional: Send a ping to verify broker responsiveness
                socket.emit('ping');

                //console.log('💓 Broker health check - Connected');
            } else {
                // Broker is disconnected
                setBrokerStatus(prev => ({
                    ...prev,
                    connected: false,
                    status: 'Disconnected',
                    lastHeartbeat: null
                }));

                setSensorStatus({
                    active: false,
                    lastDataReceived: null,
                    status: 'No Data'
                });

                setConnectionStatus('Broker Disconnected');
                //console.log('💔 Broker health check - Disconnected');
            }
        }, 1000); // Check every 1 second

        // Broker connection events
        socket.on('connect', () => {
            // console.log('🔗 Broker connected');
            setBrokerStatus({
                connected: true,
                lastSeen: new Date(),
                status: 'Connected',
                lastHeartbeat: new Date() // Add heartbeat timestamp
            });
            setConnectionStatus('Broker Connected - Waiting for Sensor Data');
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
                status: 'Disconnected'
            });
            setSensorStatus({
                active: false,
                lastDataReceived: null,
                status: 'No Data'
            });
            setConnectionStatus('Disconnected');

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
                    status: 'Receiving Data'
                });
                setConnectionStatus('Broker Connected');

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
                    status: 'Receiving Data'
                }));

                if (brokerStatus.connected) {
                    setConnectionStatus('🟢 Broker & Sensors Connected');
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
                    status: 'Receiving Data'
                }));

                if (brokerStatus.connected) {
                    setConnectionStatus('🟢 Broker & Sensors Connected');
                }

                setSensorTimeout();
            }
        });

        socket.on('connect_error', (error) => {
            //  console.log('❌ DeviceStatus broker connection error:', error);
            setBrokerStatus({
                connected: false,
                lastSeen: null,
                status: 'Connection Error'
            });
            setConnectionStatus('❌ Connection Error');
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
    }, [user, selectedLocation]);

    // const getFanLevelText = (level) => {
    //   switch (level) {
    //     case 0: return 'OFF';
    //     case 1: return 'LOW';
    //     case 2: return 'MED';
    //     case 3: return 'HIGH';
    //     default: return 'OFF';
    //   }
    // };
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
        if (!timestamp) return 'Never';
        return timestamp.toLocaleString();
    };

    return (
        <div className="device-status">

            {/* Overall Connection Status */}
            {/* <div className="status-indicator">
        <div className={`status-light ${getOverallStatus()}`}></div>
        <span>{connectionStatus}</span>
      </div> */}

            <h2>📡 Device Status</h2>

            <div className="location-info">
                📍 Location: <strong>{selectedLocation}</strong>
            </div>
            {/* Detailed Status */}
            <div className="status-details">

                {/* Broker Status */}
                <div className="status-item">
                    <FaWifi className={`status-icon ${brokerStatus.connected ? 'online' : 'offline'}`} />
                    <div>
                        <div>{brokerStatus.status}</div>
                        {brokerStatus.lastSeen && (
                            <small>Connected: {formatTimestamp(brokerStatus.lastSeen)}</small>
                        )}
                        <br />
                        {brokerStatus.lastHeartbeat && (
                            <small>Last check: {formatTimestamp(brokerStatus.lastHeartbeat)}</small>
                        )}
                    </div>
                </div>

                {/* Sensor Status */}
                <div className="status-item">
                    <div className={`status-icon ${sensorStatus.active ? 'connected' :
                        brokerStatus.connected ? 'warning' : 'disconnected'}`}>
                        <FaSignal />
                    </div>
                    <div className="status-info">
                        <h4>Sensor Data Stream</h4>
                        <p>{sensorStatus.status}</p>
                        {sensorStatus.lastDataReceived && (
                            <small>Last data: {formatTimestamp(sensorStatus.lastDataReceived)}</small>
                        )}
                    </div>
                </div>

                {/* Control Status - only show if sensors are active */}
                {sensorStatus.active ? (
                    <div >

                        {/*  className="control-status" */}
                        {/* <h4>🎛️ Active Control Systems</h4>

            <div className="control-grid">
              <div className={`control-item ${controlState.heaterState ? 'active' : ''}`}>
                <FaFire className="control-item-icon" />
                <span>Heater</span>
                <small>{controlState.heaterState ? 'ON' : 'OFF'}</small>
              </div>

              <div className={`control-item ${controlState.coolerState ? 'active' : ''}`}>
                <FaSnowflake className="control-item-icon" />
                <span>Cooler</span>
                <small>{controlState.coolerState ? 'ON' : 'OFF'}</small>
              </div>

              <div className={`control-item ${controlState.humidifierState ? 'active' : ''}`}>
                <FaTint className="control-item-icon" />
                <span>Humidifier</span>
                <small>{controlState.humidifierState ? 'ON' : 'OFF'}</small>
              </div>

              <div className={`control-item ${controlState.dehumidifierState ? 'active' : ''}`}>
                <FaTint className="control-item-icon" style={{ transform: 'rotate(180deg)' }} />
                <span>Dehumidifier</span>
                <small>{controlState.dehumidifierState ? 'ON' : 'OFF'}</small>
              </div>

              <div className={`control-item ${controlState.fanLevel > 0 ? 'active' : ''}`}>
                <FaWind className="control-item-icon" />
                <span>Fan</span>
                <small>{getFanLevelText(controlState.fanLevel)}</small>
              </div>
            </div>

            <div className="control-mode">
              Control Mode: <span className={controlState.controlMode}>
                {controlState.controlMode?.toUpperCase() || 'AUTO'}
              </span>
            </div> */}
                    </div>
                ) : (
                    <div className="no-data-message">
                        {brokerStatus.connected ?
                            '⏳ Waiting for sensor data... (5s timeout)' :
                            '📵 Connect to broker to receive sensor data'
                        }
                    </div>
                )}
            </div>
        </div>
    );
};

export default DeviceStatus;




// For Control Status (we will do it later)


//<h3>Control Status</h3>
// <div className="control-indicators">
//   {/* Temperature Control */}
//   <div className={`control-indicator ${controlState.heaterState ? 'active' : 'inactive'}`}>
//     <FaFire />
//     <span>Heater: {controlState.heaterState ? 'ON' : 'OFF'}</span>
//   </div>
//   <div className={`control-indicator ${controlState.coolerState ? 'active' : 'inactive'}`}>
//     <FaSnowflake />
//     <span>Cooler: {controlState.coolerState ? 'ON' : 'OFF'}</span>
//   </div>

//   {/* Humidity Control */}
//   <div className={`control-indicator ${controlState.humidifierState ? 'active' : 'inactive'}`}>
//     <FaTint />
//     <span>Humidifier: {controlState.humidifierState ? 'ON' : 'OFF'}</span>
//   </div>
//   <div className={`control-indicator ${controlState.dehumidifierState ? 'active' : 'inactive'}`}>
//     <FaTint style={{ transform: 'scaleY(-1)' }} />
//     <span>Dehumidifier: {controlState.dehumidifierState ? 'ON' : 'OFF'}</span>
//   </div>

//   {/* Airflow Control */}
//   <div className={`control-indicator ${controlState.fanLevel > 0 ? 'active' : 'inactive'}`}>
//     <FaWind />
//     <span>Fan: {getFanLevelText(controlState.fanLevel)}</span>
//   </div>
// </div>