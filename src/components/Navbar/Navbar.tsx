'use client'

import React, { useContext, useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import AuthContext from '../../context/AuthContext.jsx';
import NotificationBell from '../Navbar/NotificationBell.jsx';
import { useTranslation } from '../../app/i18n/client.js';

const Navbar = () => {
    const { user, logout, isAdmin } = useContext(AuthContext);
    const router = useRouter();
    const pathname = usePathname();
    const lng = pathname.split("/")[1];
    const { t } = useTranslation(lng, "navbar");
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    const handleLogout = () => {
        logout();
        setIsMobileMenuOpen(false);
        router.push(`/${lng}/login`);
    };

    // Language switching function - Same as Dashboard
    const changeLanguage = (newLang) => {
        const currentPath = pathname.split('/').slice(2).join('/');
        setIsMobileMenuOpen(false);
        router.push(`/${newLang}/${currentPath}`);
    };

    // Close menu when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (isMobileMenuOpen && !event.target.closest('.mobile-menu-drawer') && !event.target.closest('.hamburger-btn')) {
                setIsMobileMenuOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isMobileMenuOpen]);

    // Prevent body scroll when menu is open
    useEffect(() => {
        if (isMobileMenuOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'unset';
        }
        return () => {
            document.body.style.overflow = 'unset';
        };
    }, [isMobileMenuOpen]);

    return (
        <>
            <nav className="bg-white/70 dark:bg-gray-900/70 backdrop-blur-2xl border-b border-white/20 dark:border-gray-700/20 sticky top-0 z-50 shadow-xl shadow-gray-900/5">
                <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8">
                    <div className="flex justify-between items-center h-14 sm:h-14 lg:h-16">
                        {/* Brand with Icon - Responsive */}
                        <Link
                            href={`/${lng}/dashboard`}
                            className="flex items-center gap-2 lg:gap-3 group no-underline"
                        >
                            <div className="relative">
                                <div className="absolute inset-0 bg-linear-to-r from-teal-500 to-blue-500 rounded-lg lg:rounded-xl blur-lg opacity-50 group-hover:opacity-75 transition-opacity duration-300"></div>
                                <div className="relative w-8 h-8 lg:w-10 lg:h-10 bg-linear-to-br from-teal-500 to-blue-600 rounded-lg lg:rounded-xl flex items-center justify-center shadow-lg backdrop-blur-sm">
                                    <svg className="w-5 h-5 lg:w-6 lg:h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                    </svg>
                                </div>
                            </div>
                            <span className="text-base sm:text-lg lg:text-xl font-bold bg-linear-to-r from-gray-900 to-gray-600 dark:from-white dark:to-gray-300 bg-clip-text text-transparent group-hover:from-teal-600 group-hover:to-blue-600 transition-all duration-300">
                                {t('IoT Dashboard')}
                            </span>
                        </Link>

                        {/* Desktop Menu - Hidden on Mobile/Tablet */}
                        <div className="hidden lg:flex items-center gap-3">
                            {user ? (
                                <>
                                    {/* Welcome Text with Avatar */}
                                    <div className="flex items-center gap-3 px-4 py-2 bg-white/50 dark:bg-gray-800/50 backdrop-blur-xl rounded-xl border border-white/30 dark:border-gray-700/30 shadow-lg">
                                        <div className="w-8 h-8 rounded-full bg-linear-to-br from-teal-500 to-blue-600 flex items-center justify-center text-white text-sm font-bold shadow-md">
                                            {user.username.charAt(0).toUpperCase()}
                                        </div>
                                        <div>
                                            <p className="text-xs text-gray-600 dark:text-gray-400 leading-none">{t('Welcome back,')}</p>
                                            <p className="text-sm font-semibold text-gray-900 dark:text-white leading-none mt-0.5">
                                                {user.username}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Admin Link */}
                                    {isAdmin() && (
                                        <Link
                                            href={`/${lng}/admin`}
                                            className="flex items-center gap-2 px-4 py-2 bg-purple-500/20 dark:bg-purple-500/20 backdrop-blur-xl text-purple-700 dark:text-purple-300 rounded-xl font-medium text-sm no-underline transition-all duration-300 hover:shadow-lg hover:scale-105 border border-purple-300/30 dark:border-purple-500/30 hover:bg-purple-500/30"
                                        >
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                            </svg>
                                            {t('Admin')}
                                        </Link>
                                    )}

                                    {/* Notification Bell */}
                                    <NotificationBell />

                                    {/* Logout Button */}
                                    <button
                                        onClick={handleLogout}
                                        className="group relative px-5 py-2 bg-red-500/80 dark:bg-red-500/80 backdrop-blur-xl text-white rounded-xl font-medium text-sm transition-all duration-300 hover:shadow-lg hover:shadow-red-500/50 hover:scale-105 overflow-hidden border border-red-400/30 dark:border-red-600/30 cursor-pointer hover:bg-red-600/90"
                                    >
                                        <span className="relative flex items-center gap-2">
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                                            </svg>
                                            {t('Logout')}
                                        </span>
                                    </button>
                                </>
                            ) : (
                                <>
                                    <Link
                                        href={`/${lng}/login`}
                                        className="px-5 py-2 text-gray-700 dark:text-gray-300 bg-white/50 dark:bg-gray-800/50 backdrop-blur-xl rounded-xl font-medium text-sm no-underline transition-all duration-300 hover:bg-white/70 dark:hover:bg-gray-800/70 border border-white/30 dark:border-gray-700/30"
                                    >
                                        {t('Login')}
                                    </Link>
                                    <Link
                                        href={`/${lng}/register`}
                                        className="px-5 py-2 bg-linear-to-r from-teal-500/90 to-blue-600/90 backdrop-blur-xl text-white rounded-xl font-medium text-sm no-underline transition-all duration-300 hover:shadow-lg hover:shadow-teal-500/50 hover:scale-105 border border-teal-400/30 hover:from-teal-500 hover:to-blue-600"
                                    >
                                        {t('Get Started')}
                                    </Link>
                                </>
                            )}
                        </div>

                        {/* Mobile/Tablet - Notification Bell + Hamburger */}
                        <div className="flex lg:hidden items-center gap-2">
                            {user && <NotificationBell />}

                            {/* Hamburger Button */}
                            <button
                                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                                className="hamburger-btn relative w-10 h-10 flex items-center justify-center text-gray-700 dark:text-gray-300 hover:text-teal-600 dark:hover:text-teal-400 transition-colors cursor-pointer"
                                aria-label="Toggle menu"
                            >
                                {isMobileMenuOpen ? (
                                    <svg className="w-6 h-6 transition-transform duration-300 rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                ) : (
                                    <svg className="w-6 h-6 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 6h16M4 12h16M4 18h16" />
                                    </svg>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            </nav>

            {/* Mobile Menu Overlay - Fixed z-index */}
            <div
                className={`fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity duration-300 lg:hidden ${isMobileMenuOpen ? 'opacity-100 visible z-9998' : 'opacity-0 invisible z-[-1]'
                    }`}
                onClick={() => setIsMobileMenuOpen(false)}
            />

            {/* Mobile Menu Drawer - Slides from Right with Fixed z-index */}
            <div className={`mobile-menu-drawer fixed top-0 right-0 h-full w-80 sm:w-96 bg-white dark:bg-gray-900 shadow-2xl transform transition-transform duration-300 ease-out lg:hidden ${isMobileMenuOpen ? 'translate-x-0 z-9999' : 'translate-x-full z-[-1]'
                }`}>
                <div className="flex flex-col h-full">
                    {/* Menu Header */}
                    <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700 bg-linear-to-r from-teal-50 to-blue-50 dark:from-teal-900/20 dark:to-blue-900/20">
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white">{t('Menu')}</h3>
                        <button
                            onClick={() => setIsMobileMenuOpen(false)}
                            className="w-8 h-8 flex items-center justify-center text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-white/50 dark:hover:bg-gray-800/50 rounded-lg transition-colors"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>

                    {/* Menu Content - Scrollable */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-4">
                        {user ? (
                            <>
                                {/* User Profile Card */}
                                <div className="flex items-center gap-3 p-4 bg-linear-to-r from-teal-50 to-blue-50 dark:from-teal-900/20 dark:to-blue-900/20 rounded-xl border border-teal-100 dark:border-teal-800 shadow-sm">
                                    <div className="w-14 h-14 rounded-full bg-linear-to-br from-teal-500 to-blue-600 flex items-center justify-center text-white text-xl font-bold shadow-md">
                                        {user.username.charAt(0).toUpperCase()}
                                    </div>
                                    <div>
                                        <p className="text-xs text-gray-600 dark:text-gray-400 leading-none">{t('Welcome back,')}</p>
                                        <p className="text-base font-semibold text-gray-900 dark:text-white leading-none mt-1">
                                            {user.username}
                                        </p>
                                    </div>
                                </div>

                                {/* Language Switcher - Same style as Dashboard */}
                                <div className="space-y-2">
                                    <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider px-1">
                                        {t('Language')}
                                    </p>
                                    <div className="flex items-center gap-0.5 bg-white/50 dark:bg-gray-800/50 backdrop-blur-lg rounded-2xl p-1 border border-gray-200 dark:border-gray-700 shadow-lg">
                                        <button
                                            onClick={() => changeLanguage('en')}
                                            className={`flex-1 px-4 py-3 text-sm font-bold rounded-xl transition-all duration-300 transform hover:scale-105 ${lng === 'en'
                                                ? 'bg-white text-cyan-600 shadow-lg shadow-cyan-500/40 ring-2 ring-white dark:ring-cyan-500'
                                                : 'text-gray-700 dark:text-gray-300 hover:bg-cyan-500/10'
                                                }`}
                                        >
                                            EN
                                        </button>
                                        <div className="w-px h-8 bg-linear-to-b from-transparent via-gray-300 dark:via-gray-600 to-transparent"></div>
                                        <button
                                            onClick={() => changeLanguage('ja')}
                                            className={`flex-1 px-4 py-3 text-sm font-bold rounded-xl transition-all duration-300 transform hover:scale-105 ${lng === 'ja'
                                                ? 'bg-white text-pink-600 shadow-lg shadow-pink-500/40 ring-2 ring-white dark:ring-pink-500'
                                                : 'text-gray-700 dark:text-gray-300 hover:bg-pink-500/10'
                                                }`}
                                        >
                                            日本語
                                        </button>
                                    </div>
                                </div>

                                {/* Admin Link */}
                                {isAdmin() && (
                                    <Link
                                        href={`/${lng}/admin`}
                                        onClick={() => setIsMobileMenuOpen(false)}
                                        className="flex items-center gap-3 px-4 py-3 bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 rounded-xl font-medium text-sm no-underline transition-all hover:bg-purple-100 dark:hover:bg-purple-900/30 border border-purple-200 dark:border-purple-800 shadow-sm"
                                    >
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                        </svg>
                                        <span>{t('Admin Panel')}</span>
                                    </Link>
                                )}

                                {/* Logout Button */}
                                <button
                                    onClick={handleLogout}
                                    className="w-full flex items-center justify-center gap-3 px-4 py-3.5 bg-linear-to-r from-red-500 to-red-600 text-white rounded-xl font-medium text-sm transition-all hover:shadow-lg hover:from-red-600 hover:to-red-700 shadow-md cursor-pointer"
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                                    </svg>
                                    <span>{t('Logout')}</span>
                                </button>
                            </>
                        ) : (
                            <>
                                {/* Language Switcher for Non-logged Users */}
                                <div className="space-y-2">
                                    <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider px-1">
                                        {t('Language')}
                                    </p>
                                    <div className="flex items-center gap-0.5 bg-white/50 dark:bg-gray-800/50 backdrop-blur-lg rounded-2xl p-1 border border-gray-200 dark:border-gray-700 shadow-lg">
                                        <button
                                            onClick={() => changeLanguage('en')}
                                            className={`flex-1 px-4 py-3 text-sm font-bold rounded-xl transition-all duration-300 ${lng === 'en'
                                                ? 'bg-white text-cyan-600 shadow-lg shadow-cyan-500/40 ring-2 ring-white'
                                                : 'text-gray-700 dark:text-gray-300 hover:bg-cyan-500/10'
                                                }`}
                                        >
                                            EN
                                        </button>
                                        <div className="w-px h-8 bg-linear-to-b from-transparent via-gray-300 dark:via-gray-600 to-transparent"></div>
                                        <button
                                            onClick={() => changeLanguage('ja')}
                                            className={`flex-1 px-4 py-3 text-sm font-bold rounded-xl transition-all duration-300 ${lng === 'ja'
                                                ? 'bg-white text-pink-600 shadow-lg shadow-pink-500/40 ring-2 ring-white'
                                                : 'text-gray-700 dark:text-gray-300 hover:bg-pink-500/10'
                                                }`}
                                        >
                                            日本語
                                        </button>
                                    </div>
                                </div>

                                <Link
                                    href={`/${lng}/login`}
                                    onClick={() => setIsMobileMenuOpen(false)}
                                    className="block w-full text-center px-4 py-3 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 rounded-xl font-medium text-sm no-underline transition-all hover:bg-gray-200 dark:hover:bg-gray-700 shadow-sm"
                                >
                                    {t('Login')}
                                </Link>
                                <Link
                                    href={`/${lng}/register`}
                                    onClick={() => setIsMobileMenuOpen(false)}
                                    className="block w-full text-center px-4 py-3 bg-linear-to-r from-teal-500 to-blue-600 text-white rounded-xl font-medium text-sm no-underline transition-all hover:shadow-lg shadow-md"
                                >
                                    {t('Get Started')}
                                </Link>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </>
    );
};

export default Navbar;
