"use client";
import { useState, useEffect, useContext } from 'react';
import AuthContext from '../../../context/AuthContext';
import API_BASE_URL from '../../../config/api.js';

const UserManagement = () => {
    const { user } = useContext(AuthContext);
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
            showToast('error', 'Failed to load users');
            setLoading(false);
        }
    };

    // ✅ 4. useEffect calls fetchUsers
    useEffect(() => {
        if (user?.token) {
            fetchUsers();
        }
    }, [user?.token]);

    // Calculate pagination



    const handleCreateUser = async () => {
        if (!newUser.username || !newUser.password) {
            showToast('error', 'Username and password are required');
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

            // ✅ Check response.ok first, then check data
            if (response.ok) {
                showToast('success', `User "${newUser.username}" created successfully!`);
                setNewUser({ username: '', password: '', role: 'user', desired_temperature: 22.0 });
                fetchUsers();
            } else {
                // Show error message from API or generic message
                const errorMsg = data.error || data.message || `Failed to create user (Status: ${response.status})`;
                showToast('error', errorMsg);
            }
        } catch (error) {
            console.error('Create user error:', error);
            showToast('error', 'Network error: Could not create user');
        }
    };

    const handleDeleteUser = async (userId) => {
        const userToDelete = users.find(u => u.id === userId);

        // ✅ Show custom modal instead of confirm()
        setDeleteConfirm({
            show: true,
            userId: userId,
            username: userToDelete?.username || 'this user'
        });
    };

    // ✅ New function to confirm deletion
    const confirmDelete = async () => {
        try {
            const response = await fetch(`${API_BASE_URL}/api/admin/users/${deleteConfirm.userId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${user.token}` }
            });

            const data = await response.json();

            if (response.ok) {
                showToast('success', `User "${deleteConfirm.username}" deleted successfully!`);
                setDeleteConfirm({ show: false, userId: null, username: '' });
                fetchUsers();
            } else {
                const errorMsg = data.error || data.message || 'Failed to delete user';
                showToast('error', errorMsg);
            }
        } catch (error) {
            console.error('Delete user error:', error);
            showToast('error', 'Network error: Could not delete user');
        }
    };

    const handleUpdateUser = async (userId, updates) => {
        try {
            const response = await fetch(`${API_BASE_URL}/api/admin/users/${userId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${user.token}`
                },
                body: JSON.stringify(updates)
            });

            const data = await response.json();

            if (response.ok) {
                showToast('success', `User "${updates.username}" updated successfully!`);
                setEditingUser(null);
                fetchUsers();
            } else {
                const errorMsg = data.error || data.message || `Failed to update user (Status: ${response.status})`;
                showToast('error', errorMsg);
            }
        } catch (error) {
            console.error('Update user error:', error);
            showToast('error', 'Network error: Could not update user');
        }
    };


    // Filter users based on search term and role
    const filteredUsers = users.filter(u => {
        const matchesSearch = u.username.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesRole = filterRole === '' || u.role === filterRole;
        return matchesSearch && matchesRole;
    });

    if (loading) {
        return (
            <div className="loading-container">
                <div className="loading-spinner"></div>
                <p>Loading users...</p>
            </div>
        );


    }

    const indexOfLastUser = currentPage * usersPerPage;
    const indexOfFirstUser = indexOfLastUser - usersPerPage;
    const currentUsers = filteredUsers.slice(indexOfFirstUser, indexOfLastUser);
    const totalPages = Math.ceil(filteredUsers.length / usersPerPage);

    // Smart page numbers
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
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="flex flex-col items-center gap-3">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
                    <p className="text-gray-600">Loading users...</p>
                </div>
            </div>
        );
    }


    return (


        <div className="space-y-6">
            {/* Toast Notification */}
            {/* Toast Notification - Middle Bottom */}
            {toast.show && (
                <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[60] animate-in slide-in-from-bottom duration-300">
                    <div className={`rounded-lg shadow-2xl border-2 p-4 min-w-[320px] max-w-md flex items-start gap-3 ${toast.type === 'success'
                        ? 'bg-green-50 border-green-200'
                        : toast.type === 'error'
                            ? 'bg-red-50 border-red-200'
                            : 'bg-blue-50 border-blue-200'
                        }`}>
                        {/* Icon */}
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${toast.type === 'success'
                            ? 'bg-green-500'
                            : toast.type === 'error'
                                ? 'bg-red-500'
                                : 'bg-blue-500'
                            }`}>
                            {toast.type === 'success' && (
                                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                            )}
                            {toast.type === 'error' && (
                                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            )}
                            {toast.type === 'info' && (
                                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                            )}
                        </div>

                        {/* Message */}
                        <div className="flex-1">
                            <h4 className={`font-semibold mb-0.5 ${toast.type === 'success'
                                ? 'text-green-800'
                                : toast.type === 'error'
                                    ? 'text-red-800'
                                    : 'text-blue-800'
                                }`}>
                                {toast.type === 'success' ? 'Success!' : toast.type === 'error' ? 'Error!' : 'Info'}
                            </h4>
                            <p className={`text-sm ${toast.type === 'success'
                                ? 'text-green-700'
                                : toast.type === 'error'
                                    ? 'text-red-700'
                                    : 'text-blue-700'
                                }`}>
                                {toast.message}
                            </p>
                        </div>

                        {/* Close Button */}
                        <button
                            onClick={() => setToast({ show: false, type: '', message: '' })}
                            className={`p-1 rounded-lg transition-colors flex-shrink-0 ${toast.type === 'success'
                                ? 'hover:bg-green-100'
                                : toast.type === 'error'
                                    ? 'hover:bg-red-100'
                                    : 'hover:bg-blue-100'
                                }`}
                        >
                            <svg className={`w-5 h-5 ${toast.type === 'success'
                                ? 'text-green-600'
                                : toast.type === 'error'
                                    ? 'text-red-600'
                                    : 'text-blue-600'
                                }`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                </div>
            )}

            {/* Page Header with Stats */}
            <div className="bg-gradient-to-r from-purple-600 to-blue-600 rounded-xl shadow-lg p-6">
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h2 className="text-2xl font-bold text-white mb-1">👥 User Management</h2>
                        <p className="text-purple-100 text-sm">Manage system users and their permissions</p>
                    </div>
                </div>

                {/* Stats Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 border border-white/20">
                        <div className="text-3xl font-bold text-white mb-1">{users.length}</div>
                        <div className="text-purple-100 text-sm">Total Users</div>
                    </div>
                    <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 border border-white/20">
                        <div className="text-3xl font-bold text-white mb-1">{users.filter(u => u.is_active).length}</div>
                        <div className="text-purple-100 text-sm">Online</div>
                    </div>
                    <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 border border-white/20">
                        <div className="text-3xl font-bold text-white mb-1">{users.filter(u => u.role === 'admin').length}</div>
                        <div className="text-purple-100 text-sm">Admins</div>
                    </div>
                </div>
            </div>

            {/* Create New User Section */}
            <div className="bg-white rounded-xl shadow-md p-6">
                <div className="mb-6">
                    <h3 className="text-xl font-bold text-gray-800 mb-1">➕ Create New User</h3>
                    <p className="text-sm text-gray-600">Add a new user to the system</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">👤 Username</label>
                        <input
                            type="text"
                            placeholder="Enter username"
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition-all"
                            value={newUser.username}
                            onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">🔐 Password</label>
                        <input
                            type="password"
                            placeholder="Enter password"
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition-all"
                            value={newUser.password}
                            onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">🎭 Role</label>
                        <select
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition-all bg-white"
                            value={newUser.role}
                            onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
                        >
                            <option value="user">User</option>
                            <option value="admin">Admin</option>
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">🌡️ Desired Temp (°C)</label>
                        <input
                            type="number"
                            step="0.1"
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition-all"
                            value={newUser.desired_temperature}
                            onChange={(e) => setNewUser({ ...newUser, desired_temperature: parseFloat(e.target.value) })}
                        />
                    </div>
                </div>

                <button
                    className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg font-medium hover:from-purple-700 hover:to-blue-700 transition-all shadow-md hover:shadow-lg"
                    onClick={handleCreateUser}
                >
                    <span>➕</span>
                    Create User
                </button>
            </div>

            {/* Users List Section */}
            {/* Users List Section */}
            <div className="bg-white rounded-xl shadow-md overflow-hidden">
                <div className="p-6 border-b border-gray-200">
                    <div className="flex items-center justify-between flex-wrap gap-4">
                        <div>
                            <h3 className="text-xl font-bold text-gray-800">📋 Users List ({filteredUsers.length})</h3>
                        </div>

                        <div className="flex gap-3">
                            {/* Search Box */}
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
                                <input
                                    type="text"
                                    placeholder="Search users..."
                                    className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition-all w-64"
                                    value={searchTerm}
                                    onChange={(e) => {
                                        setSearchTerm(e.target.value);
                                        setCurrentPage(1); // Reset to first page on search
                                    }}
                                />
                            </div>

                            {/* Filter Select */}
                            <select
                                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition-all bg-white"
                                value={filterRole}
                                onChange={(e) => {
                                    setFilterRole(e.target.value);
                                    setCurrentPage(1); // Reset to first page on filter
                                }}
                            >
                                <option value="">All Roles</option>
                                <option value="admin">Admin</option>
                                <option value="user">User</option>
                            </select>
                        </div>
                    </div>
                </div>

                {/* Results Info + Items Per Page */}
                {filteredUsers.length > 0 && (
                    <div className="px-6 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
                        <div className="text-sm text-gray-600">
                            Showing <span className="font-semibold text-gray-800">{indexOfFirstUser + 1}</span> to{' '}
                            <span className="font-semibold text-gray-800">{Math.min(indexOfLastUser, filteredUsers.length)}</span> of{' '}
                            <span className="font-semibold text-gray-800">{filteredUsers.length}</span> users
                        </div>
                        <select
                            value={usersPerPage}
                            onChange={(e) => {
                                setUsersPerPage(Number(e.target.value));
                                setCurrentPage(1);
                            }}
                            className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
                        >
                            <option value={5}>5 per page</option>
                            <option value={10}>10 per page</option>
                            <option value={20}>20 per page</option>
                            <option value={50}>50 per page</option>
                        </select>
                    </div>
                )}

                {/* Table */}
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-gray-50 border-b border-gray-200">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">User</th>
                                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Role</th>
                                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Status</th>
                                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Activity</th>
                                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Statistics</th>
                                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Created</th>
                                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                            {currentUsers.length > 0 ? (
                                currentUsers.map(u => (
                                    <tr key={u.id} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-blue-500 rounded-full flex items-center justify-center text-white font-bold">
                                                    {u.username.charAt(0).toUpperCase()}
                                                </div>
                                                <div>
                                                    <div className="font-medium text-gray-900">{u.username}</div>
                                                    <div className="text-xs text-gray-500">ID: {u.id}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${u.role === 'admin'
                                                ? 'bg-purple-100 text-purple-700 border border-purple-200'
                                                : 'bg-blue-100 text-blue-700 border border-blue-200'
                                                }`}>
                                                {u.role === 'admin' ? '👑' : '👤'} {u.role}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium ${u.is_active
                                                ? 'bg-green-100 text-green-700 border border-green-200'
                                                : 'bg-gray-100 text-gray-700 border border-gray-200'
                                                }`}>
                                                <span className={`w-2 h-2 rounded-full ${u.is_active ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`}></span>
                                                {u.is_active ? 'Online' : 'Offline'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="text-sm text-gray-600">
                                                {u.last_activity ? new Date(u.last_activity).toLocaleDateString() : 'Never'}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-1.5 text-sm text-gray-600">
                                                <span>📊</span>
                                                <span>{u.measurement_count || 0} measurements</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-sm text-gray-600">
                                            {new Date(u.created_at).toLocaleDateString()}
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2">
                                                <button
                                                    onClick={() => setEditingUser({ ...u })}
                                                    className="p-2 hover:bg-blue-50 rounded-lg transition-colors"
                                                    title="Edit User"
                                                >
                                                    ✏️
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteUser(u.id)}
                                                    disabled={u.id === user.id}
                                                    className="p-2 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                                    title="Delete User"
                                                >
                                                    🗑️
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan="7" className="px-6 py-12 text-center">
                                        <div className="flex flex-col items-center justify-center text-gray-500">
                                            <svg className="w-12 h-12 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                                            </svg>
                                            <p className="text-lg font-medium">No users found</p>
                                            <p className="text-sm">Try adjusting your search or filters</p>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination Controls */}
                {totalPages > 1 && (
                    <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-center gap-2">
                        {/* Previous Button */}
                        <button
                            onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                            disabled={currentPage === 1}
                            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            ← Previous
                        </button>

                        {/* Page Numbers */}
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
                                            ? 'bg-gradient-to-r from-purple-500 to-blue-500 text-white shadow-md'
                                            : 'text-gray-700 bg-white border border-gray-300 hover:bg-gray-50'
                                            }`}
                                    >
                                        {page}
                                    </button>
                                )
                            ))}
                        </div>

                        {/* Next Button */}
                        <button
                            onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                            disabled={currentPage === totalPages}
                            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            Next →
                        </button>
                    </div>
                )}
            </div>


            {/* Edit User Modal */}
            {editingUser && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                        {/* Modal Header */}
                        <div className="bg-gradient-to-r from-purple-600 to-blue-600 px-6 py-4 flex items-center justify-between">
                            <h3 className="text-xl font-bold text-white">✏️ Edit User: {editingUser.username}</h3>
                            <button
                                onClick={() => setEditingUser(null)}
                                className="text-white hover:bg-white/20 rounded-lg p-2 transition-colors"
                            >
                                ✖️
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">👤 Username</label>
                                <input
                                    type="text"
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition-all"
                                    value={editingUser.username}
                                    onChange={(e) => setEditingUser({ ...editingUser, username: e.target.value })}
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">🎭 Role</label>
                                <select
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition-all bg-white"
                                    value={editingUser.role}
                                    onChange={(e) => setEditingUser({ ...editingUser, role: e.target.value })}
                                >
                                    <option value="user">User</option>
                                    <option value="admin">Admin</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">🌡️ Desired Temperature (°C)</label>
                                <input
                                    type="number"
                                    step="0.1"
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition-all"
                                    value={editingUser.desired_temperature}
                                    onChange={(e) => setEditingUser({ ...editingUser, desired_temperature: parseFloat(e.target.value) })}
                                />
                            </div>

                            <div>
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        className="w-4 h-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                                        checked={editingUser.is_active}
                                        onChange={(e) => setEditingUser({ ...editingUser, is_active: e.target.checked })}
                                    />
                                    <span className="text-sm font-medium text-gray-700">🟢 Active User</span>
                                </label>
                            </div>
                        </div>

                        {/* Modal Actions */}
                        <div className="px-6 py-4 bg-gray-50 flex gap-3 justify-end">
                            <button
                                onClick={() => setEditingUser(null)}
                                className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg font-medium hover:bg-gray-50 transition-colors"
                            >
                                ❌ Cancel
                            </button>
                            <button
                                onClick={() => handleUpdateUser(editingUser.id, editingUser)}
                                className="px-4 py-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg font-medium hover:from-purple-700 hover:to-blue-700 transition-all shadow-md hover:shadow-lg"
                            >
                                💾 Save Changes
                            </button>
                        </div>
                    </div>
                </div>
            )}


            {/* ✅ ADD DELETE CONFIRMATION MODAL HERE */}
            {deleteConfirm.show && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                        {/* Modal Header */}
                        <div className="bg-gradient-to-r from-red-600 to-red-500 px-6 py-4 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                    </svg>
                                </div>
                                <h3 className="text-xl font-bold text-white">Confirm Deletion</h3>
                            </div>
                            <button
                                onClick={() => setDeleteConfirm({ show: false, userId: null, username: '' })}
                                className="text-white hover:bg-white/20 rounded-lg p-2 transition-colors"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className="p-6">
                            <div className="flex items-start gap-4 mb-6">
                                <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
                                    <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                    </svg>
                                </div>
                                <div>
                                    <h4 className="text-lg font-semibold text-gray-900 mb-2">
                                        Delete user "{deleteConfirm.username}"?
                                    </h4>
                                    <p className="text-gray-600 text-sm">
                                        This action cannot be undone. All data associated with this user will be permanently deleted.
                                    </p>
                                </div>
                            </div>

                            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                                <div className="flex items-start gap-2">
                                    <svg className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                    </svg>
                                    <p className="text-sm text-red-800">
                                        <strong>Warning:</strong> This will permanently remove the user from the system.
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Modal Actions */}
                        <div className="px-6 py-4 bg-gray-50 flex gap-3 justify-end">
                            <button
                                onClick={() => setDeleteConfirm({ show: false, userId: null, username: '' })}
                                className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg font-medium hover:bg-gray-50 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={confirmDelete}
                                className="px-4 py-2 bg-gradient-to-r from-red-600 to-red-500 text-white rounded-lg font-medium hover:from-red-700 hover:to-red-600 transition-all shadow-md hover:shadow-lg flex items-center gap-2"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                                Delete User
                            </button>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
};

export default UserManagement;
