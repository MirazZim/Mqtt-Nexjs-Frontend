"use client";
import React, { useEffect, useRef, useState } from 'react';

const IPCamera = ({ selectedLocation }) => {
    const [autoSave, setAutoSave] = useState(false);
    const [lastCapture, setLastCapture] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const intervalRef = useRef(null);

    const captureImageToServer = async () => {
        setIsLoading(true);
        try {
            const response = await fetch("http://localhost:3001/api/camera/capture");
            if (!response.ok) throw new Error("Failed to capture image");
            const data = await response.json();
            setLastCapture(new Date().toLocaleTimeString());
            console.log("📸 Image captured:", data.file);
        } catch (error) {
            console.error("Error capturing image:", error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (autoSave) {
            intervalRef.current = setInterval(() => {
                captureImageToServer();
            }, 5000);
        } else if (intervalRef.current) {
            clearInterval(intervalRef.current);
        }
        return () => clearInterval(intervalRef.current);
    }, [autoSave]);

    return (
        <div className="bg-white rounded-lg shadow-md p-3">
            <h3 className="text-sm font-semibold text-gray-800 mb-2 flex items-center gap-2">
                <span className="text-base">📹</span>
                IP Camera Feed
            </h3>

            <div className="space-y-2">
                <div className="bg-gray-50 rounded-md border border-gray-200 overflow-hidden">
                    <iframe
                        src="http://192.168.88.42:8080/jsfs.html"
                        className="w-full h-48"
                        title="IP Camera Live Feed"
                        style={{ border: 'none' }}
                        allow="camera"
                    />

                    <div className="p-2 bg-white border-t border-gray-200">
                        <div className="flex items-center justify-between gap-2">
                            <button
                                onClick={captureImageToServer}
                                disabled={isLoading}
                                className="flex-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-xs font-medium rounded-md transition-colors flex items-center justify-center gap-1"
                            >
                                {isLoading ? (
                                    <>
                                        <span className="inline-block h-3 w-3 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                                        Capturing...
                                    </>
                                ) : (
                                    <>
                                        <span>📸</span>
                                        Capture Now
                                    </>
                                )}
                            </button>

                            <button
                                onClick={() => setAutoSave(!autoSave)}
                                className={`flex-1 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${autoSave
                                    ? 'bg-red-600 hover:bg-red-700 text-white'
                                    : 'bg-green-600 hover:bg-green-700 text-white'
                                    }`}
                            >
                                {autoSave ? '⏹️ Stop Auto' : '▶️ Auto Save'}
                            </button>
                        </div>

                        <div className="mt-2 flex items-center justify-between text-xs">
                            <div className="flex items-center gap-1.5">
                                <span className={`inline-flex h-1.5 w-1.5 rounded-full ${autoSave ? 'bg-red-500 animate-pulse' : 'bg-gray-400'}`}></span>
                                <span className="text-gray-600">
                                    {autoSave ? 'Auto-saving every 5s' : 'Manual mode'}
                                </span>
                            </div>
                            {lastCapture && (
                                <span className="text-gray-500">Last: {lastCapture}</span>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default IPCamera;
