import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation, useNavigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './components/auth/AuthProvider';
import { ProductCard } from './components/stripe/ProductCard';
import { SubscriptionStatus } from './components/stripe/SubscriptionStatus';
import { Login } from './pages/Login';
import { Signup } from './pages/Signup';
import { Success } from './pages/Success';
import Dashboard from './pages/Dashboard';
import WishDetail from './pages/WishDetail';
import CreateWish from './pages/CreateWish';
import RespondToWish from './pages/RespondToWish';
import SupportWish from './pages/SupportWish';
import EditWish from './pages/EditWish';
import SendTokens from './pages/SendTokens';
import TokenHistory from './pages/TokenHistory';
import AdminDashboard from './pages/AdminDashboard';
import { ProfileSettings } from './pages/ProfileSettings';
import TokenLeaderboard from './pages/TokenLeaderboard';
import Friends from './pages/Friends';
import AddFriend from './pages/AddFriend';
import { LogOut, User, Heart, Sparkles, Shield, Coins, Trophy, Settings, Users } from 'lucide-react';
import { useAdmin } from './hooks/useAdmin';
import { getUserTokenBalance } from './lib/tokens';
import { useProfile } from './hooks/useProfile';

function Navigation() {
  const { user, signOut } = useAuth();
  const { isAdmin, isSuperAdmin, loading } = useAdmin();
  const { profile } = useProfile();
  const [tokenBalance, setTokenBalance] = useState<number | null>(null);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) {
      loadBalance();
    } else {
      setTokenBalance(null);
    }
  }, [user]);

  async function loadBalance() {
    const data = await getUserTokenBalance();
    setTokenBalance(data?.balance ?? 0);
  }

  return (
    <nav className="bg-white shadow-sm border-b">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center gap-6">
            <Link to="/" className="flex items-center gap-2 text-xl font-bold text-gray-900">
              <Heart className="w-6 h-6 text-red-500" />
              WishSupport
            </Link>
            {user && (
              <div className="flex items-center gap-4">
                <Link
                  to="/dashboard"
                  className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"
                >
                  <Sparkles className="w-4 h-4" />
                  Wishes
                </Link>
                <Link
                  to="/friends"
                  className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"
                >
                  <Users className="w-4 h-4" />
                  Friends
                </Link>
                <Link
                  to="/leaderboard"
                  className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"
                >
                  <Trophy className="w-4 h-4" />
                  Leaderboard
                </Link>
                {isAdmin && !loading && (
                  <Link
                    to="/admin"
                    className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"
                  >
                    <Shield className="w-4 h-4" />
                    Admin Panel
                  </Link>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center gap-4">
            {user ? (
              <>
                {tokenBalance !== null && (
                  <Link
                    to="/tokens/history"
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 text-amber-700 hover:bg-amber-100 rounded-lg text-sm font-medium transition-colors"
                    title="View WishToken history"
                  >
                    <Coins className="w-4 h-4" />
                    {tokenBalance.toLocaleString()}
                  </Link>
                )}
                <div className="relative">
                  <button
                    onClick={() => setShowUserMenu(!showUserMenu)}
                    className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 px-3 py-2 rounded-lg hover:bg-gray-50"
                  >
                    <div className="w-8 h-8 bg-gradient-to-br from-blue-400 to-green-400 rounded-full flex items-center justify-center text-white font-bold text-sm">
                      {profile?.display_name?.charAt(0).toUpperCase() || '?'}
                    </div>
                    <span className="font-medium">{profile?.display_name || user.email}</span>
                    {!loading && isAdmin && (
                      <span
                        className={`px-2 py-1 text-xs font-medium rounded ${
                          isSuperAdmin
                            ? 'bg-orange-100 text-orange-800'
                            : 'bg-blue-100 text-blue-800'
                        }`}
                      >
                        <Shield className="w-3 h-3 inline mr-1" />
                        {isSuperAdmin ? 'Super Admin' : 'Admin'}
                      </span>
                    )}
                  </button>
                  {showUserMenu && (
                    <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-50">
                      <Link
                        to="/profile/settings"
                        onClick={() => setShowUserMenu(false)}
                        className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                      >
                        <Settings className="w-4 h-4" />
                        Profile Settings
                      </Link>
                      <Link
                        to="/tokens/history"
                        onClick={() => setShowUserMenu(false)}
                        className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                      >
                        <Coins className="w-4 h-4" />
                        WishToken History
                      </Link>
                      <div className="border-t border-gray-200 my-2"></div>
                      <button
                        onClick={async () => {
                          setShowUserMenu(false);
                          await signOut();
                          navigate('/login');
                        }}
                        className="flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50 w-full text-left"
                      >
                        <LogOut className="w-4 h-4" />
                        Sign Out
                      </button>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="flex items-center gap-4">
                <Link
                  to="/login"
                  className="text-sm text-gray-600 hover:text-gray-900"
                >
                  Sign In
                </Link>
                <Link
                  to="/signup"
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700"
                >
                  Sign Up
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}

function HomePage() {
  const { user } = useAuth();

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-2xl text-center">
          <Heart className="mx-auto h-20 w-20 text-red-500 mb-6" />
          <h2 className="text-4xl font-bold text-gray-900 mb-4">
            WishSupport Platform
          </h2>
          <p className="text-xl text-gray-600 mb-8">
            Create wishes, support ideas, and collaborate on meaningful projects with hierarchical support distribution.
          </p>
          <div className="space-y-3 max-w-md mx-auto">
            <Link
              to="/login"
              className="w-full bg-blue-600 text-white py-3 px-6 rounded-lg hover:bg-blue-700 transition-colors block text-lg"
            >
              Sign In
            </Link>
            <Link
              to="/signup"
              className="w-full bg-gray-200 text-gray-900 py-3 px-6 rounded-lg hover:bg-gray-300 transition-colors block text-lg"
            >
              Create Account
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <Heart className="mx-auto h-16 w-16 text-red-500 mb-4" />
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Welcome to WishSupport
          </h1>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto mb-8">
            Create and support wishes with hierarchical distribution. Build upon existing ideas or start your own.
          </p>
          <Link
            to="/dashboard"
            className="inline-flex items-center gap-2 bg-blue-600 text-white px-8 py-4 rounded-lg hover:bg-blue-700 transition-colors text-lg font-medium"
          >
            <Sparkles className="w-5 h-5" />
            Explore Wishes
          </Link>
        </div>

        <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto mt-16">
          <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
              <Sparkles className="w-6 h-6 text-blue-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Create Wishes</h3>
            <p className="text-gray-600">
              Share your ideas and proposals with the community. Build sub-wishes on existing projects.
            </p>
          </div>
          <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mb-4">
              <Heart className="w-6 h-6 text-green-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Support Projects</h3>
            <p className="text-gray-600">
              Track support for wishes you believe in. Distribution flows through the hierarchy automatically.
            </p>
          </div>
          <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mb-4">
              <User className="w-6 h-6 text-purple-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Community Voting</h3>
            <p className="text-gray-600">
              Enable voting on proposals. Let the community decide through democratic processes.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <Router>
        <div className="min-h-screen bg-gray-50">
          <Navigation />
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/success" element={<Success />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/admin" element={<AdminDashboard />} />
            <Route path="/profile/settings" element={<ProfileSettings />} />
            <Route path="/leaderboard" element={<TokenLeaderboard />} />
            <Route path="/friends" element={<Friends />} />
            <Route path="/friends/add" element={<AddFriend />} />
            <Route path="/wishes/new" element={<CreateWish />} />
            <Route path="/wishes/:id" element={<WishDetail />} />
            <Route path="/wishes/:id/edit" element={<EditWish />} />
            <Route path="/wishes/:id/respond" element={<RespondToWish />} />
            <Route path="/wishes/:id/support" element={<SupportWish />} />
            <Route path="/wishes/:id/send-tokens" element={<SendTokens />} />
            <Route path="/tokens/history" element={<TokenHistory />} />
          </Routes>
        </div>
      </Router>
    </AuthProvider>
  );
}

export default App;