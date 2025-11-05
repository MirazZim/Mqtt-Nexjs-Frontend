"use client";
import React, { useState, useEffect, useContext } from 'react';
import { FaMapMarkerAlt, FaPlus, FaTimes, FaCog, FaTrash, FaSave, FaCopy, FaCheckCircle, FaExclamationTriangle, FaPlug, FaCheck, FaExclamation } from 'react-icons/fa';
import { createSocket } from '../../lib/socket';
import AuthContext from '../../context/AuthContext';
import API_BASE_URL from '../../config/api.js';
import toast from 'react-hot-toast';  // ✅ Import toast


// ✅ NEW: Delete Confirmation Modal
const DeleteConfirmModal = ({ room, onConfirm, onCancel }) => {
    const [confirmText, setConfirmText] = useState('');
    const [isDeleting, setIsDeleting] = useState(false);

    const handleConfirm = async () => {
        if (confirmText !== room.location) {
            toast.error('Room name does not match!');
            return;
        }

        setIsDeleting(true);
        await onConfirm();
        setIsDeleting(false);
    };

    return (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onCancel}>
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full" onClick={(e) => e.stopPropagation()}>

                {/* Header */}
                <div className="bg-red-600 text-white p-6 rounded-t-lg">
                    <div className="flex items-center gap-3">
                        <div className="bg-red-700 p-3 rounded-full">
                            <FaExclamation className="text-2xl" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold">Delete Room</h2>
                            <p className="text-red-100 text-sm">This action cannot be undone</p>
                        </div>
                    </div>
                </div>

                {/* Body */}
                <div className="p-6">
                    <div className="mb-4">
                        <p className="text-gray-700 mb-2">
                            You are about to delete <span className="font-bold text-red-600">"{room.location}"</span>
                        </p>
                        <div className="bg-red-50 border-l-4 border-red-500 p-3 mt-3">
                            <p className="text-sm text-red-800 font-semibold mb-2">This will permanently:</p>
                            <ul className="text-sm text-red-700 space-y-1">
                                <li>• Deactivate all sensors and actuators</li>
                                <li>• Unsubscribe from all MQTT topics</li>
                                <li>• Remove all room configurations</li>
                                <li>• Delete all measurement history</li>
                            </ul>
                        </div>
                    </div>

                    <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Type <span className="font-mono bg-gray-100 px-2 py-1 rounded text-red-600">{room.location}</span> to confirm:
                        </label>
                        <input
                            type="text"
                            value={confirmText}
                            onChange={(e) => setConfirmText(e.target.value)}
                            className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:border-red-500 focus:ring-2 focus:ring-red-200 outline-none"
                            placeholder="Enter room name"
                            autoFocus
                        />
                    </div>
                </div>

                {/* Footer */}
                <div className="bg-gray-50 p-6 rounded-b-lg flex gap-3">
                    <button
                        onClick={handleConfirm}
                        disabled={confirmText !== room.location || isDeleting}
                        className="flex-1 bg-red-600 hover:bg-red-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white px-6 py-3 rounded-lg font-semibold transition-colors flex items-center justify-center gap-2"
                    >
                        {isDeleting ? (
                            <>
                                <span className="animate-spin">⏳</span>
                                Deleting...
                            </>
                        ) : (
                            <>
                                <FaTrash />
                                Delete Permanently
                            </>
                        )}
                    </button>
                    <button
                        onClick={onCancel}
                        disabled={isDeleting}
                        className="px-6 py-3 bg-gray-200 hover:bg-gray-300 disabled:opacity-50 text-gray-700 rounded-lg font-semibold transition-colors"
                    >
                        Cancel
                    </button>
                </div>
            </div>
        </div>
    );
};


const MQTTTopicConfigurator = ({ room, sensorTypes, actuatorTypes, userId, onSave, onClose, isNew }) => {
    const [sensorTopics, setSensorTopics] = useState({});
    const [actuatorTopics, setActuatorTopics] = useState({});
    const [copiedTopic, setCopiedTopic] = useState(null);
    const [testingTopics, setTestingTopics] = useState({});
    const [topicStatus, setTopicStatus] = useState({});
    const [validationErrors, setValidationErrors] = useState({});


    useEffect(() => {
        const defaultSensorTopics = {};
        const defaultActuatorTopics = {};

        sensorTypes.forEach(sensor => {
            defaultSensorTopics[sensor.code] = sensor.code;
        });

        actuatorTypes.forEach(actuator => {
            defaultActuatorTopics[actuator.code] = actuator.code;
        });

        setSensorTopics(defaultSensorTopics);
        setActuatorTopics(defaultActuatorTopics);
    }, [room, sensorTypes, actuatorTypes, userId]);


    const validateTopic = (topic) => {
        const errors = [];

        if (!topic || topic.trim() === '') {
            errors.push('Topic cannot be empty');
        } else {
            if (topic.includes('#') && topic.indexOf('#') !== topic.length - 1) {
                errors.push('Wildcard # must be at the end');
            }
            if (topic.includes(' ')) {
                errors.push('Topic cannot contain spaces');
            }
            if (topic.length > 100) {
                errors.push('Topic too long (max 100 characters)');
            }
        }

        return errors;
    };


    const handleTopicChange = (type, code, value) => {
        const setter = type === 'sensor' ? setSensorTopics : setActuatorTopics;

        setter(prev => ({
            ...prev,
            [code]: value
        }));

        const errors = validateTopic(value);
        setValidationErrors(prev => ({
            ...prev,
            [`${type}_${code}`]: errors
        }));
    };


    const handleCopyTopic = (topic) => {
        navigator.clipboard.writeText(topic);
        setCopiedTopic(topic);
        // ✅ Toast notification with custom styling
        toast.success('Topic copied to clipboard!', {
            duration: 2000,
            icon: '📋',
            style: {
                borderRadius: '10px',
                background: '#10b981',
                color: '#fff',
            },
        });
        setTimeout(() => setCopiedTopic(null), 2000);
    };


    const testMQTTConnection = async (topic, type, code) => {
        setTestingTopics(prev => ({ ...prev, [`${type}_${code}`]: true }));

        try {
            await new Promise(resolve => setTimeout(resolve, 1500));
            const isValid = !topic.includes(' ') && topic.length > 0;

            setTopicStatus(prev => ({
                ...prev,
                [`${type}_${code}`]: isValid ? 'success' : 'error'
            }));

            // ✅ Toast notification for test result
            if (isValid) {
                toast.success(`Topic "${topic}" is valid!`, {
                    icon: '✅',
                    style: {
                        borderRadius: '10px',
                        background: '#10b981',
                        color: '#fff',
                    },
                });
            } else {
                toast.error(`Topic "${topic}" validation failed!`, {
                    icon: '❌',
                    style: {
                        borderRadius: '10px',
                        background: '#ef4444',
                        color: '#fff',
                    },
                });
            }
        } catch (error) {
            setTopicStatus(prev => ({
                ...prev,
                [`${type}_${code}`]: 'error'
            }));
            toast.error('Connection test failed!', {
                icon: '❌',
            });
        } finally {
            setTestingTopics(prev => ({ ...prev, [`${type}_${code}`]: false }));
        }
    };


    const handleSave = () => {
        let hasErrors = false;
        const allValidations = {};

        Object.entries(sensorTopics).forEach(([code, topic]) => {
            const errors = validateTopic(topic);
            if (errors.length > 0) {
                hasErrors = true;
                allValidations[`sensor_${code}`] = errors;
            }
        });

        Object.entries(actuatorTopics).forEach(([code, topic]) => {
            const errors = validateTopic(topic);
            if (errors.length > 0) {
                hasErrors = true;
                allValidations[`actuator_${code}`] = errors;
            }
        });

        if (hasErrors) {
            setValidationErrors(allValidations);
            // ✅ Error toast
            toast.error('Please fix validation errors before saving!', {
                icon: '⚠️',
                duration: 3000,
            });
            return;
        }

        onSave(sensorTopics, actuatorTopics);
    };


    const getTopicStatusIcon = (type, code) => {
        const key = `${type}_${code}`;
        const status = topicStatus[key];
        const testing = testingTopics[key];

        if (testing) {
            return <span className="animate-spin">⏳</span>;
        }
        if (status === 'success') {
            return <FaCheckCircle className="text-green-600" />;
        }
        if (status === 'error') {
            return <FaExclamationTriangle className="text-red-600" />;
        }
        return null;
    };


    return (
        // ✅ Blurred backdrop
        <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
            <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>

                <div className="sticky top-0 bg-gradient-to-r from-teal-600 to-teal-700 text-white p-6 z-10 rounded-t-lg">
                    <h2 className="text-2xl font-bold mb-2">Configure MQTT Topics</h2>
                    <p className="text-teal-100 text-sm">Enter MQTT topics for {room.location}</p>
                    <div className="mt-3 bg-teal-800 bg-opacity-50 rounded px-3 py-2">
                        <p className="text-xs text-teal-100">Room ID: <code className="font-mono bg-teal-900 px-2 py-1 rounded">{room.room_id}</code></p>
                    </div>
                </div>

                <div className="p-6 space-y-6">

                    <div className="bg-blue-50 border-l-4 border-blue-500 p-4">
                        <div className="flex items-start gap-3">
                            <div className="text-blue-600 text-xl">💡</div>
                            <div>
                                <h4 className="font-semibold text-blue-800 mb-1">Quick Setup Guide</h4>
                                <ul className="text-sm text-blue-700 space-y-1">
                                    <li>• Enter the MQTT topic that your sensor publishes to</li>
                                    <li>• Topics are case-sensitive and unique identifiers</li>
                                    <li>• Use simple names like: <code className="bg-blue-100 px-1 rounded">ESP</code>, <code className="bg-blue-100 px-1 rounded">ESP2</code>, <code className="bg-blue-100 px-1 rounded">bowl</code></li>
                                    <li>• System will automatically subscribe and start receiving data</li>
                                </ul>
                            </div>
                        </div>
                    </div>

                    <div>
                        <div className="flex items-center gap-2 mb-4">
                            <h3 className="text-lg font-semibold text-gray-800">📊 Sensor Topics</h3>
                            <span className="text-sm text-gray-500">({sensorTypes.length} sensors)</span>
                        </div>

                        <div className="space-y-3">
                            {sensorTypes.map((sensor) => {
                                const hasError = validationErrors[`sensor_${sensor.code}`]?.length > 0;
                                const currentTopic = sensorTopics[sensor.code] || '';

                                return (
                                    <div key={sensor.code} className={`bg-gray-50 border-2 rounded-lg p-4 transition-all ${hasError ? 'border-red-300 bg-red-50' : 'border-gray-200 hover:border-teal-300'
                                        }`}>
                                        <div className="flex items-center justify-between mb-3">
                                            <div>
                                                <div className="font-medium text-gray-800 flex items-center gap-2">
                                                    {sensor.name}
                                                    {getTopicStatusIcon('sensor', sensor.code)}
                                                </div>
                                                <div className="text-xs text-gray-500">Unit: {sensor.unit} • Type: {sensor.code}</div>
                                            </div>
                                            {copiedTopic === currentTopic && (
                                                <span className="text-xs text-green-600 font-medium flex items-center gap-1">
                                                    <FaCheck /> Copied!
                                                </span>
                                            )}
                                        </div>

                                        <div className="flex gap-2">
                                            <div className="flex-1">
                                                <label className="block text-xs text-gray-600 mb-1 font-medium">
                                                    MQTT Topic <span className="text-red-500">*</span>
                                                </label>
                                                <input
                                                    type="text"
                                                    value={currentTopic}
                                                    onChange={(e) => handleTopicChange('sensor', sensor.code, e.target.value)}
                                                    className={`w-full px-3 py-2 border-2 rounded-lg outline-none text-sm font-mono transition-all ${hasError
                                                        ? 'border-red-400 focus:border-red-500 focus:ring-2 focus:ring-red-200'
                                                        : 'border-gray-300 focus:border-teal-500 focus:ring-2 focus:ring-teal-200'
                                                        }`}
                                                    placeholder={`e.g., ${sensor.code}`}
                                                />
                                                {hasError && (
                                                    <div className="mt-1 text-xs text-red-600">
                                                        {validationErrors[`sensor_${sensor.code}`].map((err, idx) => (
                                                            <div key={idx}>• {err}</div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                            <div className="flex flex-col gap-1 mt-6">
                                                <button
                                                    onClick={() => handleCopyTopic(currentTopic)}
                                                    className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
                                                    title="Copy topic"
                                                >
                                                    <FaCopy className="text-gray-600" />
                                                </button>
                                                <button
                                                    onClick={() => testMQTTConnection(currentTopic, 'sensor', sensor.code)}
                                                    disabled={testingTopics[`sensor_${sensor.code}`] || hasError}
                                                    className="p-2 hover:bg-teal-100 rounded-lg transition-colors disabled:opacity-50"
                                                    title="Test connection"
                                                >
                                                    <FaPlug className="text-teal-600" />
                                                </button>
                                            </div>
                                        </div>

                                        <div className="mt-2 text-xs text-gray-500">
                                            Example: <code className="bg-gray-200 px-2 py-0.5 rounded">{sensor.code}</code> or <code className="bg-gray-200 px-2 py-0.5 rounded">ESP2</code>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    <div>
                        <div className="flex items-center gap-2 mb-4">
                            <h3 className="text-lg font-semibold text-gray-800">🎛️ Actuator Topics</h3>
                            <span className="text-sm text-gray-500">({actuatorTypes.length} actuators)</span>
                        </div>

                        <div className="space-y-3">
                            {actuatorTypes.map((actuator) => {
                                const hasError = validationErrors[`actuator_${actuator.code}`]?.length > 0;
                                const currentTopic = actuatorTopics[actuator.code] || '';

                                return (
                                    <div key={actuator.code} className={`bg-gray-50 border-2 rounded-lg p-4 transition-all ${hasError ? 'border-red-300 bg-red-50' : 'border-gray-200 hover:border-teal-300'
                                        }`}>
                                        <div className="flex items-center justify-between mb-3">
                                            <div className="flex items-center gap-2">
                                                <span className="text-xl">{actuator.icon}</span>
                                                <div>
                                                    <div className="font-medium text-gray-800 flex items-center gap-2">
                                                        {actuator.name}
                                                        {getTopicStatusIcon('actuator', actuator.code)}
                                                    </div>
                                                    <div className="text-xs text-gray-500">Control device • Type: {actuator.code}</div>
                                                </div>
                                            </div>
                                            {copiedTopic === currentTopic && (
                                                <span className="text-xs text-green-600 font-medium flex items-center gap-1">
                                                    <FaCheck /> Copied!
                                                </span>
                                            )}
                                        </div>

                                        <div className="flex gap-2">
                                            <div className="flex-1">
                                                <label className="block text-xs text-gray-600 mb-1 font-medium">
                                                    MQTT Topic <span className="text-red-500">*</span>
                                                </label>
                                                <input
                                                    type="text"
                                                    value={currentTopic}
                                                    onChange={(e) => handleTopicChange('actuator', actuator.code, e.target.value)}
                                                    className={`w-full px-3 py-2 border-2 rounded-lg outline-none text-sm font-mono transition-all ${hasError
                                                        ? 'border-red-400 focus:border-red-500 focus:ring-2 focus:ring-red-200'
                                                        : 'border-gray-300 focus:border-teal-500 focus:ring-2 focus:ring-teal-200'
                                                        }`}
                                                    placeholder={`e.g., ${actuator.code}`}
                                                />
                                                {hasError && (
                                                    <div className="mt-1 text-xs text-red-600">
                                                        {validationErrors[`actuator_${actuator.code}`].map((err, idx) => (
                                                            <div key={idx}>• {err}</div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                            <div className="flex flex-col gap-1 mt-6">
                                                <button
                                                    onClick={() => handleCopyTopic(currentTopic)}
                                                    className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
                                                    title="Copy topic"
                                                >
                                                    <FaCopy className="text-gray-600" />
                                                </button>
                                                <button
                                                    onClick={() => testMQTTConnection(currentTopic, 'actuator', actuator.code)}
                                                    disabled={testingTopics[`actuator_${actuator.code}`] || hasError}
                                                    className="p-2 hover:bg-teal-100 rounded-lg transition-colors disabled:opacity-50"
                                                    title="Test connection"
                                                >
                                                    <FaPlug className="text-teal-600" />
                                                </button>
                                            </div>
                                        </div>

                                        <div className="mt-2 text-xs text-gray-500">
                                            Example: <code className="bg-gray-200 px-2 py-0.5 rounded">{actuator.code}</code> or <code className="bg-gray-200 px-2 py-0.5 rounded">control/{actuator.code}</code>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    <div className="bg-yellow-50 border-l-4 border-yellow-500 p-4">
                        <h4 className="font-semibold text-yellow-800 mb-2">⚠️ Important Notes</h4>
                        <ul className="text-sm text-yellow-700 space-y-1">
                            <li>• Topics must match exactly what your sensors publish to</li>
                            <li>• System will automatically subscribe to these topics</li>
                            <li>• Data will start flowing immediately after saving</li>
                            <li>• You can change topics later by editing the room configuration</li>
                        </ul>
                    </div>
                </div>

                <div className="sticky bottom-0 bg-gray-50 border-t-2 border-gray-200 p-6 flex gap-3 rounded-b-lg">
                    <button
                        onClick={handleSave}
                        className="flex-1 bg-gradient-to-r from-teal-600 to-teal-700 hover:from-teal-700 hover:to-teal-800 text-white px-6 py-3 rounded-lg font-semibold transition-all flex items-center justify-center gap-2 shadow-lg"
                    >
                        <FaSave />
                        {isNew ? 'Create Room & Subscribe' : 'Save & Update Subscriptions'}
                    </button>
                    <button
                        onClick={onClose}
                        className="px-6 py-3 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg font-semibold transition-colors"
                    >
                        Cancel
                    </button>
                </div>
            </div>
        </div>
    );
};

const DynamicLocationSelector = ({ selectedLocation, onLocationChange }) => {
    const { user } = useContext(AuthContext);
    const [locations, setLocations] = useState([]);
    const [newLocationName, setNewLocationName] = useState('');
    const [isAdding, setIsAdding] = useState(false);
    const [loading, setLoading] = useState(true);
    const [socket, setSocket] = useState(null);
    const [showConfig, setShowConfig] = useState(false);
    const [selectedRoom, setSelectedRoom] = useState(null);
    const [showDeleteModal, setShowDeleteModal] = useState(false); // ✅ NEW
    const [roomToDelete, setRoomToDelete] = useState(null); // ✅ NEW

    const [sensorTypes] = useState([
        { code: 'temperature', name: 'Temperature', unit: '°C', category: 'environmental' },
        { code: 'humidity', name: 'Humidity', unit: '%', category: 'environmental' },
        { code: 'bowl_temp', name: 'Bowl Temperature', unit: '°C', category: 'process' },
        { code: 'sonar_distance', name: 'Sonar Distance', unit: 'cm', category: 'physical' },
        { code: 'co2_level', name: 'CO2 Level', unit: 'ppm', category: 'chemical' },
        { code: 'sugar_level', name: 'Sugar Level', unit: '°Brix', category: 'chemical' },
        { code: 'airflow', name: 'Airflow', unit: 'm/s', category: 'environmental' },
        { code: 'bowl_fan_status', name: 'Bowl Fan Status', unit: 'status', category: 'status' },
        { code: 'sonar_pump_status', name: 'Pump Status', unit: 'status', category: 'status' },
        { code: 'co2_fermentation_status', name: 'CO2 Fermentation Status', unit: 'status', category: 'status' },
        { code: 'sugar_fermentation_status', name: 'Sugar Fermentation Status', unit: 'status', category: 'status' }
    ]);

    const [actuatorTypes] = useState([
        { code: 'heater', name: 'Heater', icon: '🔥', category: 'temperature' },
        { code: 'cooler', name: 'Cooler', icon: '❄️', category: 'temperature' },
        { code: 'humidifier', name: 'Humidifier', icon: '💧', category: 'humidity' },
        { code: 'dehumidifier', name: 'Dehumidifier', icon: '💨', category: 'humidity' },
        { code: 'fan', name: 'Fan', icon: '🌀', category: 'airflow' },
        { code: 'bowl_fan', name: 'Bowl Fan', icon: '🫧', category: 'process' },
        { code: 'water_pump', name: 'Water Pump', icon: '⚡', category: 'process' }
    ]);


    useEffect(() => {
        if (!user) return;
        fetchUserLocations();
        setupRealtimeUpdates();
        return () => {
            if (socket) socket.disconnect();
        };
    }, [user]);


    const setupRealtimeUpdates = () => {
        const socketConnection = createSocket(user.token);
        setSocket(socketConnection);

        socketConnection.on('locationListUpdate', (data) => {
            if (data.userId === user.id) {
                setLocations(data.locations);
            }
        });

        socketConnection.on('newLocationAdded', (data) => {
            if (data.userId === user.id) {
                setLocations(prev => {
                    const exists = prev.some(loc => loc.location === data.location);
                    if (!exists) {
                        return [...prev, {
                            location: data.location,
                            room_id: data.roomId,
                            measurement_count: 0,
                            last_measurement: new Date()
                        }];
                    }
                    return prev;
                });
            }
        });
    };


    const fetchUserLocations = async () => {
        if (!user) return;
        try {
            const response = await fetch(`${API_BASE_URL}/api/locations`, {
                headers: { 'Authorization': `Bearer ${user.token}` }
            });

            if (response.ok) {
                const data = await response.json();
                setLocations(data.locations || []);

                if (!selectedLocation && data.locations.length > 0) {
                    onLocationChange(data.locations[0].location);
                }
            }
        } catch (error) {
            console.error('Error fetching locations:', error);
            toast.error('Failed to fetch locations');
        } finally {
            setLoading(false);
        }
    };


    const generateRoomId = () => {
        return `ROOM_${Date.now()}_${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
    };


    const handleCreateRoomClick = () => {
        if (!newLocationName.trim()) return;
        const locationName = newLocationName.trim();
        const roomId = generateRoomId();

        setSelectedRoom({
            location: locationName,
            room_id: roomId,
            isNew: true
        });
        setShowConfig(true);
        setIsAdding(false);
    };


    const handleSaveRoomWithSensors = async (sensorTopics, actuatorTopics) => {
        if (!selectedRoom) return;

        const isNewRoom = selectedRoom.isNew;
        const endpoint = isNewRoom
            ? `${API_BASE_URL}/api/locations/create-room`
            : `${API_BASE_URL}/api/locations/${selectedRoom.room_id}/update`;

        const method = isNewRoom ? 'POST' : 'PUT';

        const requestBody = isNewRoom
            ? {
                roomName: selectedRoom.location,
                roomId: selectedRoom.room_id,
                sensorTopics: sensorTopics,
                actuatorTopics: actuatorTopics
            }
            : {
                roomName: selectedRoom.location,
                sensorTopics: sensorTopics,
                actuatorTopics: actuatorTopics
            };

        const createOrUpdatePromise = fetch(endpoint, {
            method: method,
            headers: {
                'Authorization': `Bearer ${user.token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestBody)
        }).then(async (response) => {
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || `Failed to ${isNewRoom ? 'create' : 'update'} room`);
            }
            return response.json();
        });

        toast.promise(
            createOrUpdatePromise,
            {
                loading: isNewRoom
                    ? 'Creating room and configuring MQTT topics...'
                    : 'Updating room and MQTT topics...',
                success: (result) => {
                    console.log(`✅ Room ${isNewRoom ? 'created' : 'updated'} successfully:`, result);

                    if (socket) {
                        socket.emit('locationAdded', {
                            userId: user.id,
                            location: selectedRoom.location,
                            roomId: result.roomId || selectedRoom.room_id
                        });
                    }

                    onLocationChange(selectedRoom.location);
                    setNewLocationName('');
                    setShowConfig(false);
                    setSelectedRoom(null);
                    fetchUserLocations();

                    return isNewRoom
                        ? `Room "${selectedRoom.location}" created with ${Object.keys(sensorTopics).length} sensors & ${Object.keys(actuatorTopics).length} actuators!`
                        : `Room "${selectedRoom.location}" updated successfully!`;
                },
                error: (err) => `Error: ${err.message}`,
            },
            {
                success: {
                    duration: 5000,
                    icon: isNewRoom ? '🎉' : '✅',
                    style: {
                        borderRadius: '10px',
                        background: '#10b981',
                        color: '#fff',
                    },
                },
                error: {
                    duration: 5000,
                    icon: '❌',
                    style: {
                        borderRadius: '10px',
                        background: '#ef4444',
                        color: '#fff',
                    },
                },
                loading: {
                    icon: '⏳',
                },
            }
        );
    };


    const handleConfigureRoom = async (room) => {
        try {
            const response = await fetch(
                `${API_BASE_URL}/api/locations/${room.room_id}/devices`,
                {
                    headers: { 'Authorization': `Bearer ${user.token}` }
                }
            );

            if (response.ok) {
                const data = await response.json();

                const existingSensorTopics = {};
                const existingActuatorTopics = {};

                data.sensors.forEach(sensor => {
                    existingSensorTopics[sensor.type_code] = sensor.mqtt_topic;
                });

                data.actuators.forEach(actuator => {
                    existingActuatorTopics[actuator.type_code] = actuator.mqtt_topic;
                });

                setSelectedRoom({
                    ...room,
                    isNew: false,
                    existingSensorTopics,
                    existingActuatorTopics
                });
                setShowConfig(true);
            }
        } catch (error) {
            console.error('Error fetching room devices:', error);
            toast.error('Failed to load room configuration');
        }
    };


    // ✅ FIXED: Delete handler with modal
    const handleDeleteRoom = (roomId, locationName) => {
        console.log('🔵 Opening delete modal for:', roomId, locationName);
        setRoomToDelete({ room_id: roomId, location: locationName });
        setShowDeleteModal(true);
    };

    // ✅ FIXED: Actual delete execution
    const executeDeleteRoom = async () => {
        if (!roomToDelete) return;

        const { room_id, location } = roomToDelete;

        console.log('🔵 Executing delete for room ID:', room_id);

        const deletePromise = fetch(
            `${API_BASE_URL}/api/locations/${room_id}`,
            {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${user.token}`,
                    'Content-Type': 'application/json'
                }
            }
        ).then(async (response) => {
            console.log('Delete response status:', response.status);

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Failed to delete room');
            }
            return response.json();
        });

        toast.promise(
            deletePromise,
            {
                loading: `Deleting room "${location}"...`,
                success: (result) => {
                    console.log('✅ Delete successful:', result);

                    // ✅ FIX: Properly compare room_id (convert both to numbers)
                    setLocations(prev => prev.filter(loc => {
                        const locRoomId = typeof loc.room_id === 'string' ? parseInt(loc.room_id, 10) : loc.room_id;
                        const deleteRoomId = typeof room_id === 'string' ? parseInt(room_id, 10) : room_id;
                        return locRoomId !== deleteRoomId;
                    }));

                    // Change selected location if needed
                    if (selectedLocation === location) {
                        const remainingLocations = locations.filter(loc => {
                            const locRoomId = typeof loc.room_id === 'string' ? parseInt(loc.room_id, 10) : loc.room_id;
                            const deleteRoomId = typeof room_id === 'string' ? parseInt(room_id, 10) : room_id;
                            return locRoomId !== deleteRoomId;
                        });
                        onLocationChange(remainingLocations[0]?.location || null);
                    }

                    // Close modal
                    setShowDeleteModal(false);
                    setRoomToDelete(null);

                    return `Room "${location}" deleted successfully`;
                },
                error: (err) => {
                    console.error('❌ Delete error:', err);
                    setShowDeleteModal(false);
                    setRoomToDelete(null);
                    return `Failed to delete room: ${err.message}`;
                },
            },
            {
                success: {
                    duration: 3000,
                    icon: '🗑️',
                    style: {
                        borderRadius: '10px',
                        background: '#10b981',
                        color: '#fff',
                    },
                },
                error: {
                    duration: 5000,
                    icon: '❌',
                    style: {
                        borderRadius: '10px',
                        background: '#ef4444',
                        color: '#fff',
                    },
                },
                loading: {
                    icon: '⏳',
                },
            }
        );
    };


    if (loading) {
        return (
            <div className="bg-white rounded-lg shadow-lg p-4">
                <p className="text-gray-600">Loading locations...</p>
            </div>
        );
    }


    return (
        <div className="relative group">
            <div className="bg-gradient-to-r from-teal-600 to-teal-700 hover:from-teal-700 hover:to-teal-800 text-white px-5 py-3 rounded-lg cursor-pointer transition-all duration-200 flex items-center gap-3 min-w-[280px] shadow-lg">
                <FaMapMarkerAlt className="text-teal-200 text-xl" />
                <div className="flex-1">
                    <div className="text-sm font-semibold">
                        {locations.find(loc => loc.location === selectedLocation)?.location || 'Select Location'}
                    </div>
                    <div className="text-xs text-teal-200">
                        {locations.find(loc => loc.location === selectedLocation)?.room_id || 'No room selected'}
                    </div>
                </div>
                <svg className="w-5 h-5 text-teal-200 transition-transform group-hover:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
            </div>

            <div className="absolute top-full left-0 mt-2 w-full min-w-[350px] bg-white rounded-lg shadow-2xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 max-h-[500px] overflow-y-auto">

                <div className="py-2">
                    {locations.map((loc, index) => (
                        <div
                            key={`${loc.location}-${index}`}
                            className={`group/item px-4 py-3 hover:bg-teal-50 transition-colors border-l-4 ${selectedLocation === loc.location
                                ? 'border-teal-600 bg-teal-50'
                                : 'border-transparent'
                                }`}
                        >
                            <div className="flex items-start gap-3">
                                <FaMapMarkerAlt className={`mt-1 ${selectedLocation === loc.location ? 'text-teal-600' : 'text-gray-400'
                                    }`} />

                                <div className="flex-1 cursor-pointer" onClick={() => onLocationChange(loc.location)}>
                                    <div className="flex items-center justify-between">
                                        <span className={`font-medium ${selectedLocation === loc.location ? 'text-teal-700' : 'text-gray-800'
                                            }`}>
                                            {loc.location}
                                        </span>
                                        <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full">
                                            {loc.measurement_count || 0}
                                        </span>
                                    </div>
                                    <div className="text-xs text-gray-500 mt-1">
                                        Room ID: {loc.room_id}
                                    </div>
                                </div>

                                <div className="flex gap-1 opacity-0 group-hover/item:opacity-100 transition-opacity">
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleConfigureRoom(loc);
                                        }}
                                        className="p-2 hover:bg-teal-100 rounded-lg transition-colors"
                                        title="Configure MQTT Topics"
                                    >
                                        <FaCog className="text-teal-600 text-sm" />
                                    </button>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleDeleteRoom(loc.room_id, loc.location);
                                        }}
                                        className="p-2 hover:bg-red-100 rounded-lg transition-colors"
                                        title="Delete Room"
                                    >
                                        <FaTrash className="text-red-600 text-sm" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                <div className="border-t border-gray-200"></div>

                {isAdding ? (
                    <div className="p-4 bg-gray-50">
                        <input
                            type="text"
                            value={newLocationName}
                            onChange={(e) => setNewLocationName(e.target.value)}
                            placeholder="Enter room name (e.g., Fermentation Tank 1)"
                            maxLength={50}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none text-sm"
                            onKeyPress={(e) => e.key === 'Enter' && handleCreateRoomClick()}
                            autoFocus
                        />
                        <div className="flex gap-2 mt-3">
                            <button
                                className="flex-1 bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                                onClick={handleCreateRoomClick}
                            >
                                Next: Configure MQTT →
                            </button>
                            <button
                                className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg text-sm font-medium transition-colors"
                                onClick={() => {
                                    setIsAdding(false);
                                    setNewLocationName('');
                                }}
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                ) : (
                    <button
                        className="w-full px-4 py-3 text-left hover:bg-gray-50 transition-colors flex items-center gap-3 text-teal-600 font-medium"
                        onClick={() => setIsAdding(true)}
                    >
                        <FaPlus className="text-sm" />
                        <span>Add New Room</span>
                    </button>
                )}
            </div>

            {/* MQTT Configuration Modal */}
            {showConfig && selectedRoom && (
                <MQTTTopicConfigurator
                    room={selectedRoom}
                    sensorTypes={sensorTypes}
                    actuatorTypes={actuatorTypes}
                    userId={user?.id}
                    onClose={() => {
                        setShowConfig(false);
                        setSelectedRoom(null);
                    }}
                    onSave={handleSaveRoomWithSensors}
                    isNew={selectedRoom.isNew}
                />
            )}

            {/* ✅ NEW: Delete Confirmation Modal */}
            {showDeleteModal && roomToDelete && (
                <DeleteConfirmModal
                    room={roomToDelete}
                    onConfirm={executeDeleteRoom}
                    onCancel={() => {
                        setShowDeleteModal(false);
                        setRoomToDelete(null);
                    }}
                />
            )}
        </div>
    );
};


export default DynamicLocationSelector;
