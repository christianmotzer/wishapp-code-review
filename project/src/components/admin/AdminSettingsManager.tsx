import { useState, useEffect } from 'react';
import { Settings, Save, RefreshCw } from 'lucide-react';
import { getAllAdminSettings, updateAdminSetting, type AdminSetting } from '../../lib/admin';

export function AdminSettingsManager() {
  const [settings, setSettings] = useState<AdminSetting[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [editedValues, setEditedValues] = useState<Record<string, string>>({});

  useEffect(() => {
    loadSettings();
  }, []);

  async function loadSettings() {
    setLoading(true);
    setError('');

    try {
      const data = await getAllAdminSettings();
      setSettings(data);

      const initialValues: Record<string, string> = {};
      data.forEach(setting => {
        initialValues[setting.key] = String(setting.value);
      });
      setEditedValues(initialValues);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function handleSave(key: string) {
    setSaving(key);
    setError('');
    setSuccess('');

    try {
      const newValue = editedValues[key];
      const parsedValue = !isNaN(Number(newValue)) ? Number(newValue) : newValue;

      await updateAdminSetting(key, parsedValue);
      setSuccess(`Setting "${key}" updated successfully`);
      await loadSettings();

      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(null);
    }
  }

  function handleValueChange(key: string, value: string) {
    setEditedValues(prev => ({
      ...prev,
      [key]: value,
    }));
  }

  function getDisplayName(key: string): string {
    return key
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Settings className="w-6 h-6 text-blue-600" />
          <h2 className="text-xl font-bold text-gray-900">System Settings</h2>
        </div>
        <button
          onClick={loadSettings}
          className="flex items-center gap-2 px-3 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
        </div>
      )}

      {success && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-lg text-green-700">
          {success}
        </div>
      )}

      <div className="bg-white rounded-lg border border-gray-200 divide-y divide-gray-200">
        {settings.map((setting) => {
          const isModified = editedValues[setting.key] !== String(setting.value);

          return (
            <div key={setting.key} className="p-6">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <h3 className="text-sm font-semibold text-gray-900 mb-1">
                    {getDisplayName(setting.key)}
                  </h3>
                  {setting.description && (
                    <p className="text-sm text-gray-600 mb-3">{setting.description}</p>
                  )}
                  <div className="flex items-center gap-3">
                    <input
                      type="text"
                      value={editedValues[setting.key] || ''}
                      onChange={(e) => handleValueChange(setting.key, e.target.value)}
                      className="flex-1 max-w-xs px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    {isModified && (
                      <button
                        onClick={() => handleSave(setting.key)}
                        disabled={saving === setting.key}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                      >
                        {saving === setting.key ? (
                          <>
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                            Saving...
                          </>
                        ) : (
                          <>
                            <Save className="w-4 h-4" />
                            Save
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              </div>
              <div className="mt-3 text-xs text-gray-500">
                Last updated: {new Date(setting.updated_at).toLocaleString()}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
