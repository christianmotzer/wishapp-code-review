import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, TrendingUp, Clock, XCircle, Activity, ArrowLeft, Coins, Users, Settings } from 'lucide-react';
import { useAdmin } from '../hooks/useAdmin';
import { supabase } from '../lib/supabase';
import { getAllAdmins } from '../lib/admin';
import { getAuditLog } from '../lib/auditLog';
import { getAllUserProfiles, getUserProfileWithStats } from '../lib/profiles';
import AddAdminForm from '../components/admin/AddAdminForm';
import AdminList from '../components/admin/AdminList';
import GrantTokensForm from '../components/admin/GrantTokensForm';
import AdminSettingsForm from '../components/admin/AdminSettingsForm';
import { UserManagement } from '../components/admin/UserManagement';
import { CreateUserForm } from '../components/admin/CreateUserForm';
import { AdminSettingsManager } from '../components/admin/AdminSettingsManager';
import type { AdminUser } from '../lib/admin';
import type { AdminAction } from '../lib/auditLog';

type TabType = 'overview' | 'wishes' | 'users' | 'admins' | 'tokens' | 'settings' | 'audit';

export default function AdminDashboard() {
  const navigate = useNavigate();
  const { isAdmin, isSuperAdmin, loading: adminLoading } = useAdmin();
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [auditLog, setAuditLog] = useState<AdminAction[]>([]);
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null);
  const [stats, setStats] = useState({
    totalWishes: 0,
    activeWishes: 0,
    draftWishes: 0,
    cancelledWishes: 0,
  });

  useEffect(() => {
    if (!adminLoading && !isAdmin) {
      navigate('/dashboard');
    }
  }, [isAdmin, adminLoading, navigate]);

  useEffect(() => {
    loadCurrentUser();
    loadStats();
    if (activeTab === 'admins') {
      loadAdmins();
    }
    if (activeTab === 'audit') {
      loadAuditLog();
    }
  }, [activeTab]);

  async function loadCurrentUser() {
    const { data } = await supabase.auth.getUser();
    setCurrentUserEmail(data.user?.email || null);
  }

  async function loadStats() {
    try {
      const { data: wishes } = await supabase.from('wishes').select('status');
      if (wishes) {
        setStats({
          totalWishes: wishes.length,
          activeWishes: wishes.filter((w) => w.status === 'active').length,
          draftWishes: wishes.filter((w) => w.status === 'draft').length,
          cancelledWishes: wishes.filter((w) => w.status === 'cancelled').length,
        });
      }
    } catch (error) {
      console.error('Failed to load stats:', error);
    }
  }

  async function loadAdmins() {
    try {
      const adminData = await getAllAdmins();
      setAdmins(adminData);
    } catch (error) {
      console.error('Failed to load admins:', error);
    }
  }

  async function loadAuditLog() {
    try {
      const log = await getAuditLog(100);
      setAuditLog(log);
    } catch (error) {
      console.error('Failed to load audit log:', error);
    }
  }

  if (adminLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-600">Loading...</div>
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>

        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center">
              <Shield className="w-6 h-6 text-orange-600" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
              <p className="text-gray-600">Manage wishes, users, and system settings</p>
            </div>
          </div>
        </div>

        <div className="border-b border-gray-200 mb-6">
          <nav className="flex gap-6">
            <button
              onClick={() => setActiveTab('overview')}
              className={`pb-4 px-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'overview'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              <TrendingUp className="w-4 h-4 inline mr-2" />
              Overview
            </button>
            <button
              onClick={() => setActiveTab('wishes')}
              className={`pb-4 px-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'wishes'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              <Clock className="w-4 h-4 inline mr-2" />
              Wishes
            </button>
            <button
              onClick={() => setActiveTab('users')}
              className={`pb-4 px-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'users'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              <Users className="w-4 h-4 inline mr-2" />
              Users
            </button>
            {isSuperAdmin && (
              <button
                onClick={() => setActiveTab('admins')}
                className={`pb-4 px-2 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'admins'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-600 hover:text-gray-900'
                }`}
              >
                <Shield className="w-4 h-4 inline mr-2" />
                Admins
              </button>
            )}
            <button
              onClick={() => setActiveTab('tokens')}
              className={`pb-4 px-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'tokens'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              <Coins className="w-4 h-4 inline mr-2" />
              WishTokens
            </button>
            <button
              onClick={() => setActiveTab('settings')}
              className={`pb-4 px-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'settings'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              <Settings className="w-4 h-4 inline mr-2" />
              Settings
            </button>
            <button
              onClick={() => setActiveTab('audit')}
              className={`pb-4 px-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'audit'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              <Activity className="w-4 h-4 inline mr-2" />
              Audit Log
            </button>
          </nav>
        </div>

        {activeTab === 'overview' && <OverviewTab stats={stats} />}
        {activeTab === 'wishes' && <WishesTab />}
        {activeTab === 'users' && currentUserEmail && <UsersTabWithCreate adminEmail={currentUserEmail} />}
        {activeTab === 'admins' && isSuperAdmin && (
          <AdminsTab
            admins={admins}
            currentUserEmail={currentUserEmail}
            onUpdate={loadAdmins}
          />
        )}
        {activeTab === 'tokens' && <TokensTab />}
        {activeTab === 'settings' && <SettingsTab />}
        {activeTab === 'audit' && <AuditTab auditLog={auditLog} />}
      </div>
    </div>
  );
}

function OverviewTab({ stats }: { stats: any }) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <StatCard
          label="Total Wishes"
          value={stats.totalWishes}
          icon={TrendingUp}
          color="blue"
        />
        <StatCard
          label="Active Wishes"
          value={stats.activeWishes}
          icon={Clock}
          color="green"
        />
        <StatCard
          label="Draft Wishes"
          value={stats.draftWishes}
          icon={Clock}
          color="gray"
        />
        <StatCard
          label="Cancelled"
          value={stats.cancelledWishes}
          icon={XCircle}
          color="red"
        />
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-bold text-gray-900 mb-4">System Status</h3>
        <div className="space-y-3">
          <div className="flex items-center justify-between py-2">
            <span className="text-gray-600">Database Connection</span>
            <span className="px-3 py-1 bg-green-100 text-green-800 text-sm font-medium rounded">
              Connected
            </span>
          </div>
          <div className="flex items-center justify-between py-2">
            <span className="text-gray-600">Authentication</span>
            <span className="px-3 py-1 bg-green-100 text-green-800 text-sm font-medium rounded">
              Active
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function WishesTab() {
  const [wishes, setWishes] = useState<any[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');

  useEffect(() => {
    loadWishes();
  }, [statusFilter, typeFilter]);

  async function loadWishes() {
    try {
      let query = supabase.from('wishes').select('*').order('created_at', { ascending: false });

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }
      if (typeFilter !== 'all') {
        query = query.eq('wish_type', typeFilter);
      }

      const { data } = await query;
      setWishes(data || []);
    } catch (error) {
      console.error('Failed to load wishes:', error);
    }
  }

  const statusButtons = [
    { value: 'all', label: 'All' },
    { value: 'active', label: 'Active' },
    { value: 'draft', label: 'Drafts' },
    { value: 'cancelled', label: 'Cancelled' },
  ];

  const typeButtons = [
    { value: 'all', label: 'All Types' },
    { value: 'wish', label: 'Wishes' },
    { value: 'proposal', label: 'Proposals' },
  ];

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <div className="flex gap-3 flex-wrap">
          {statusButtons.map((btn) => (
            <button
              key={btn.value}
              onClick={() => setStatusFilter(btn.value)}
              className={`px-4 py-2 rounded-lg text-sm font-medium ${
                statusFilter === btn.value
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-700 border border-gray-300'
              }`}
            >
              {btn.label}
            </button>
          ))}
        </div>
        <div className="flex gap-3 flex-wrap">
          {typeButtons.map((btn) => (
            <button
              key={btn.value}
              onClick={() => setTypeFilter(btn.value)}
              className={`px-4 py-2 rounded-lg text-sm font-medium ${
                typeFilter === btn.value
                  ? 'bg-teal-600 text-white'
                  : 'bg-white text-gray-700 border border-gray-300'
              }`}
            >
              {btn.label}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-bold text-gray-900">
            {statusFilter === 'all' ? 'All Items' : `${statusFilter.charAt(0).toUpperCase() + statusFilter.slice(1)} Items`}
          </h3>
          <p className="text-sm text-gray-600 mt-1">{wishes.length} items found</p>
        </div>

        <div className="divide-y divide-gray-200">
          {wishes.map((wish) => (
            <div key={wish.id} className="p-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-medium text-gray-900">{wish.title}</h4>
                    {wish.wish_type === 'proposal' && (
                      <span className="text-xs px-2 py-0.5 bg-teal-100 text-teal-700 rounded-full font-medium">
                        Proposal
                      </span>
                    )}
                  </div>
                  {wish.description && (
                    <p className="text-sm text-gray-600 line-clamp-2 mb-2">{wish.description}</p>
                  )}
                  <div className="flex items-center gap-3 text-xs text-gray-500">
                    <span>Created: {new Date(wish.created_at).toLocaleDateString()}</span>
                    {wish.category && <span>Category: {wish.category}</span>}
                    {wish.parent_wish_id && <span className="text-blue-500">Has parent</span>}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span
                    className={`px-3 py-1 text-xs font-medium rounded ${
                      wish.status === 'active'
                        ? 'bg-blue-100 text-blue-800'
                        : wish.status === 'draft'
                          ? 'bg-gray-100 text-gray-800'
                          : wish.status === 'accepted' || wish.status === 'approved_by_vote'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-red-100 text-red-800'
                    }`}
                  >
                    {wish.status}
                  </span>
                  <a
                    href={`/wishes/${wish.id}`}
                    className="px-3 py-1 text-sm text-blue-600 hover:text-blue-700"
                  >
                    View
                  </a>
                </div>
              </div>
            </div>
          ))}

          {wishes.length === 0 && (
            <div className="p-12 text-center text-gray-500">No items found</div>
          )}
        </div>
      </div>
    </div>
  );
}

function AdminsTab({
  admins,
  currentUserEmail,
  onUpdate,
}: {
  admins: AdminUser[];
  currentUserEmail: string | null;
  onUpdate: () => void;
}) {
  return (
    <div className="space-y-6">
      <AddAdminForm onAdminAdded={onUpdate} />
      <AdminList admins={admins} currentUserEmail={currentUserEmail} onAdminRemoved={onUpdate} />
    </div>
  );
}

function UsersTabWithCreate({ adminEmail }: { adminEmail: string }) {
  return (
    <div className="space-y-6">
      <CreateUserForm adminEmail={adminEmail} />
      <UserManagement adminEmail={adminEmail} />
    </div>
  );
}

function TokensTab() {
  return (
    <div className="space-y-6 max-w-2xl">
      <AdminSettingsForm />
      <GrantTokensForm />
    </div>
  );
}

function SettingsTab() {
  return (
    <div className="space-y-6">
      <AdminSettingsManager />
    </div>
  );
}

function AuditTab({ auditLog }: { auditLog: AdminAction[] }) {
  return (
    <div className="bg-white rounded-lg border border-gray-200">
      <div className="p-6 border-b border-gray-200">
        <h3 className="text-lg font-bold text-gray-900">Recent Admin Actions</h3>
        <p className="text-sm text-gray-600 mt-1">Last {auditLog.length} actions</p>
      </div>

      <div className="divide-y divide-gray-200">
        {auditLog.map((action) => (
          <div key={action.id} className="p-6">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <span className="font-medium text-gray-900">{action.admin_email}</span>
                  <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded">
                    {action.action_type}
                  </span>
                </div>
                <p className="text-sm text-gray-600 mb-1">Target: {action.target_id}</p>
                {action.reason && <p className="text-sm text-gray-700 italic">"{action.reason}"</p>}
              </div>
              <span className="text-xs text-gray-500">
                {new Date(action.created_at).toLocaleString()}
              </span>
            </div>
          </div>
        ))}

        {auditLog.length === 0 && (
          <div className="p-12 text-center text-gray-500">No actions recorded yet</div>
        )}
      </div>
    </div>
  );
}

function UsersTab() {
  const [users, setUsers] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadUsers();
  }, [searchQuery]);

  async function loadUsers() {
    try {
      setLoading(true);
      const profiles = await getAllUserProfiles(searchQuery);
      const profilesWithStats = await Promise.all(
        profiles.map(async (profile) => {
          const stats = await getUserProfileWithStats(profile.user_id);
          return stats;
        })
      );
      setUsers(profilesWithStats);
    } catch (error) {
      console.error('Failed to load users:', error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <input
          type="text"
          placeholder="Search users by name..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      <div className="bg-white rounded-lg border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-bold text-gray-900">All Users</h3>
          <p className="text-sm text-gray-600 mt-1">{users.length} users found</p>
        </div>

        <div className="divide-y divide-gray-200">
          {loading ? (
            <div className="p-12 text-center text-gray-500">Loading users...</div>
          ) : users.length === 0 ? (
            <div className="p-12 text-center text-gray-500">No users found</div>
          ) : (
            users.map((user) => (
              <div key={user.user_id} className="p-6 hover:bg-gray-50 transition-colors">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-12 h-12 bg-gradient-to-br from-blue-400 to-green-400 rounded-full flex items-center justify-center text-white font-bold text-lg">
                        {user.display_name?.charAt(0).toUpperCase() || '?'}
                      </div>
                      <div>
                        <h4 className="font-semibold text-gray-900">{user.display_name || 'No Name'}</h4>
                        {user.full_name && (
                          <p className="text-sm text-gray-600">{user.full_name}</p>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                      <div>
                        <p className="text-xs text-gray-500">WishToken Balance</p>
                        <p className="text-lg font-semibold text-amber-600">
                          {user.token_balance?.toLocaleString() || 0}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Wishes Created</p>
                        <p className="text-lg font-semibold text-blue-600">
                          {user.wishes_created || 0}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Wishes Supported</p>
                        <p className="text-lg font-semibold text-green-600">
                          {user.wishes_supported || 0}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Member Since</p>
                        <p className="text-sm text-gray-700">
                          {new Date(user.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>

                    {user.bio && (
                      <p className="text-sm text-gray-600 mt-3 italic">"{user.bio}"</p>
                    )}

                    {(user.phone || user.city || user.country) && (
                      <div className="mt-3 pt-3 border-t border-gray-100">
                        <p className="text-xs font-medium text-gray-500 mb-2">Contact Information</p>
                        <div className="flex gap-4 text-sm text-gray-600">
                          {user.phone && <span>Phone: {user.phone}</span>}
                          {user.city && user.country && (
                            <span>Location: {user.city}, {user.country}</span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  <button
                    onClick={() => setSelectedUser(user)}
                    className="px-3 py-1 text-sm text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded transition-colors"
                  >
                    View Details
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {selectedUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-gray-900">User Details</h3>
                <button
                  onClick={() => setSelectedUser(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <XCircle className="w-6 h-6" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              <div className="flex items-center gap-4">
                <div className="w-20 h-20 bg-gradient-to-br from-blue-400 to-green-400 rounded-full flex items-center justify-center text-white font-bold text-2xl">
                  {selectedUser.display_name?.charAt(0).toUpperCase() || '?'}
                </div>
                <div>
                  <h4 className="text-2xl font-bold text-gray-900">{selectedUser.display_name}</h4>
                  {selectedUser.full_name && (
                    <p className="text-gray-600">{selectedUser.full_name}</p>
                  )}
                </div>
              </div>

              {selectedUser.bio && (
                <div>
                  <h5 className="text-sm font-semibold text-gray-700 mb-2">Bio</h5>
                  <p className="text-gray-600">{selectedUser.bio}</p>
                </div>
              )}

              <div className="grid grid-cols-3 gap-4">
                <div className="bg-amber-50 rounded-lg p-4 text-center">
                  <p className="text-2xl font-bold text-amber-600">
                    {selectedUser.token_balance?.toLocaleString() || 0}
                  </p>
                  <p className="text-xs text-gray-600 mt-1">WishTokens</p>
                </div>
                <div className="bg-blue-50 rounded-lg p-4 text-center">
                  <p className="text-2xl font-bold text-blue-600">
                    {selectedUser.wishes_created || 0}
                  </p>
                  <p className="text-xs text-gray-600 mt-1">Wishes</p>
                </div>
                <div className="bg-green-50 rounded-lg p-4 text-center">
                  <p className="text-2xl font-bold text-green-600">
                    {selectedUser.wishes_supported || 0}
                  </p>
                  <p className="text-xs text-gray-600 mt-1">Supported</p>
                </div>
              </div>

              <div>
                <h5 className="text-sm font-semibold text-gray-700 mb-3">Contact Information</h5>
                <div className="space-y-2 text-sm">
                  {selectedUser.phone && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Phone:</span>
                      <span className="text-gray-900 font-medium">{selectedUser.phone}</span>
                    </div>
                  )}
                  {selectedUser.address_line1 && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Address:</span>
                      <span className="text-gray-900 font-medium">{selectedUser.address_line1}</span>
                    </div>
                  )}
                  {selectedUser.city && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">City:</span>
                      <span className="text-gray-900 font-medium">{selectedUser.city}</span>
                    </div>
                  )}
                  {selectedUser.state && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">State:</span>
                      <span className="text-gray-900 font-medium">{selectedUser.state}</span>
                    </div>
                  )}
                  {selectedUser.postal_code && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Postal Code:</span>
                      <span className="text-gray-900 font-medium">{selectedUser.postal_code}</span>
                    </div>
                  )}
                  {selectedUser.country && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Country:</span>
                      <span className="text-gray-900 font-medium">{selectedUser.country}</span>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <h5 className="text-sm font-semibold text-gray-700 mb-3">Account Information</h5>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">User ID:</span>
                    <span className="text-gray-900 font-mono text-xs">{selectedUser.user_id}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Member Since:</span>
                    <span className="text-gray-900 font-medium">
                      {new Date(selectedUser.created_at).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      })}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Last Updated:</span>
                    <span className="text-gray-900 font-medium">
                      {new Date(selectedUser.updated_at).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      })}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string;
  value: number;
  icon: any;
  color: string;
}) {
  const colorClasses: Record<string, string> = {
    blue: 'bg-blue-100 text-blue-600',
    green: 'bg-green-100 text-green-600',
    red: 'bg-red-100 text-red-600',
    gray: 'bg-gray-100 text-gray-600',
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${colorClasses[color]}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
      <div className="text-3xl font-bold text-gray-900 mb-1">{value}</div>
      <div className="text-sm text-gray-600">{label}</div>
    </div>
  );
}
