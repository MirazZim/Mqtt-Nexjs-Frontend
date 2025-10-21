'use client'

import React, { useContext } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import AuthContext from '../../context/AuthContext.jsx';
//import NotificationBell from '../NotificationBell';

const Navbar = () => {
    const { user, logout, isAdmin } = useContext(AuthContext);
    const router = useRouter();

    const handleLogout = () => {
        logout();
        router.push('/login');
    };

    return (
        <nav className="bg-gray-500 p-0 shadow-md sticky top-0 z-[1000]">
            <div className="max-w-[1200px] mx-auto flex justify-between items-center px-5 h-[60px]">
                {/* Brand */}
                <Link
                    href="/dashboard"
                    className="text-white text-xl font-bold no-underline transition-colors duration-200 hover:text-blue-400"
                >
                    IoT Dashboard
                </Link>

                {/* Menu */}
                <div className="flex items-center gap-5">
                    {user ? (
                        <>
                            {/* Welcome Text */}
                            <span className="text-gray-300 text-sm hidden md:block">
                                Welcome, {user.username}
                            </span>

                            {/* Notification Bell - uncomment when ready */}
                            {/* <NotificationBell /> */}

                            {/* Admin Link */}
                            {isAdmin() && (
                                <Link
                                    href="/admin"
                                    className="text-gray-300 no-underline px-4 py-2 rounded transition-all duration-200 hover:text-white hover:bg-gray-700"
                                >
                                    Admin Dashboard
                                </Link>
                            )}

                            {/* Logout Button */}
                            <button
                                onClick={handleLogout}
                                className="bg-red-500 text-white border-none px-4 py-2 rounded cursor-pointer text-sm transition-colors duration-200 hover:bg-red-600"
                            >
                                Logout
                            </button>
                        </>
                    ) : (
                        <>
                            <Link
                                href="/login"
                                className="text-gray-300 no-underline px-4 py-2 rounded transition-all duration-200 hover:text-white hover:bg-gray-700"
                            >
                                Login
                            </Link>
                            <Link
                                href="/register"
                                className="text-gray-300 no-underline px-4 py-2 rounded transition-all duration-200 hover:text-white hover:bg-gray-700"
                            >
                                Register
                            </Link>
                        </>
                    )}
                </div>
            </div>
        </nav>
    );
};

export default Navbar;
