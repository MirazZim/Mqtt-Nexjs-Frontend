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


    useEffect(() => {
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
                setLoading(false);
            }
        };

        fetchUsers();
    }, [user.token]);

    // Calculate pagination



    const handleCreateUser = async () => {
        if (!newUser.username || !newUser.password) {
            alert('Username and password are required');
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
            if (data.status === 'success') {
                alert('User created successfully');
                setNewUser({ username: '', password: '', role: 'user', desired_temperature: 22.0 });
                setUsers([]);
            } else {
                alert(data.message || 'Error creating user');
            }
        } catch (error) {
            alert('Error creating user: ' + error.message);
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
            if (data.status === 'success') {
                alert('User updated successfully');
                setEditingUser(null);
                setUsers([]);
            } else {
                alert(data.message || 'Error updating user');
            }
        } catch (error) {
            alert('Error updating user: ' + error.message);
        }
    };

    const handleDeleteUser = async (userId) => {
        if (!confirm('Are you sure you want to delete this user? This action cannot be undone.')) return;

        try {
            const response = await fetch(`${API_BASE_URL}/api/admin/users/${userId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${user.token}` }
            });

            const data = await response.json();
            if (data.status === 'success') {
                alert('User deleted successfully');
                setUsers([]);
            } else {
                alert(data.message || 'Error deleting user');
            }
        } catch (error) {
            alert('Error deleting user: ' + error.message);
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


    return (
        <div className="space-y-6">
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
        </div>
    );
};

export default UserManagement;
