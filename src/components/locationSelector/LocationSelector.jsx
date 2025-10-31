"use client";
import React, { useState, useEffect, useContext } from 'react';
import { FaMapMarkerAlt, FaPlus, FaTimes } from 'react-icons/fa';
import { createSocket } from '../../lib/socket';
import AuthContext from '../../context/AuthContext';
import API_BASE_URL from '../../config/api.js';

const LocationSelector = ({ selectedLocation, onLocationChange }) => {
    const { user } = useContext(AuthContext);
    const [locations, setLocations] = useState([]);
    const [newLocationName, setNewLocationName] = useState('');
    const [isAdding, setIsAdding] = useState(false);
    const [loading, setLoading] = useState(true);
    const [socket, setSocket] = useState(null);
    const [updatingLocations, setUpdatingLocations] = useState(new Set());

    useEffect(() => {
        if (!user) return;

        fetchUserLocations();
        setupRealtimeUpdates();

        return () => {
            if (socket) {
                socket.disconnect();
            }
        };
    }, [user]);

    const setupRealtimeUpdates = () => {
        const socketConnection = createSocket(user.token);
        setSocket(socketConnection);

        socketConnection.on('connect', () => {
            //console.log('📡 LocationSelector connected to real-time updates');
        });

        // Listen for location list updates
        socketConnection.on('locationListUpdate', (data) => {
            // console.log('📍 Real-time location update received:', data);
            if (data.userId === user.id) {
                setLocations(data.locations);
            }
        });

        // Listen for new measurements to update counts
        socketConnection.on('environmentUpdate', (data) => {
            if (data.userId === user.id) {
                updateLocationMeasurementCount(data.location);
            }
        });


        socketConnection.on('environmentUpdate', (data) => {
            if (data.userId === user.id) {
                updateLocationMeasurementCount(data.location);

                // Add visual feedback
                setUpdatingLocations(prev => new Set([...prev, data.location]));
                setTimeout(() => {
                    setUpdatingLocations(prev => {
                        const newSet = new Set(prev);
                        newSet.delete(data.location);
                        return newSet;
                    });
                }, 1000);
            }
        });

        // Listen for new location additions
        socketConnection.on('newLocationAdded', (data) => {
            if (data.userId === user.id) {
                //console.log(`✨ New location "${data.location}" added in real-time`);
                setLocations(prev => {
                    // Check if location already exists
                    const exists = prev.some(loc => loc.location === data.location);
                    if (!exists) {
                        return [...prev, {
                            location: data.location,
                            measurement_count: 0,
                            last_measurement: new Date()
                        }];
                    }
                    return prev;
                });
            }
        });

        socketConnection.on('disconnect', () => {
            // console.log('📡 LocationSelector disconnected from real-time updates');
        });
    };

    const updateLocationMeasurementCount = (locationName) => {
        setLocations(prev =>
            prev.map(loc =>
                loc.location === locationName
                    ? {
                        ...loc,
                        measurement_count: (loc.measurement_count || 0) + 1,
                        last_measurement: new Date()
                    }
                    : loc
            )
        );
    };

    const fetchUserLocations = async () => {
        if (!user) return;

        try {
            const response = await fetch(`${API_BASE_URL}/api/locations`, {
                headers: {
                    'Authorization': `Bearer ${user.token}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                const locationsList = data.locations || [];
                setLocations(locationsList);

                // Set default location if none selected and locations exist
                if (!selectedLocation && locationsList.length > 0) {
                    onLocationChange(locationsList[0].location);
                } else if (locationsList.length === 0 && !selectedLocation) {
                    onLocationChange('main-room');
                }
            }
        } catch (error) {
            console.error('Error fetching locations:', error);
            if (!selectedLocation) {
                onLocationChange('main-room');
            }
        } finally {
            setLoading(false);
        }
    };

    const handleAddLocation = async () => {
        if (!newLocationName.trim()) return;

        const locationName = newLocationName.trim();

        try {
            // Initialize the location on the backend
            const response = await fetch(
                `${API_BASE_URL}/api/locations/${encodeURIComponent(locationName)}/initialize`,
                {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${user.token}`
                    }
                }
            );

            if (response.ok) {
                //console.log(`✅ Location "${locationName}" initialized for simulation`);

                // Emit new location event for real-time updates across all users
                if (socket) {
                    socket.emit('locationAdded', {
                        userId: user.id,
                        location: locationName
                    });
                }
            }
        } catch (error) {
            console.error('Error initializing location:', error);
        }

        // Switch to the new location
        onLocationChange(locationName);
        setNewLocationName('');
        setIsAdding(false);

        // Optimistic update - add to local state immediately
        setLocations(prev => {
            const exists = prev.some(loc => loc.location === locationName);
            if (!exists) {
                return [...prev, {
                    location: locationName,
                    measurement_count: 0,
                    last_measurement: new Date()
                }];
            }
            return prev;
        });
    };

    const handleLocationClick = (location) => {
        onLocationChange(location);
    };

    if (loading) {
        return (
            <div className="location-selector">
                <h3><FaMapMarkerAlt /> Select Location</h3>
                <p>Loading locations...</p>
            </div>
        );
    }

    return (
        <div className="relative group">
            {/* Selected Location Display */}
            <div className="bg-teal-700 hover:bg-teal-600 text-white px-4 py-2.5 rounded-lg cursor-pointer transition-all duration-200 flex items-center gap-3 min-w-[250px] shadow-lg">
                <FaMapMarkerAlt className="text-teal-200" />
                <div className="flex-1">
                    <div className="text-sm font-medium">
                        {locations.find(loc => loc.location === selectedLocation)?.location || 'Select Location'}
                    </div>
                    <div className="text-xs text-teal-200">
                        {locations.find(loc => loc.location === selectedLocation)?.measurement_count || 0} measurements
                    </div>
                </div>
                <svg className="w-4 h-4 text-teal-200 transition-transform group-hover:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
            </div>

            {/* Dropdown Menu - Shows on Hover */}
            <div className="absolute top-full left-0 mt-2 w-full min-w-[300px] bg-white rounded-lg shadow-2xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 max-h-[400px] overflow-y-auto">

                {/* Location Options */}
                <div className="py-2">
                    {locations.map((loc, index) => (
                        <button
                            key={`${loc.location}-${index}`}
                            className={`w-full px-4 py-3 text-left hover:bg-teal-50 transition-colors flex items-start gap-3 border-l-4 ${selectedLocation === loc.location
                                ? 'border-teal-600 bg-teal-50'
                                : 'border-transparent'
                                } ${updatingLocations.has(loc.location)
                                    ? 'bg-blue-50 animate-pulse'
                                    : ''
                                }`}
                            onClick={() => handleLocationClick(loc.location)}
                        >
                            <FaMapMarkerAlt className={`mt-1 ${selectedLocation === loc.location
                                ? 'text-teal-600'
                                : 'text-gray-400'
                                }`} />

                            <div className="flex-1">
                                <div className="flex items-center justify-between">
                                    <span className={`font-medium ${selectedLocation === loc.location
                                        ? 'text-teal-700'
                                        : 'text-gray-800'
                                        }`}>
                                        {loc.location}
                                    </span>
                                    <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full">
                                        {loc.measurement_count || 0}
                                    </span>
                                </div>
                                <div className="text-xs text-gray-500 mt-1">
                                    Last update: {loc.last_measurement
                                        ? new Date(loc.last_measurement).toLocaleTimeString()
                                        : 'No data'}
                                </div>
                            </div>

                            {updatingLocations.has(loc.location) && (
                                <span className="inline-flex h-2 w-2 rounded-full bg-blue-500 animate-ping"></span>
                            )}
                        </button>
                    ))}
                </div>

                {/* Divider */}
                <div className="border-t border-gray-200"></div>

                {/* Add New Location Section */}
                {isAdding ? (
                    <div className="p-4 bg-gray-50">
                        <input
                            type="text"
                            value={newLocationName}
                            onChange={(e) => setNewLocationName(e.target.value)}
                            placeholder="Enter room name (e.g., bedroom, kitchen)"
                            maxLength={50}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none text-sm"
                            onKeyPress={(e) => e.key === 'Enter' && handleAddLocation()}
                            autoFocus
                        />
                        <div className="flex gap-2 mt-3">
                            <button
                                className="flex-1 bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
                                onClick={handleAddLocation}
                            >
                                <FaPlus className="text-xs" />
                                Add
                            </button>
                            <button
                                className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
                                onClick={() => {
                                    setIsAdding(false);
                                    setNewLocationName('');
                                }}
                            >
                                <FaTimes className="text-xs" />
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
                        <span>Add New Location</span>
                    </button>
                )}
            </div>
        </div>
    );
};

export default LocationSelector;
