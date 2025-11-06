"use client";
import { useState, useContext } from 'react';
import AuthContext from '../../context/AuthContext.jsx';
import API_BASE_URL from '../../config/api.js';
import { usePathname, useRouter } from 'next/navigation';
import Image from 'next/image';
import loginImage from '../../images/login.png'
import { useTranslation } from '../../app/i18n/client.js';


const Login = () => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const { login } = useContext(AuthContext);
    const router = useRouter();
    const pathname = usePathname()
    const lng = pathname.split("/")[1]

    const { t } = useTranslation(lng, "login");

    // Language switching function
    const changeLanguage = (newLang) => {
        router.push(`/${newLang}/login`);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || 'Login failed');
            }

            const { token, user: userData } = await response.json();
            login(userData, token);
            router.push(`/${lng}/dashboard`);
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
                {/* Left side - Login Form */}
                <div className="w-full md:w-1/2 p-8 md:p-12">
                    <div className="max-w-md mx-auto">
                        <div className="text-center mb-8">
                            <h2 className="text-3xl font-bold text-gray-900">{t("Welcome back")}</h2>
                            <p className="mt-2 text-gray-600"> {t('Sign in to your account')}</p>
                        </div>

                        {error && (
                            <div className="mb-6 p-3 bg-red-50 border border-red-200 rounded-lg">
                                <p className="text-red-600 text-sm text-center">{error}</p>
                            </div>
                        )}

                        <form onSubmit={handleSubmit} className="space-y-6">
                            <div>
                                <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-2">
                                    {t('Username')}
                                </label>
                                <input
                                    id="username"
                                    type="text"
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    required
                                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition duration-200"
                                    placeholder="Enter your username"
                                />
                            </div>

                            <div>
                                <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                                    {t('Password')}
                                </label>
                                <input
                                    id="password"
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition duration-200"
                                    placeholder="Enter your password"
                                />
                            </div>

                            <button
                                type="submit"
                                className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition duration-200 font-medium"
                            >
                                {t('Sign in')}
                            </button>

                            <div className="text-center pt-4">
                                <p className="text-gray-600">
                                    {t("Don't have an account?")}  {' '}
                                    <a
                                        href={`/${lng}/register`}
                                        className="text-blue-600 hover:text-blue-700 font-medium transition duration-200"
                                    >
                                        {t('Create account')}
                                    </a>
                                </p>
                            </div>
                        </form>
                    </div>
                </div>

                {/* Right side - Image */}
                <div className="hidden md:block md:w-1/2 bg-gray-100 relative">
                    <Image
                        src={loginImage}
                        alt="Login visual"
                        fill
                        className="object-cover"
                        priority
                    />
                </div>
            </div>
        </div>
    );
};

export default Login;
