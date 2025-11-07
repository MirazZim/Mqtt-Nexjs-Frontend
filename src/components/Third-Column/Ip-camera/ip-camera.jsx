"use client";
import React, { useEffect, useRef, useState } from 'react';
import IP_Camera_BASE_URL from '../../../config/ipCameraApi';
import { usePathname } from 'next/navigation';  // ✅ ADD THIS
import { useTranslation } from '../../../app/i18n/client.js';  // ✅ ADD THIS

const IPCamera = ({ selectedLocation }) => {
    // ✅ ADD THESE LINES
    const pathname = usePathname();
    const lng = pathname.split("/")[1];
    const { t } = useTranslation(lng, "camera");

    const [autoSave, setAutoSave] = useState(false);
    const [lastCapture, setLastCapture] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const intervalRef = useRef(null);

    const captureImageToServer = async () => {
        setIsLoading(true);
        try {
            const response = await fetch("http://localhost:3001/api/camera/capture");
            if (!response.ok) throw new Error(t("Failed to capture image"));
            const data = await response.json();
            setLastCapture(new Date().toLocaleTimeString());
            console.log(`📸 ${t("Image captured")}:`, data.file);
        } catch (error) {
            console.error(t("Error capturing image"), error);
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
                {t("IP Camera Feed")}
            </h3>

            <div className="space-y-2">
                <div className="bg-gray-50 rounded-md border border-gray-200 overflow-hidden">
                    <iframe
                        src={IP_Camera_BASE_URL}
                        className="w-full h-48"
                        title={t("IP Camera Feed")}
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
                                        {t("Capturing...")}
                                    </>
                                ) : (
                                    <>
                                        <span>📸</span>
                                        {t("Capture Now")}
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
                                {autoSave ? `⏹️ ${t("Stop Auto")}` : `▶️ ${t("Auto Save")}`}
                            </button>
                        </div>

                        <div className="mt-2 flex items-center justify-between text-xs">
                            <div className="flex items-center gap-1.5">
                                <span className={`inline-flex h-1.5 w-1.5 rounded-full ${autoSave ? 'bg-red-500 animate-pulse' : 'bg-gray-400'
                                    }`}></span>
                                <span className="text-gray-600">
                                    {autoSave ? t("Auto-saving every 5s") : t("Manual mode")}
                                </span>
                            </div>
                            {lastCapture && (
                                <span className="text-gray-500">
                                    {t("Last")}: {lastCapture}
                                </span>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default IPCamera;
