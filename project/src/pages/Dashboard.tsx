import { Plus } from 'lucide-react';
import { Link } from 'react-router-dom';
import { WishList } from '../components/wishes/WishList';
import { MyWishesProposals } from '../components/wishes/MyWishesProposals';
import { useAuth } from '../components/auth/AuthProvider';

export default function Dashboard() {
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Wishes</h1>
            <p className="text-gray-600 mt-2">
              Discover and support wishes, or create your own
            </p>
          </div>
          <Link
            to="/wishes/new"
            className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-5 h-5" />
            Create Wish
          </Link>
        </div>

        {user && <MyWishesProposals />}

        <WishList />
      </div>
    </div>
  );
}
