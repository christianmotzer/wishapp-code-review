import { useState, useEffect } from 'react';
import { Settings, Save, AlertCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';

export default function AdminSettingsForm() {
  const [initialTokens, setInitialTokens] = useState(1000);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    loadSettings();
  }, []);

  async function loadSettings() {
    try {
      setLoading(true);
      const { data, error: fetchError } = await supabase
        .from('admin_settings')
        .select('value')
        .eq('key', 'initial_tokens_for_new_users')
        .maybeSingle();

      if (fetchError) throw fetchError;

      if (data?.value) {
        const tokens = typeof data.value === 'number' ? data.value : parseInt(data.value as string);
        setInitialTokens(tokens);
      }
    } catch (err: any) {
      console.error('Failed to load settings:', err);
      setError('Failed to load settings');
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage('');
    setError('');

    if (initialTokens < 0) {
      setError('Initial tokens must be 0 or greater');
      return;
    }

    if (initialTokens > 1000000) {
      setError('Initial tokens cannot exceed 1,000,000');
      return;
    }

    try {
      setSaving(true);

      const { error: updateError } = await supabase
        .from('admin_settings')
        .update({ value: initialTokens, updated_at: new Date().toISOString() })
        .eq('key', 'initial_tokens_for_new_users');

      if (updateError) throw updateError;

      setMessage('Settings saved successfully');
      setTimeout(() => setMessage(''), 3000);
    } catch (err: any) {
      console.error('Failed to save settings:', err);
      setError(err.message || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <p className="text-gray-600">Loading settings...</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
          <Settings className="w-5 h-5 text-blue-600" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-gray-900">System Settings</h3>
          <p className="text-sm text-gray-600">Configure initial token allocation for new users</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="initialTokens" className="block text-sm font-medium text-gray-700 mb-2">
            Initial WishTokens for New Users
          </label>
          <input
            type="number"
            id="initialTokens"
            value={initialTokens}
            onChange={(e) => setInitialTokens(parseInt(e.target.value) || 0)}
            min="0"
            max="1000000"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            required
          />
          <p className="text-xs text-gray-500 mt-2">
            Every new user will automatically receive this amount of WishTokens when they create an account.
          </p>
        </div>

        {error && (
          <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <p>{error}</p>
          </div>
        )}

        {message && (
          <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">
            {message}
          </div>
        )}

        <button
          type="submit"
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
        >
          <Save className="w-4 h-4" />
          {saving ? 'Saving...' : 'Save Settings'}
        </button>
      </form>
    </div>
  );
}
