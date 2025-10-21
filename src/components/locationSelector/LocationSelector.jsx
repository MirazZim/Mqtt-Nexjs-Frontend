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
        <div className="location-selector">
            <h3><FaMapMarkerAlt /> Select Location</h3>

            <div className="location-options">
                {locations.map((loc, index) => (
                    <button
                        key={`${loc.location}-${index}`}
                        className={`location-btn ${selectedLocation === loc.location ? 'active' : ''} ${updatingLocations.has(loc.location) ? 'updating new-data' : ''}`}
                        onClick={() => handleLocationClick(loc.location)}

                    >
                        <span className="location-name">{loc.location}</span>
                        <span className="measurement-count">({loc.measurement_count || 0})</span>
                        <span className="last-update">
                            {loc.last_measurement ?
                                new Date(loc.last_measurement).toLocaleTimeString() :
                                'No data'
                            }
                        </span>
                    </button>
                ))}
            </div>

            {isAdding ? (
                <div className="add-location-form">
                    <input
                        type="text"
                        value={newLocationName}
                        onChange={(e) => setNewLocationName(e.target.value)}
                        placeholder="Enter room name (e.g., bedroom, kitchen)"
                        maxLength={50}
                        onKeyPress={(e) => e.key === 'Enter' && handleAddLocation()}
                    />
                    <div className="form-actions">
                        <button className="add-btn" onClick={handleAddLocation}>
                            <FaPlus /> Add
                        </button>
                        <button className="cancel-btn" onClick={() => {
                            setIsAdding(false);
                            setNewLocationName('');
                        }}>
                            <FaTimes /> Cancel
                        </button>
                    </div>
                </div>
            ) : (
                <button
                    className="add-location-btn"
                    onClick={() => setIsAdding(true)}
                >
                    <FaPlus /> Add New Location
                </button>
            )}
        </div>
    );
};

export default LocationSelector;
