"use client";
import React, { useState, useEffect, useContext } from 'react';
import { FaMapMarkerAlt, FaPlus, FaTimes, FaCog, FaTrash, FaSave, FaCopy, FaCheckCircle, FaExclamationTriangle, FaPlug, FaCheck, FaExclamation } from 'react-icons/fa';
import { createSocket } from '../../lib/socket';
import AuthContext from '../../context/AuthContext';
import API_BASE_URL from '../../config/api.js';
import toast from 'react-hot-toast';
import { usePathname, useRouter } from 'next/navigation';
import { useTranslation } from '../../app/i18n/client.js';


// ✅ Delete Confirmation Modal with i18n
const DeleteConfirmModal = ({ room, onConfirm, onCancel, t }) => {
    const [confirmText, setConfirmText] = useState('');
    const [isDeleting, setIsDeleting] = useState(false);

    const handleConfirm = async () => {
        if (confirmText !== room.location) {
            toast.error(t('Room name does not match!'));
            return;
        }

        setIsDeleting(true);
        await onConfirm();
        setIsDeleting(false);
    };

    return (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onCancel}>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full" onClick={(e) => e.stopPropagation()}>

                {/* Header */}
                <div className="bg-red-600 dark:bg-red-700 text-white p-6 rounded-t-lg">
                    <div className="flex items-center gap-3">
                        <div className="bg-red-700 dark:bg-red-800 p-3 rounded-full">
                            <FaExclamation className="text-2xl" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold">{t('Delete Room')}</h2>
                            <p className="text-red-100 text-sm">{t('This action cannot be undone')}</p>
                        </div>
                    </div>
                </div>

                {/* Body */}
                <div className="p-6">
                    <div className="mb-4">
                        <p className="text-gray-700 dark:text-gray-300 mb-2">
                            {t('You are about to delete')} <span className="font-bold text-red-600 dark:text-red-400">"{room.location}"</span>
                        </p>
                        <div className="bg-red-50 dark:bg-red-900/30 border-l-4 border-red-500 p-3 mt-3">
                            <p className="text-sm text-red-800 dark:text-red-300 font-semibold mb-2">{t('This will permanently:')}</p>
                            <ul className="text-sm text-red-700 dark:text-red-400 space-y-1">
                                <li>{t('Deactivate all sensors and actuators')}</li>
                                <li>{t('Unsubscribe from all MQTT topics')}</li>
                                <li>{t('Remove all room configurations')}</li>
                                <li>{t('Delete all measurement history')}</li>
                            </ul>
                        </div>
                    </div>

                    <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            {t('Type')} <span className="font-mono bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded text-red-600 dark:text-red-400">{room.location}</span> {t('to confirm:')}
                        </label>
                        <input
                            type="text"
                            value={confirmText}
                            onChange={(e) => setConfirmText(e.target.value)}
                            className="w-full px-3 py-2 border-2 border-gray-300 dark:border-gray-600 rounded-lg focus:border-red-500 focus:ring-2 focus:ring-red-200 dark:focus:ring-red-800 outline-none bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200"
                            placeholder={t('Enter room name')}
                            autoFocus
                        />
                    </div>
                </div>

                {/* Footer */}
                <div className="bg-gray-50 dark:bg-gray-700/50 p-6 rounded-b-lg flex gap-3">
                    <button
                        onClick={handleConfirm}
                        disabled={confirmText !== room.location || isDeleting}
                        className="flex-1 bg-red-600 hover:bg-red-700 disabled:bg-gray-300 dark:disabled:bg-gray-600 disabled:cursor-not-allowed text-white px-6 py-3 rounded-lg font-semibold transition-colors flex items-center justify-center gap-2"
                    >
                        {isDeleting ? (
                            <>
                                <span className="animate-spin">⏳</span>
                                {t('Deleting...')}
                            </>
                        ) : (
                            <>
                                <FaTrash />
                                {t('Delete Permanently')}
                            </>
                        )}
                    </button>
                    <button
                        onClick={onCancel}
                        disabled={isDeleting}
                        className="px-6 py-3 bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 disabled:opacity-50 text-gray-700 dark:text-gray-200 rounded-lg font-semibold transition-colors"
                    >
                        {t('Cancel')}
                    </button>
                </div>
            </div>
        </div>
    );
};


const MQTTTopicConfigurator = ({ room, sensorTypes, actuatorTypes, isLoadingActuators, userId, user, onSave, onClose, isNew, t }) => {
    const [sensorTopics, setSensorTopics] = useState({});
    const [actuatorTopics, setActuatorTopics] = useState({});
    const [copiedTopic, setCopiedTopic] = useState(null);
    const [testingTopics, setTestingTopics] = useState({});
    const [topicStatus, setTopicStatus] = useState({});
    const [validationErrors, setValidationErrors] = useState({});
    const [lastTestedData, setLastTestedData] = useState({});

    useEffect(() => {
        const defaultSensorTopics = {};
        const defaultActuatorTopics = {};

        // ✅ Check if editing existing room
        if (!room.isNew && room.existingSensorTopics) {
            Object.assign(defaultSensorTopics, room.existingSensorTopics);
        } else {
            sensorTypes.forEach(sensor => {
                defaultSensorTopics[sensor.code] = sensor.code;
            });
        }

        if (!room.isNew && room.existingActuatorTopics) {
            Object.assign(defaultActuatorTopics, room.existingActuatorTopics);
        } else {
            actuatorTypes.forEach(actuator => {
                defaultActuatorTopics[actuator.code] = actuator.code;
            });
        }

        setSensorTopics(defaultSensorTopics);
        setActuatorTopics(defaultActuatorTopics);
    }, [room, sensorTypes, actuatorTypes, userId]);


    const validateTopic = (topic) => {
        const errors = [];

        if (!topic || topic.trim() === '') {
            errors.push(t('Topic cannot be empty'));
        } else {
            if (topic.includes('#') && topic.indexOf('#') !== topic.length - 1) {
                errors.push(t('Wildcard # must be at the end'));
            }
            if (topic.includes(' ')) {
                errors.push(t('Topic cannot contain spaces'));
            }
            if (topic.length > 100) {
                errors.push(t('Topic too long (max 100 characters)'));
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
        toast.success(t('Topic copied to clipboard!'), {
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
        setTestingTopics(prev => ({ ...prev, [`${type}${code}`]: true }));

        try {
            const testToast = toast.loading(
                `🔍 Testing connection to: ${topic}`,
                {
                    style: {
                        borderRadius: '10px',
                        background: '#3b82f6',
                        color: '#fff',
                    }
                }
            );

            const response = await fetch(`${API_BASE_URL}/api/locations/test-mqtt-topic`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${user.token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    topic: topic,
                    roomId: room?.roomid || null,  // ✅ FIXED: Changed from selectedRoom to room
                    userId: user.id
                })
            });

            const result = await response.json();
            console.log('Test result:', result);

            if (result.success && result.dataReceived) {
                setTopicStatus(prev => ({ ...prev, [`${type}${code}`]: 'success' }));

                setLastTestedData(prev => ({
                    ...prev,
                    [`${type}${code}`]: {
                        data: result.sampleData,
                        dataType: result.dataType,
                        timestamp: result.timestamp,
                        rawData: result.rawData
                    }
                }));

                toast.success(
                    `✅ Topic valid! Received ${result.dataType} data`,
                    {
                        id: testToast,
                        duration: 4000,
                        style: {
                            borderRadius: '10px',
                            background: '#10b981',
                            color: '#fff',
                        }
                    }
                );

                console.log('📊 Sample data received:', result.sampleData);

                const samplePreview = JSON.stringify(result.sampleData).substring(0, 80);
                toast.success(
                    `📊 Sample: ${samplePreview}...`,
                    {
                        duration: 5000,
                        style: {
                            borderRadius: '10px',
                            background: '#6366f1',
                            color: '#fff',
                            fontSize: '12px'
                        }
                    }
                );

            } else {
                setTopicStatus(prev => ({ ...prev, [`${type}${code}`]: 'error' }));

                toast.error(
                    result.message || '⚠️ No data received from this topic within 10 seconds',
                    {
                        id: testToast,
                        duration: 6000,
                        style: {
                            borderRadius: '10px',
                            background: '#ef4444',
                            color: '#fff',
                        }
                    }
                );
            }

        } catch (error) {
            console.error('❌ Test connection error:', error);
            setTopicStatus(prev => ({ ...prev, [`${type}${code}`]: 'error' }));

            toast.error(
                `❌ Connection test failed: ${error.message}`,
                {
                    duration: 5000,
                    style: {
                        borderRadius: '10px',
                        background: '#ef4444',
                        color: '#fff',
                    }
                }
            );
        } finally {
            setTestingTopics(prev => ({ ...prev, [`${type}${code}`]: false }));
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
            toast.error(t('Please fix validation errors before saving!'), {
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
            return <FaCheckCircle className="text-green-600 dark:text-green-400" />;
        }
        if (status === 'error') {
            return <FaExclamationTriangle className="text-red-600 dark:text-red-400" />;
        }
        return null;
    };

    // Component to show test results
    const TestResultBadge = ({ type, code }) => {
        const key = `${type}${code}`;
        const testData = lastTestedData[key];
        const status = topicStatus[key];

        if (!testData && !status) return null;

        if (status === 'success' && testData) {
            return (
                <div className="mt-2 p-2 bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-700 rounded-lg">
                    <div className="flex items-center gap-2 mb-1">
                        <FaCheckCircle className="text-green-600 dark:text-green-400 text-sm" />
                        <span className="text-xs font-semibold text-green-800 dark:text-green-300">
                            Last Test: Success
                        </span>
                        <span className="text-xs text-green-600 dark:text-green-400">
                            ({testData.dataType})
                        </span>
                    </div>
                    <div className="bg-green-100 dark:bg-green-800/50 rounded p-2 mt-1">
                        <pre className="text-xs text-green-800 dark:text-green-200 overflow-x-auto max-h-20">
                            {JSON.stringify(testData.data, null, 2)}
                        </pre>
                    </div>
                    <div className="text-xs text-green-600 dark:text-green-400 mt-1">
                        {new Date(testData.timestamp).toLocaleString()}
                    </div>
                </div>
            );
        }

        if (status === 'error') {
            return (
                <div className="mt-2 p-2 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 rounded-lg">
                    <div className="flex items-center gap-2">
                        <FaExclamationTriangle className="text-red-600 dark:text-red-400 text-sm" />
                        <span className="text-xs font-semibold text-red-800 dark:text-red-300">
                            No data received
                        </span>
                    </div>
                </div>
            );
        }

        return null;
    };


    return (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>

                <div className="sticky top-0 bg-linear-to-r from-teal-600 to-teal-700 dark:from-teal-700 dark:to-teal-800 text-white p-6 z-10 rounded-t-lg">
                    <h2 className="text-2xl font-bold mb-2">{t('Configure MQTT Topics Modal')}</h2>
                    <p className="text-teal-100 text-sm">{t('Enter MQTT topics for')} {room.location}</p>
                    <div className="mt-3 bg-teal-800 bg-opacity-50 rounded px-3 py-2">
                        <p className="text-xs text-teal-100">{t('Room ID')}: <code className="font-mono bg-teal-900 px-2 py-1 rounded">{room.room_id}</code></p>
                    </div>
                </div>

                <div className="p-6 space-y-6">

                    <div className="bg-blue-50 dark:bg-blue-900/30 border-l-4 border-blue-500 p-4">
                        <div className="flex items-start gap-3">
                            <div className="text-blue-600 dark:text-blue-400 text-xl">💡</div>
                            <div>
                                <h4 className="font-semibold text-blue-800 dark:text-blue-300 mb-1">{t('Quick Setup Guide')}</h4>
                                <ul className="text-sm text-blue-700 dark:text-blue-400 space-y-1">
                                    <li>{t('Enter the MQTT topic that your sensor publishes to')}</li>
                                    <li>{t('Topics are case-sensitive and unique identifiers')}</li>
                                    <li>{t('Use simple names like:')} <code className="bg-blue-100 dark:bg-blue-800 px-1 rounded">ESP</code>, <code className="bg-blue-100 dark:bg-blue-800 px-1 rounded">ESP2</code>, <code className="bg-blue-100 dark:bg-blue-800 px-1 rounded">bowl</code></li>
                                    <li>{t('System will automatically subscribe and start receiving data')}</li>
                                </ul>
                            </div>
                        </div>
                    </div>

                    {/* Sensor Topics Section */}
                    <div>
                        <div className="flex items-center gap-2 mb-4">
                            <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">{t('Sensor Topics')}</h3>
                            <span className="text-sm text-gray-500 dark:text-gray-400">({sensorTypes.length} {t('sensors')})</span>
                        </div>

                        <div className="space-y-3">
                            {sensorTypes.map((sensor) => {
                                const hasError = validationErrors[`sensor_${sensor.code}`]?.length > 0;
                                const currentTopic = sensorTopics[sensor.code] || '';

                                return (
                                    <div key={sensor.code} className={`bg-gray-50 dark:bg-gray-700/50 border-2 rounded-lg p-4 transition-all ${hasError ? 'border-red-300 dark:border-red-500 bg-red-50 dark:bg-red-900/20' : 'border-gray-200 dark:border-gray-600 hover:border-teal-300 dark:hover:border-teal-500'}`}>
                                        <div className="flex items-center justify-between mb-3">
                                            <div>
                                                <div className="font-medium text-gray-800 dark:text-gray-200 flex items-center gap-2">
                                                    {sensor.name}
                                                    {getTopicStatusIcon('sensor', sensor.code)}
                                                </div>
                                                <div className="text-xs text-gray-500 dark:text-gray-400">{t('Unit:')} {sensor.unit} • {t('Type:')} {sensor.code}</div>
                                            </div>
                                            {copiedTopic === currentTopic && (
                                                <span className="text-xs text-green-600 dark:text-green-400 font-medium flex items-center gap-1">
                                                    <FaCheck /> {t('Copied!')}
                                                </span>
                                            )}
                                        </div>

                                        <div className="flex gap-2">
                                            <div className="flex-1">
                                                <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1 font-medium">
                                                    {t('MQTT Topic')} <span className="text-red-500">*</span>
                                                </label>
                                                <input
                                                    type="text"
                                                    value={currentTopic}
                                                    onChange={(e) => handleTopicChange('sensor', sensor.code, e.target.value)}
                                                    className={`w-full px-3 py-2 border-2 rounded-lg outline-none text-sm font-mono transition-all bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 ${hasError
                                                        ? 'border-red-400 focus:border-red-500 focus:ring-2 focus:ring-red-200 dark:focus:ring-red-800'
                                                        : 'border-gray-300 dark:border-gray-600 focus:border-teal-500 focus:ring-2 focus:ring-teal-200 dark:focus:ring-teal-800'
                                                        }`}
                                                    placeholder={`e.g., ${sensor.code}`}
                                                />
                                                {hasError && (
                                                    <div className="mt-1 text-xs text-red-600 dark:text-red-400">
                                                        {validationErrors[`sensor_${sensor.code}`].map((err, idx) => (
                                                            <div key={idx}>• {err}</div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                            <div className="flex flex-col gap-1 mt-6">
                                                <button
                                                    onClick={() => handleCopyTopic(currentTopic)}
                                                    className="p-2 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
                                                    title={t('Copy topic')}
                                                >
                                                    <FaCopy className="text-gray-600 dark:text-gray-400" />
                                                </button>
                                                <button
                                                    onClick={() => testMQTTConnection(currentTopic, 'sensor', sensor.code)}
                                                    disabled={testingTopics[`sensor_${sensor.code}`] || hasError}
                                                    className="p-2 hover:bg-teal-100 dark:hover:bg-teal-900/30 rounded-lg transition-colors disabled:opacity-50"
                                                    title={t('Test connection')}
                                                >
                                                    <FaPlug className="text-teal-600 dark:text-teal-400" />
                                                </button>
                                            </div>
                                        </div>

                                        <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                                            {t('Example:')} <code className="bg-gray-200 dark:bg-gray-600 px-2 py-0.5 rounded">{sensor.code}</code> or <code className="bg-gray-200 dark:bg-gray-600 px-2 py-0.5 rounded">ESP2</code>
                                        </div>

                                        <TestResultBadge type="sensor" code={sensor.code} />
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Actuator Topics Section */}
                    <div>
                        <div className="flex items-center gap-2 mb-4">
                            <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">{t('Actuator Topics')}</h3>
                            {isLoadingActuators ? (
                                <span className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-2">
                                    <span className="animate-spin">⏳</span>
                                    {t('Loading actuators...')}
                                </span>
                            ) : (
                                <span className="text-sm text-gray-500 dark:text-gray-400">({actuatorTypes.length} {t('actuators')})</span>
                            )}
                        </div>

                        {isLoadingActuators ? (
                            <div className="bg-white dark:bg-gray-700 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-8 text-center">
                                <span className="animate-spin text-3xl">⏳</span>
                                <p className="text-gray-600 dark:text-gray-400 mt-3">{t('Loading actuator types...')}</p>
                            </div>
                        ) : actuatorTypes.length === 0 ? (
                            <div className="bg-yellow-50 dark:bg-yellow-900/30 border-2 border-yellow-200 dark:border-yellow-700 rounded-lg p-6 text-center">
                                <p className="text-yellow-800 dark:text-yellow-300 font-medium">{t('No actuator types available')}</p>
                                <p className="text-sm text-yellow-600 dark:text-yellow-400 mt-1">{t('Contact administrator to add actuator types')}</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {actuatorTypes.map((actuator) => {
                                    const hasError = validationErrors[`actuator_${actuator.code}`]?.length > 0;
                                    const currentTopic = actuatorTopics[actuator.code] || '';

                                    return (
                                        <div key={actuator.code} className={`bg-gray-50 dark:bg-gray-700/50 border-2 rounded-lg p-4 transition-all ${hasError ? 'border-red-300 dark:border-red-500 bg-red-50 dark:bg-red-900/20' : 'border-gray-200 dark:border-gray-600 hover:border-teal-300 dark:hover:border-teal-500'}`}>
                                            <div className="flex items-center justify-between mb-3">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-xl">{actuator.icon}</span>
                                                    <div>
                                                        <div className="font-medium text-gray-800 dark:text-gray-200 flex items-center gap-2">
                                                            {actuator.name}
                                                            {getTopicStatusIcon('actuator', actuator.code)}
                                                        </div>
                                                        <div className="text-xs text-gray-500 dark:text-gray-400">{t('Control device')} • {t('Type:')} {actuator.code}</div>
                                                    </div>
                                                </div>
                                                {copiedTopic === currentTopic && (
                                                    <span className="text-xs text-green-600 dark:text-green-400 font-medium flex items-center gap-1">
                                                        <FaCheck /> {t('Copied!')}
                                                    </span>
                                                )}
                                            </div>

                                            <div className="flex gap-2">
                                                <div className="flex-1">
                                                    <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1 font-medium">
                                                        {t('MQTT Topic')} <span className="text-red-500">*</span>
                                                    </label>
                                                    <input
                                                        type="text"
                                                        value={currentTopic}
                                                        onChange={(e) => handleTopicChange('actuator', actuator.code, e.target.value)}
                                                        className={`w-full px-3 py-2 border-2 rounded-lg outline-none text-sm font-mono transition-all bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 ${hasError
                                                            ? 'border-red-400 focus:border-red-500 focus:ring-2 focus:ring-red-200 dark:focus:ring-red-800'
                                                            : 'border-gray-300 dark:border-gray-600 focus:border-teal-500 focus:ring-2 focus:ring-teal-200 dark:focus:ring-teal-800'
                                                            }`}
                                                        placeholder={`e.g., ${actuator.code}`}
                                                    />
                                                    {hasError && (
                                                        <div className="mt-1 text-xs text-red-600 dark:text-red-400">
                                                            {validationErrors[`actuator_${actuator.code}`].map((err, idx) => (
                                                                <div key={idx}>• {err}</div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="flex flex-col gap-1 mt-6">
                                                    <button
                                                        onClick={() => handleCopyTopic(currentTopic)}
                                                        className="p-2 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
                                                        title={t('Copy topic')}
                                                    >
                                                        <FaCopy className="text-gray-600 dark:text-gray-400" />
                                                    </button>
                                                    <button
                                                        onClick={() => testMQTTConnection(currentTopic, 'actuator', actuator.code)}
                                                        disabled={testingTopics[`actuator_${actuator.code}`] || hasError}
                                                        className="p-2 hover:bg-teal-100 dark:hover:bg-teal-900/30 rounded-lg transition-colors disabled:opacity-50"
                                                        title={t('Test connection')}
                                                    >
                                                        <FaPlug className="text-teal-600 dark:text-teal-400" />
                                                    </button>
                                                </div>
                                            </div>

                                            <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                                                {t('Example:')} <code className="bg-gray-200 dark:bg-gray-600 px-2 py-0.5 rounded">{actuator.code}</code> or <code className="bg-gray-200 dark:bg-gray-600 px-2 py-0.5 rounded">control/{actuator.code}</code>
                                            </div>

                                            <TestResultBadge type="actuator" code={actuator.code} />

                                        </div>


                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* Important Notes Section */}
                    <div className="bg-yellow-50 dark:bg-yellow-900/30 border-l-4 border-yellow-500 p-4">
                        <h4 className="font-semibold text-yellow-800 dark:text-yellow-300 mb-2">{t('Important Notes')}</h4>
                        <ul className="text-sm text-yellow-700 dark:text-yellow-400 space-y-1">
                            <li>{t('Topics must match exactly what your sensors publish to')}</li>
                            <li>{t('System will automatically subscribe to these topics')}</li>
                            <li>{t('Data will start flowing immediately after saving')}</li>
                            <li>{t('You can change topics later by editing the room configuration')}</li>
                        </ul>
                    </div>
                </div>

                {/* Footer Buttons */}
                <div className="sticky bottom-0 bg-gray-50 dark:bg-gray-700/50 border-t-2 border-gray-200 dark:border-gray-600 p-6 flex gap-3 rounded-b-lg">
                    <button
                        onClick={handleSave}
                        className="flex-1 bg-linear-to-r from-teal-600 to-teal-700 hover:from-teal-700 hover:to-teal-800 text-white px-6 py-3 rounded-lg font-semibold transition-all flex items-center justify-center gap-2 shadow-lg"
                    >
                        <FaSave />
                        {isNew ? t('Create Room & Subscribe') : t('Save & Update Subscriptions')}
                    </button>
                    <button
                        onClick={onClose}
                        className="px-6 py-3 bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 text-gray-700 dark:text-gray-200 rounded-lg font-semibold transition-colors"
                    >
                        {t('Cancel')}
                    </button>
                </div>
            </div>
        </div>
    );
};

const DynamicLocationSelector = ({ selectedLocation, onLocationChange }) => {
    const { user } = useContext(AuthContext);
    const pathname = usePathname();
    const router = useRouter();
    const lng = pathname.split("/")[1];
    const { t } = useTranslation(lng, "location-selector");

    const [locations, setLocations] = useState([]);
    const [newLocationName, setNewLocationName] = useState('');
    const [isAdding, setIsAdding] = useState(false);
    const [loading, setLoading] = useState(true);
    const [socket, setSocket] = useState(null);
    const [showConfig, setShowConfig] = useState(false);
    const [selectedRoom, setSelectedRoom] = useState(null);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [roomToDelete, setRoomToDelete] = useState(null);

    // ✅ NEW: Mobile dropdown state
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);

    const [sensorTypes] = useState([
        { code: 'temperature', name: 'Temperature', unit: '°C', category: 'environmental' },
        { code: 'humidity', name: 'Humidity', unit: '%', category: 'environmental' },
        { code: 'bowl_temp', name: 'Bowl Temperature', unit: '°C', category: 'process' },
        { code: 'sonar_distance', name: 'Sonar Distance', unit: 'cm', category: 'physical' },
        { code: 'co2_level', name: 'CO2 Level', unit: 'ppm', category: 'chemical' },
        { code: 'sugar_level', name: 'Sugar Level', unit: '°Brix', category: 'chemical' },
        { code: 'airflow', name: 'Airflow', unit: 'm/s', category: 'environmental' }
    ]);

    const [actuatorTypes, setActuatorTypes] = useState([]);
    const [isLoadingActuators, setIsLoadingActuators] = useState(true);

    const fetchActuatorTypes = async () => {
        setIsLoadingActuators(true); // Add this line
        try {
            const response = await fetch(`${API_BASE_URL}/api/actuator-types`, {
                headers: { 'Authorization': `Bearer ${user.token}` }
            });

            if (response.ok) {
                const data = await response.json();
                setActuatorTypes(data.actuator_types || []);
            } else {
                console.error('Failed to fetch actuator types:', response.statusText);
            }
        } catch (error) {
            console.error('Error fetching actuator types:', error);
        } finally {
            setIsLoadingActuators(false); // Add this line
        }
    };
    useEffect(() => {
        if (!user) return;

        fetchUserLocations();
        fetchActuatorTypes();

        return () => {
            if (socket) {
                socket.disconnect();
                setSocket(null);
            }
        };
    }, [user]);

    // ✅ FIXED: Setup socket AFTER locations are loaded
    useEffect(() => {
        if (!user || locations.length === 0) return;

        // Clean up existing socket
        if (socket) {
            socket.disconnect();
        }

        setupRealtimeUpdates();

        return () => {
            if (socket) {
                locations.forEach(loc => {
                    socket.emit('leaveLocation', loc.location);
                });
            }
        };
    }, [user, locations.length]); // ✅ Depend on locations.length

    // ✅ FIXED: Real-time measurement updates with better matching
    useEffect(() => {
        if (!socket || locations.length === 0) return;

        const handleNewMeasurement = (data) => {
            console.log('📊 LocationSelector measurement received:', {
                location: data.location,
                roomId: data.roomId,
                roomCode: data.roomCode,
                timestamp: data.timestamp
            });

            setLocations(prev => prev.map(loc => {
                // ✅ FIXED: Comprehensive matching
                const isMatch =
                    loc.location === data.location ||
                    String(loc.room_id) === String(data.roomId) ||
                    loc.location === data.roomCode ||
                    loc.room_id === data.roomCode;

                if (isMatch) {
                    console.log(`✅ Incrementing count for ${loc.location}: ${(loc.measurement_count || 0) + 1}`);
                    return {
                        ...loc,
                        measurement_count: (loc.measurement_count || 0) + 1,
                        last_measurement: new Date(data.timestamp)
                    };
                }
                return loc;
            }));
        };

        // ✅ Listen to ALL possible events
        const events = ['newMeasurement', 'environmentUpdate', 'sensorUpdate', 'measurementUpdate'];
        events.forEach(event => {
            socket.on(event, handleNewMeasurement);
        });

        return () => {
            events.forEach(event => {
                socket.off(event, handleNewMeasurement);
            });
        };
    }, [socket, locations]);

    const setupRealtimeUpdates = () => {
        const socketConnection = createSocket(user.token);
        setSocket(socketConnection);

        socketConnection.on('connect', () => {
            console.log('🔌 LocationSelector socket connected');
            // Join all location rooms on connect
            locations.forEach(loc => {
                socketConnection.emit('joinLocation', loc.location);
            });
        });

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

        // ✅ REAL-TIME MEASUREMENT COUNT UPDATE
        const handleNewMeasurement = (data) => {
            console.log('📊 LocationSelector received measurement:', data);

            setLocations(prev => prev.map(loc => {
                // Check multiple possible identifiers
                const isMatch =
                    loc.location === data.location ||
                    loc.room_id === data.roomId ||
                    loc.location === data.roomCode;

                if (isMatch) {
                    console.log(`✅ Updating count for ${loc.location}: ${(loc.measurement_count || 0) + 1}`);
                    return {
                        ...loc,
                        measurement_count: (loc.measurement_count || 0) + 1,
                        last_measurement: new Date(data.timestamp)
                    };
                }
                return loc;
            }));
        };

        // Listen to multiple event types
        socketConnection.on('newMeasurement', handleNewMeasurement);
        socketConnection.on('environmentUpdate', handleNewMeasurement);
        socketConnection.on('sensorUpdate', handleNewMeasurement);
        socketConnection.on('measurementUpdate', handleNewMeasurement);
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
            toast.error(t('Failed to fetch locations'));
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
                    ? t('Creating room and configuring MQTT topics...')
                    : t('Updating room and MQTT topics...'),
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
                        ? t('Room created successfully')
                            .replace('{{room}}', selectedRoom.location)
                            .replace('{{sensors}}', Object.keys(sensorTopics).length)
                            .replace('{{actuators}}', Object.keys(actuatorTopics).length)
                        : t('Room updated successfully').replace('{{room}}', selectedRoom.location);
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

    // ✅ NEW: Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (isDropdownOpen && !event.target.closest('.location-selector-wrapper')) {
                setIsDropdownOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isDropdownOpen]);

    if (loading) {
        return (
            <div className="bg-white rounded-lg shadow-lg p-3 md:p-4">
                <p className="text-gray-600 text-sm md:text-base">{t('Loading locations...')}</p>
            </div>
        );
    }


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

                // ✅ Add null checks
                (data.sensors || []).forEach(sensor => {
                    existingSensorTopics[sensor.type_code] = sensor.mqtt_topic;
                });

                (data.actuators || []).forEach(actuator => {
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
            toast.error(t('Failed to load room configuration'));
        }
    };



    const handleDeleteRoom = (roomId, locationName) => {
        console.log('🔵 Opening delete modal for:', roomId, locationName);
        setRoomToDelete({ room_id: roomId, location: locationName });
        setShowDeleteModal(true);
    };

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
                loading: t('Deleting room...').replace('{{room}}', location),
                success: (result) => {
                    console.log('✅ Delete successful:', result);

                    setLocations(prev => prev.filter(loc => {
                        const locRoomId = typeof loc.room_id === 'string' ? parseInt(loc.room_id, 10) : loc.room_id;
                        const deleteRoomId = typeof room_id === 'string' ? parseInt(room_id, 10) : room_id;
                        return locRoomId !== deleteRoomId;
                    }));

                    if (selectedLocation === location) {
                        const remainingLocations = locations.filter(loc => {
                            const locRoomId = typeof loc.room_id === 'string' ? parseInt(loc.room_id, 10) : loc.room_id;
                            const deleteRoomId = typeof room_id === 'string' ? parseInt(room_id, 10) : room_id;
                            return locRoomId !== deleteRoomId;
                        });
                        onLocationChange(remainingLocations[0]?.location || null);
                    }

                    setShowDeleteModal(false);
                    setRoomToDelete(null);

                    return t('Room deleted successfully').replace('{{room}}', location);
                },
                error: (err) => {
                    console.error('❌ Delete error:', err);
                    setShowDeleteModal(false);
                    setRoomToDelete(null);
                    return t('Failed to delete room').replace('{{error}}', err.message);
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
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-4">
                <p className="text-gray-600 dark:text-gray-400">{t('Loading locations...')}</p>
            </div>
        );
    }

    return (
        <div className="relative group location-selector-wrapper">
            <div
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className="lg:pointer-events-none bg-linear-to-r from-teal-600 to-teal-700 dark:from-gray-700 dark:to-gray-800 hover:from-teal-700 hover:to-teal-800 dark:hover:from-gray-600 dark:hover:to-gray-700 text-white px-5 py-3 rounded-lg cursor-pointer transition-all duration-200 flex items-center gap-3 min-w-[280px] shadow-lg">
                <FaMapMarkerAlt className="text-teal-200 dark:text-gray-400 text-xl" />
                <div className="flex-1">
                    <div className="text-sm font-semibold">
                        {locations.find(loc => loc.location === selectedLocation)?.location || t('Select Location')}
                    </div>
                    <div className="text-xs text-teal-200 dark:text-gray-400">
                        {locations.find(loc => loc.location === selectedLocation)?.room_id || t('No room selected')}
                    </div>
                </div>
                <svg
                    className={`w-5 h-5 text-teal-200 dark:text-gray-400 transition-transform ${isDropdownOpen ? 'rotate-180' : ''} lg:group-hover:rotate-180`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
            </div>

            <div className={`absolute top-full left-0 mt-2 w-full min-w-[350px] bg-white dark:bg-gray-800 rounded-lg shadow-2xl transition-all duration-200 z-50 max-h-[500px] overflow-y-auto border dark:border-gray-700
                ${isDropdownOpen ? 'opacity-100 visible' : 'opacity-0 invisible'}
                lg:opacity-0 lg:invisible lg:group-hover:opacity-100 lg:group-hover:visible`}>

                <div className="py-2">
                    {locations.map((loc, index) => (
                        <div
                            key={`${loc.location}-${index}`}
                            className={`group/item px-4 py-3 hover:bg-teal-50 dark:hover:bg-gray-700 transition-colors border-l-4 ${selectedLocation === loc.location
                                ? 'border-teal-600 bg-teal-50 dark:bg-gray-700'
                                : 'border-transparent'
                                }`}
                        >
                            <div className="flex items-start gap-3">
                                <FaMapMarkerAlt className={`mt-1 ${selectedLocation === loc.location ? 'text-teal-600 dark:text-teal-400' : 'text-gray-400 dark:text-gray-500'
                                    }`} />

                                <div className="flex-1 cursor-pointer" onClick={() => onLocationChange(loc.location)}>
                                    <div className="flex items-center justify-between">
                                        <span className={`font-medium ${selectedLocation === loc.location ? 'text-teal-700 dark:text-teal-400' : 'text-gray-800 dark:text-gray-200'
                                            }`}>
                                            {loc.location}
                                        </span>
                                        <span className="text-xs bg-gray-100 dark:bg-gray-600 text-gray-600 dark:text-gray-300 px-2 py-1 rounded-full">
                                            {loc.measurement_count || 0}
                                        </span>
                                    </div>
                                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                        {t('Room ID')}: {loc.room_id}
                                    </div>
                                </div>

                                <div className="flex gap-1 opacity-100 lg:opacity-0 lg:group-hover/item:opacity-100 transition-opacity">
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleConfigureRoom(loc);
                                        }}
                                        className="p-2 hover:bg-teal-100 dark:hover:bg-teal-900/30 rounded-lg transition-colors"
                                        title={t('Configure MQTT Topics')}
                                    >
                                        <FaCog className="text-teal-600 dark:text-teal-400 text-sm" />
                                    </button>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleDeleteRoom(loc.room_id, loc.location);
                                        }}
                                        className="p-2 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                                        title={t('Delete Room')}
                                    >
                                        <FaTrash className="text-red-600 dark:text-red-400 text-sm" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                <div className="border-t border-gray-200 dark:border-gray-700"></div>

                {isAdding ? (
                    <div className="p-4 bg-gray-50 dark:bg-gray-700/50">
                        <input
                            type="text"
                            value={newLocationName}
                            onChange={(e) => setNewLocationName(e.target.value)}
                            placeholder={t('Enter room name (e.g., Fermentation Tank 1)')}
                            maxLength={50}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none text-sm bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200"
                            onKeyPress={(e) => e.key === 'Enter' && handleCreateRoomClick()}
                            autoFocus
                        />
                        <div className="flex gap-2 mt-3">
                            <button
                                className="flex-1 bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                                onClick={handleCreateRoomClick}
                            >
                                {t('Next: Configure MQTT →')}
                            </button>
                            <button
                                className="px-4 py-2 bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 text-gray-700 dark:text-gray-200 rounded-lg text-sm font-medium transition-colors"
                                onClick={() => {
                                    setIsAdding(false);
                                    setNewLocationName('');
                                }}
                            >
                                {t('Cancel')}
                            </button>
                        </div>
                    </div>
                ) : (
                    <button
                        className="w-full px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center gap-3 text-teal-600 dark:text-teal-400 font-medium"
                        onClick={() => setIsAdding(true)}
                    >
                        <FaPlus className="text-sm" />
                        <span>{t('Add New Room')}</span>
                    </button>
                )}
            </div>

            {/* MQTT Configuration Modal */}
            {showConfig && selectedRoom && (
                <MQTTTopicConfigurator
                    room={selectedRoom}
                    sensorTypes={sensorTypes}
                    actuatorTypes={actuatorTypes}
                    isLoadingActuators={isLoadingActuators}
                    userId={user?.id}
                    user={user}
                    onClose={() => {
                        setShowConfig(false);
                        setSelectedRoom(null);
                    }}
                    onSave={handleSaveRoomWithSensors}
                    isNew={selectedRoom.isNew}
                    t={t}
                />
            )}

            {/* Delete Confirmation Modal */}
            {showDeleteModal && roomToDelete && (
                <DeleteConfirmModal
                    room={roomToDelete}
                    onConfirm={executeDeleteRoom}
                    onCancel={() => {
                        setShowDeleteModal(false);
                        setRoomToDelete(null);
                    }}
                    t={t}
                />
            )}
        </div>
    );
};


export default DynamicLocationSelector;
