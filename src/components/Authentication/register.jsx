"use client";
import { useState } from 'react';
import API_BASE_URL from '../../config/api.js';
import { usePathname, useRouter } from 'next/navigation';
import Image from 'next/image';
import registerImage from '../../images/registration.png'
import { useTranslation } from '../../app/i18n/client.js';

export default function Register() {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState('');
    const router = useRouter();
    const pathname = usePathname();
    const lng = pathname.split("/")[1];

    const { t } = useTranslation(lng, "register");

    // Language switching function
    const changeLanguage = (newLang) => {
        router.push(`/${newLang}/register`);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (password !== confirmPassword) {
            setError(t("Passwords don't match"));
            return;
        }

        try {
            const response = await fetch(`${API_BASE_URL}/api/auth/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || t('Registration failed'));
            }

            await response.json();
            alert(t('Registration successful! Please login with your new account.'));
            router.push(`/${lng}/login`);
        } catch (err) {
            setError(err.message);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8 text-black relative">
            {/* Language Switcher - Top Right */}
            <div className="absolute top-4 right-4 z-10">
                <div className="flex gap-2 bg-white rounded-lg shadow-md p-1">
                    <button
                        onClick={() => changeLanguage('en')}
                        className={`px-4 py-2 rounded-md font-medium transition-all ${lng === 'en'
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                            }`}
                    >
                        English
                    </button>
                    <button
                        onClick={() => changeLanguage('ja')}
                        className={`px-4 py-2 rounded-md font-medium transition-all ${lng === 'ja'
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                            }`}
                    >
                        日本語
                    </button>
                </div>
            </div>

            <div className="max-w-6xl w-full flex bg-white rounded-2xl shadow-xl overflow-hidden">
                {/* Left side - Registration Form */}
                <div className="w-full md:w-1/2 p-8 md:p-12">
                    <div className="max-w-md mx-auto">
                        <div className="text-center mb-8">
                            <h2 className="text-3xl font-bold text-gray-900">{t("Create Account")}</h2>
                            <p className="mt-2 text-gray-600">{t("Join us today")}</p>
                        </div>

                        {error && (
                            <div className="mb-6 p-3 bg-red-50 border border-red-200 rounded-lg">
                                <p className="text-red-600 text-sm text-center">{error}</p>
                            </div>
                        )}

                        <form onSubmit={handleSubmit} className="space-y-6">
                            <div>
                                <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-2">
                                    {t("Username")}
                                </label>
                                <input
                                    id="username"
                                    type="text"
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    required
                                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition duration-200"
                                    placeholder={t("Enter your username")}
                                />
                            </div>

                            <div>
                                <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                                    {t("Password")}
                                </label>
                                <input
                                    id="password"
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition duration-200"
                                    placeholder={t("Create a password")}
                                />
                            </div>

                            <div>
                                <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-2">
                                    {t("Confirm Password")}
                                </label>
                                <input
                                    id="confirmPassword"
                                    type="password"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    required
                                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition duration-200"
                                    placeholder={t("Re-enter your password")}
                                />
                            </div>

                            <button
                                type="submit"
                                className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition duration-200 font-medium"
                            >
                                {t("Create Account")}
                            </button>

                            <div className="text-center pt-4">
                                <p className="text-gray-600">
                                    {t("Already have an account?")}{' '}
                                    <a
                                        href={`/${lng}/login`}
                                        className="text-blue-600 hover:text-blue-700 font-medium transition duration-200"
                                    >
                                        {t("Sign in")}
                                    </a>
                                </p>
                            </div>
                        </form>
                    </div>
                </div>

                {/* Right side - Image */}
                <div className="hidden md:block md:w-1/2 bg-gray-100 relative">
                    <Image
                        src={registerImage}
                        alt="Registration visual"
                        fill
                        className="object-cover"
                        priority
                    />
                </div>
            </div>
        </div>
    );
};
