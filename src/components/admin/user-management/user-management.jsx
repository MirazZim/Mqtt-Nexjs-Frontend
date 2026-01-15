"use client";
import { useState, useEffect, useContext } from 'react';
import AuthContext from '../../../context/AuthContext';
import API_BASE_URL from '../../../config/api.js';
import { usePathname } from 'next/navigation';
import { useTranslation } from '../../../app/i18n/client.js';

const UserManagement = () => {
    const { user } = useContext(AuthContext);

    // i18n setup
    const pathname = usePathname();
    const lng = pathname.split("/")[1];
    const { t } = useTranslation(lng, "users");

    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [newUser, setNewUser] = useState({
        username: '',
        password: '',
        role: 'user',
        desired_temperature: 22.0
    });
    const [editingUser, setEditingUser] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterRole, setFilterRole] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [usersPerPage, setUsersPerPage] = useState(10);
    const [toast, setToast] = useState({ show: false, type: '', message: '' });
    const [deleteConfirm, setDeleteConfirm] = useState({ show: false, userId: null, username: '' });

    const showToast = (type, message) => {
        setToast({ show: true, type, message });
        setTimeout(() => {
            setToast({ show: false, type: '', message: '' });
        }, 5000);
    };

    useEffect(() => {
        fetchUsers();
    }, [user.token]);

    const fetchUsers = async () => {
        try {
            const response = await fetch(`${API_BASE_URL}/api/admin/users`, {
                headers: { 'Authorization': `Bearer ${user.token}` }
            });
            const data = await response.json();
            if (data.status === 'success') {
                setUsers(data.users);
            }
            setLoading(false);
        } catch (error) {
            console.error('Error fetching users:', error);
            showToast('error', t('Failed to load users'));
            setLoading(false);
        }
    };

    const handleCreateUser = async (e) => {
        e.preventDefault();

        if (!newUser.username || !newUser.password) {
            showToast('error', t('Username and password are required'));
            return;
        }

        try {
            const response = await fetch(`${API_BASE_URL}/api/admin/users`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${user.token}`
                },
                body: JSON.stringify(newUser)
            });

            const data = await response.json();

            if (response.ok) {
                showToast('success', t('User created successfully'));
                setNewUser({
                    username: '',
                    password: '',
                    role: 'user',
                    desired_temperature: 22.0
                });
                fetchUsers();
            } else {
                showToast('error', data.message || t('Failed to create user'));
            }
        } catch (error) {
            console.error('Error creating user:', error);
            showToast('error', t('Network error: Could not create user'));
        }
    };

    const handleDeleteUser = async (userId) => {
        try {
            const response = await fetch(`${API_BASE_URL}/api/admin/users/${userId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${user.token}` }
            });

            const data = await response.json();

            if (response.ok) {
                showToast('success', t('User deleted successfully'));
                fetchUsers();
                setDeleteConfirm({ show: false, userId: null, username: '' });
            } else {
                showToast('error', data.message || t('Failed to delete user'));
            }
        } catch (error) {
            console.error('Error deleting user:', error);
            showToast('error', t('Network error: Could not delete user'));
        }
    };

    const handleUpdateUser = async (e) => {
        e.preventDefault();

        try {
            const response = await fetch(`${API_BASE_URL}/api/admin/users/${editingUser.id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${user.token}`
                },
                body: JSON.stringify({
                    role: editingUser.role,
                    desired_temperature: editingUser.desired_temperature,
                    is_active: editingUser.is_active
                })
            });

            const data = await response.json();

            if (response.ok) {
                showToast('success', t('User updated successfully'));
                setEditingUser(null);
                fetchUsers();
            } else {
                showToast('error', data.message || t('Failed to update user'));
            }
        } catch (error) {
            console.error('Error updating user:', error);
            showToast('error', t('Network error: Could not update user'));
        }
    };

    const filteredUsers = users.filter(u => {
        const matchesSearch = u.username.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesRole = !filterRole || u.role === filterRole;
        return matchesSearch && matchesRole;
    });

    const indexOfLastUser = currentPage * usersPerPage;
    const indexOfFirstUser = indexOfLastUser - usersPerPage;
    const currentUsers = filteredUsers.slice(indexOfFirstUser, indexOfLastUser);
    const totalPages = Math.ceil(filteredUsers.length / usersPerPage);

    const getPageNumbers = () => {
        const pages = [];
        const maxVisible = 5;

        if (totalPages <= maxVisible) {
            for (let i = 1; i <= totalPages; i++) {
                pages.push(i);
            }
        } else {
            if (currentPage <= 3) {
                pages.push(1, 2, 3, 4, '...', totalPages);
            } else if (currentPage >= totalPages - 2) {
                pages.push(1, '...', totalPages - 3, totalPages - 2, totalPages - 1, totalPages);
            } else {
                pages.push(1, '...', currentPage - 1, currentPage, currentPage + 1, '...', totalPages);
            }
        }

        return pages;
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="text-center">
                    <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mb-4"></div>
                    <p className="text-gray-600">{t('Loading users...')}</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6 p-6">
            {/* Toast Notification */}
            {toast.show && (
                <div className={`fixed top-4 right-4 z-50 max-w-md animate-in slide-in-from-top-5 ${toast.type === 'success' ? 'bg-green-50 border-green-500' :
                        toast.type === 'error' ? 'bg-red-50 border-red-500' :
                            'bg-blue-50 border-blue-500'
                    } border-l-4 p-4 rounded-lg shadow-xl`}>
                    <div className="flex items-start gap-3">
                        <div className={`text-2xl ${toast.type === 'success' ? 'text-green-600' :
                                toast.type === 'error' ? 'text-red-600' :
                                    'text-blue-600'
                            }`}>
                            {toast.type === 'success' ? '✅' : toast.type === 'error' ? '❌' : 'ℹ️'}
                        </div>
                        <div className="flex-1">
                            <h4 className={`font-semibold mb-0.5 ${toast.type === 'success' ? 'text-green-800' :
                                    toast.type === 'error' ? 'text-red-800' :
                                        'text-blue-800'
                                }`}>
                                {toast.type === 'success' ? t('Success!') : toast.type === 'error' ? t('Error!') : t('Info')}
                            </h4>
                            <p className={`text-sm ${toast.type === 'success' ? 'text-green-700' :
                                    toast.type === 'error' ? 'text-red-700' :
                                        'text-blue-700'
                                }`}>
                                {toast.message}
                            </p>
                        </div>
                        <button
                            onClick={() => setToast({ show: false, type: '', message: '' })}
                            className="text-gray-400 hover:text-gray-600 transition-colors"
                        >
                            ✕
                        </button>
                    </div>
                </div>
            )}

            {/* Header */}
            <div className="bg-gradient-to-r from-purple-600 to-pink-600 rounded-xl shadow-lg p-6">
                <h2 className="text-2xl font-bold text-white mb-1">{t('User Management')}</h2>
                <p className="text-purple-100 text-sm">{t('Manage system users and their permissions')}</p>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md overflow-hidden">
                    <div className="bg-gradient-to-r from-blue-500 to-cyan-500 p-4">
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center text-2xl">
                                👥
                            </div>
                            <div>
                                <h3 className="text-white font-bold text-lg">{users.length}</h3>
                                <p className="text-blue-100 text-sm">{t('Total Users')}</p>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md overflow-hidden">
                    <div className="bg-gradient-to-r from-green-500 to-emerald-500 p-4">
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center text-2xl">
                                🟢
                            </div>
                            <div>
                                <h3 className="text-white font-bold text-lg">
                                    {users.filter(u => u.is_active).length}
                                </h3>
                                <p className="text-green-100 text-sm">{t('Online')}</p>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md overflow-hidden">
                    <div className="bg-gradient-to-r from-purple-500 to-pink-500 p-4">
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center text-2xl">
                                👑
                            </div>
                            <div>
                                <h3 className="text-white font-bold text-lg">
                                    {users.filter(u => u.role === 'admin').length}
                                </h3>
                                <p className="text-purple-100 text-sm">{t('Admins')}</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Create New User */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6">
                <h3 className="text-xl font-bold text-gray-800 dark:text-gray-200 mb-1">{t('Create New User')}</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">{t('Add a new user to the system')}</p>

                <form onSubmit={handleCreateUser} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            {t('Username')}
                        </label>
                        <input
                            type="text"
                            value={newUser.username}
                            onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
                            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition-all bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200"
                            placeholder={t('Enter username')}
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            {t('Password')}
                        </label>
                        <input
                            type="password"
                            value={newUser.password}
                            onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition-all bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200"
                            placeholder={t('Enter password')}
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            {t('Role')}
                        </label>
                        <select
                            value={newUser.role}
                            onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
                            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition-all bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200"
                        >
                            <option value="user">{t('User')}</option>
                            <option value="admin">{t('Admin')}</option>
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            {t('Desired Temp')}
                        </label>
                        <input
                            type="number"
                            step="0.1"
                            value={newUser.desired_temperature}
                            onChange={(e) => setNewUser({ ...newUser, desired_temperature: parseFloat(e.target.value) })}
                            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition-all bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200"
                        />
                    </div>

                    <div className="md:col-span-2 lg:col-span-4">
                        <button
                            type="submit"
                            className="w-full md:w-auto px-6 py-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-medium rounded-lg transition-all shadow-md hover:shadow-lg"
                        >
                            {t('Create User')}
                        </button>
                    </div>
                </form>
            </div>

            {/* Users List */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md overflow-hidden">
                <div className="bg-gradient-to-r from-indigo-500 to-purple-500 p-6">
                    <div className="flex items-center justify-between flex-wrap gap-4">
                        <h3 className="text-xl font-bold text-white">{t('Users List')} ({filteredUsers.length})</h3>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                placeholder={t('Search users...')}
                                value={searchTerm}
                                onChange={(e) => {
                                    setSearchTerm(e.target.value);
                                    setCurrentPage(1);
                                }}
                                className="px-4 py-2 border border-white/30 bg-white/20 text-white placeholder-white/60 rounded-lg focus:outline-none focus:ring-2 focus:ring-white/50 backdrop-blur-sm"
                            />
                            <select
                                value={filterRole}
                                onChange={(e) => {
                                    setFilterRole(e.target.value);
                                    setCurrentPage(1);
                                }}
                                className="px-4 py-2 border border-white/30 bg-white/20 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-white/50 backdrop-blur-sm"
                            >
                                <option value="" className="text-gray-800">{t('All Roles')}</option>
                                <option value="admin" className="text-gray-800">{t('Admin')}</option>
                                <option value="user" className="text-gray-800">{t('User')}</option>
                            </select>
                        </div>
                    </div>
                </div>

                <div className="p-6">
                    <div className="flex items-center justify-between mb-4">
                        <div className="text-sm text-gray-600 dark:text-gray-400">
                            {t('Showing')} <span className="font-semibold text-gray-800 dark:text-gray-200">{indexOfFirstUser + 1}</span> {t('to')}{' '}
                            <span className="font-semibold text-gray-800 dark:text-gray-200">{Math.min(indexOfLastUser, filteredUsers.length)}</span> {t('of')}{' '}
                            <span className="font-semibold text-gray-800 dark:text-gray-200">{filteredUsers.length}</span> {t('users')}
                        </div>
                        <select
                            value={usersPerPage}
                            onChange={(e) => {
                                setUsersPerPage(Number(e.target.value));
                                setCurrentPage(1);
                            }}
                            className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200"
                        >
                            <option value={5}>5 {t('per page')}</option>
                            <option value={10}>10 {t('per page')}</option>
                            <option value={20}>20 {t('per page')}</option>
                            <option value={50}>50 {t('per page')}</option>
                        </select>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                        {t('Username')}
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                        {t('Role')}
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                        {t('Status')}
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                        {t('Activity')}
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                        {t('Statistics')}
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                        {t('Created')}
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                        {t('Actions')}
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                                {currentUsers.map((u) => (
                                    <tr key={u.id} className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-bold">
                                                    {u.username[0].toUpperCase()}
                                                </div>
                                                <div>
                                                    <div className="font-medium text-gray-900 dark:text-gray-100">{u.username}</div>
                                                    <div className="text-xs text-gray-500 dark:text-gray-400">ID: {u.id}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${u.role === 'admin'
                                                    ? 'bg-purple-100 dark:bg-purple-900/50 text-purple-800 dark:text-purple-300'
                                                    : 'bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-300'
                                                }`}>
                                                {u.role === 'admin' ? t('Admin') : t('User')}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${u.is_active
                                                    ? 'bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-300'
                                                    : 'bg-red-100 dark:bg-red-900/50 text-red-800 dark:text-red-300'
                                                }`}>
                                                {u.is_active ? t('Online') : t('Offline')}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                                            {u.last_login
                                                ? new Date(u.last_login).toLocaleString()
                                                : t('Never')}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="text-sm text-gray-900 dark:text-gray-100">
                                                {u.measurement_count || 0} {t('measurements')}
                                            </div>
                                            <div className="text-xs text-gray-500 dark:text-gray-400">
                                                {t('Desired Temp')}: {u.desired_temperature}°C
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                                            {new Date(u.created_at).toLocaleDateString()}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => setEditingUser(u)}
                                                    className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-900 dark:hover:text-indigo-300 transition-colors"
                                                >
                                                    ✏️
                                                </button>
                                                <button
                                                    onClick={() => setDeleteConfirm({ show: true, userId: u.id, username: u.username })}
                                                    className="text-red-600 dark:text-red-400 hover:text-red-900 dark:hover:text-red-300 transition-colors"
                                                    disabled={u.id === user.id}
                                                >
                                                    🗑️
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {filteredUsers.length === 0 && (
                        <div className="text-center py-12">
                            <div className="text-6xl mb-4">👤</div>
                            <h4 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-2">{t('No users found')}</h4>
                            <p className="text-gray-600 dark:text-gray-400">{t('Try adjusting your search or filters')}</p>
                        </div>
                    )}

                    {totalPages > 1 && (
                        <div className="flex items-center justify-center gap-2 mt-6">
                            <button
                                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                                disabled={currentPage === 1}
                                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                {t('Previous')}
                            </button>

                            <div className="flex items-center gap-1">
                                {getPageNumbers().map((page, index) => (
                                    page === '...' ? (
                                        <span key={`ellipsis-${index}`} className="px-3 py-2 text-gray-400">
                                            ...
                                        </span>
                                    ) : (
                                        <button
                                            key={page}
                                            onClick={() => setCurrentPage(page)}
                                            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${currentPage === page
                                                    ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-md'
                                                    : 'text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600'
                                                }`}
                                        >
                                            {page}
                                        </button>
                                    )
                                ))}
                            </div>

                            <button
                                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                                disabled={currentPage === totalPages}
                                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                {t('Next')}
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Edit User Modal */}
            {editingUser && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="bg-gradient-to-r from-indigo-500 to-purple-500 p-6">
                            <h3 className="text-xl font-bold text-white">{t('Edit User')}: {editingUser.username}</h3>
                        </div>

                        <form onSubmit={handleUpdateUser} className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                    {t('Role')}
                                </label>
                                <select
                                    value={editingUser.role}
                                    onChange={(e) => setEditingUser({ ...editingUser, role: e.target.value })}
                                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200"
                                >
                                    <option value="user">{t('User')}</option>
                                    <option value="admin">{t('Admin')}</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                    {t('Desired Temp')}
                                </label>
                                <input
                                    type="number"
                                    step="0.1"
                                    value={editingUser.desired_temperature}
                                    onChange={(e) => setEditingUser({ ...editingUser, desired_temperature: parseFloat(e.target.value) })}
                                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200"
                                />
                            </div>

                            <div className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    id="is_active"
                                    checked={editingUser.is_active}
                                    onChange={(e) => setEditingUser({ ...editingUser, is_active: e.target.checked })}
                                    className="w-4 h-4 text-purple-600 border-gray-300 dark:border-gray-600 rounded focus:ring-purple-500"
                                />
                                <label htmlFor="is_active" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                    {t('Active User')}
                                </label>
                            </div>

                            <div className="flex gap-3 pt-4">
                                <button
                                    type="button"
                                    onClick={() => setEditingUser(null)}
                                    className="flex-1 px-4 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg font-medium transition-colors"
                                >
                                    {t('Cancel')}
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white rounded-lg font-medium transition-all shadow-md"
                                >
                                    {t('Save Changes')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Delete Confirmation Modal */}
            {deleteConfirm.show && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="bg-gradient-to-r from-red-500 to-pink-500 p-6">
                            <h3 className="text-xl font-bold text-white">{t('Confirm Deletion')}</h3>
                        </div>

                        <div className="p-6">
                            <div className="text-center mb-6">
                                <div className="w-16 h-16 bg-red-100 dark:bg-red-900/50 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <span className="text-3xl">⚠️</span>
                                </div>
                                <h4 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
                                    {t('Delete user')} "{deleteConfirm.username}"?
                                </h4>
                                <p className="text-gray-600 dark:text-gray-400 text-sm">
                                    {t('This action cannot be undone')}
                                </p>
                            </div>

                            <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-6">
                                <p className="text-sm text-red-800 dark:text-red-300">
                                    <strong>{t('Warning')}:</strong> {t('This will permanently remove the user')}
                                </p>
                            </div>

                            <div className="flex gap-3">
                                <button
                                    onClick={() => setDeleteConfirm({ show: false, userId: null, username: '' })}
                                    className="flex-1 px-4 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg font-medium transition-colors"
                                >
                                    {t('Cancel')}
                                </button>
                                <button
                                    onClick={() => handleDeleteUser(deleteConfirm.userId)}
                                    className="flex-1 px-4 py-2 bg-gradient-to-r from-red-600 to-pink-600 hover:from-red-700 hover:to-pink-700 text-white rounded-lg font-medium transition-all shadow-md"
                                >
                                    {t('Delete User')}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default UserManagement;
