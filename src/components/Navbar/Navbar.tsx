'use client'

import React, { useContext } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import AuthContext from '../../context/AuthContext.jsx';
import NotificationBell from '../Navbar/NotificationBell.jsx';

const Navbar = () => {
    const { user, logout, isAdmin } = useContext(AuthContext);
    const router = useRouter();

    const handleLogout = () => {
        logout();
        router.push('/login');
    };

    return (
        <nav className="bg-white/70 dark:bg-gray-900/70 backdrop-blur-2xl border-b border-white/20 dark:border-gray-700/20 sticky top-0 z-[1000] shadow-xl shadow-gray-900/5">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex justify-between items-center h-16">
                    {/* Brand with Icon */}
                    <Link
                        href="/dashboard"
                        className="flex items-center gap-3 group no-underline"
                    >
                        <div className="relative">
                            <div className="absolute inset-0 bg-gradient-to-r from-teal-500 to-blue-500 rounded-xl blur-lg opacity-50 group-hover:opacity-75 transition-opacity duration-300"></div>
                            <div className="relative w-10 h-10 bg-gradient-to-br from-teal-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg backdrop-blur-sm">
                                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                </svg>
                            </div>
                        </div>
                        <span className="text-xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 dark:from-white dark:to-gray-300 bg-clip-text text-transparent group-hover:from-teal-600 group-hover:to-blue-600 transition-all duration-300">
                            IoT Dashboard
                        </span>
                    </Link>

                    {/* Menu */}
                    <div className="flex items-center gap-3">
                        {user ? (
                            <>
                                {/* Welcome Text with Avatar - Blurred Glass */}
                                <div className="hidden md:flex items-center gap-3 px-4 py-2 bg-white/50 dark:bg-gray-800/50 backdrop-blur-xl rounded-xl border border-white/30 dark:border-gray-700/30 shadow-lg">
                                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-teal-500 to-blue-600 flex items-center justify-center text-white text-sm font-bold shadow-md">
                                        {user.username.charAt(0).toUpperCase()}
                                    </div>
                                    <div>
                                        <p className="text-xs text-gray-600 dark:text-gray-400 leading-none">Welcome back,</p>
                                        <p className="text-sm font-semibold text-gray-900 dark:text-white leading-none mt-0.5">
                                            {user.username}
                                        </p>
                                    </div>
                                </div>

                                



                                {/* Admin Link - Blurred Glass */}
                                {isAdmin() && (
                                    <Link
                                        href="/admin"
                                        className="hidden lg:flex items-center gap-2 px-4 py-2 bg-purple-500/20 dark:bg-purple-500/20 backdrop-blur-xl text-purple-700 dark:text-purple-300 rounded-xl font-medium text-sm no-underline transition-all duration-300 hover:shadow-lg hover:scale-105 border border-purple-300/30 dark:border-purple-500/30 hover:bg-purple-500/30"
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                        </svg>
                                        Admin
                                    </Link>
                                )}

                                {/* Notification Bell */}
                                <NotificationBell />

                                {/* Logout Button - Blurred Glass */}
                                <button
                                    onClick={handleLogout}
                                    className="group relative px-5 py-2 bg-red-500/80 dark:bg-red-500/80 backdrop-blur-xl text-white rounded-xl font-medium text-sm transition-all duration-300 hover:shadow-lg hover:shadow-red-500/50 hover:scale-105 overflow-hidden border border-red-400/30 dark:border-red-600/30 cursor-pointer hover:bg-red-600/90"
                                >
                                    <span className="relative flex items-center gap-2">
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                                        </svg>
                                        <span className="hidden sm:inline">Logout</span>
                                    </span>
                                </button>
                            </>
                        ) : (
                            <>
                                <Link
                                    href="/login"
                                    className="px-5 py-2 text-gray-700 dark:text-gray-300 bg-white/50 dark:bg-gray-800/50 backdrop-blur-xl rounded-xl font-medium text-sm no-underline transition-all duration-300 hover:bg-white/70 dark:hover:bg-gray-800/70 border border-white/30 dark:border-gray-700/30"
                                >
                                    Login
                                </Link>
                                <Link
                                    href="/register"
                                    className="px-5 py-2 bg-gradient-to-r from-teal-500/90 to-blue-600/90 backdrop-blur-xl text-white rounded-xl font-medium text-sm no-underline transition-all duration-300 hover:shadow-lg hover:shadow-teal-500/50 hover:scale-105 border border-teal-400/30 hover:from-teal-500 hover:to-blue-600"
                                >
                                    Get Started
                                </Link>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </nav>
    );
};

export default Navbar;
