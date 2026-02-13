import { useState } from 'react';
import { Mail, Send, CheckCircle, X, Copy, Key } from 'lucide-react';
import { sendInvitation, type InvitationResult } from '../../lib/invitations';

export default function InviteFriend() {
  const [isOpen, setIsOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [invitationData, setInvitationData] = useState<InvitationResult | null>(null);
  const [copiedToken, setCopiedToken] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess(false);
    setInvitationData(null);
    setLoading(true);

    try {
      const result = await sendInvitation(email, message);
      setSuccess(true);
      setInvitationData(result);

      const defaultMessage = 'You are invited to WishSupport';
      const personalMessage = message ? `\n\n${message}` : '';
      const subject = `${result.inviter_name} invited you to join WishSupport`;
      const body = `${defaultMessage}${personalMessage}

Join WishSupport by clicking the link below:
${result.invitation_url}

Use your email address (${result.email}) and this invitation token to sign up:
${result.invitation_code}

This invitation will expire in 30 days.`;

      const mailtoUrl = `mailto:${encodeURIComponent(result.email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

      window.location.href = mailtoUrl;
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const copyToken = () => {
    if (invitationData) {
      navigator.clipboard.writeText(invitationData.invitation_code);
      setCopiedToken(true);
      setTimeout(() => setCopiedToken(false), 2000);
    }
  };

  const copyLink = () => {
    if (invitationData) {
      navigator.clipboard.writeText(invitationData.invitation_url);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };

  const handleClose = () => {
    setIsOpen(false);
    setEmail('');
    setMessage('');
    setSuccess(false);
    setInvitationData(null);
    setError('');
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
      >
        <Mail className="w-4 h-4" />
        Invite Friend
      </button>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-900">Invite a Friend</h2>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {success && invitationData ? (
          <div className="space-y-4">
            <div className="flex flex-col items-center py-4">
              <CheckCircle className="w-16 h-16 text-green-500 mb-3" />
              <p className="text-lg font-medium text-gray-900">Invitation Created!</p>
              <p className="text-sm text-gray-600 text-center mt-2">
                Your email client should open automatically. If not, you can copy the details below.
              </p>
            </div>

            <div className="space-y-3">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Mail className="w-4 h-4 text-blue-600" />
                  <span className="text-sm font-medium text-blue-900">Email Address</span>
                </div>
                <p className="text-sm text-blue-800 font-mono break-all">{invitationData.email}</p>
              </div>

              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Key className="w-4 h-4 text-green-600" />
                    <span className="text-sm font-medium text-green-900">Invitation Token</span>
                  </div>
                  <button
                    onClick={copyToken}
                    className="flex items-center gap-1 px-2 py-1 text-xs text-green-600 hover:bg-green-100 rounded transition-colors"
                  >
                    <Copy className="w-3 h-3" />
                    {copiedToken ? 'Copied!' : 'Copy'}
                  </button>
                </div>
                <p className="text-sm text-green-800 font-mono break-all">{invitationData.invitation_code}</p>
              </div>

              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-900">Invitation Link</span>
                  <button
                    onClick={copyLink}
                    className="flex items-center gap-1 px-2 py-1 text-xs text-gray-600 hover:bg-gray-200 rounded transition-colors"
                  >
                    <Copy className="w-3 h-3" />
                    {copiedLink ? 'Copied!' : 'Copy'}
                  </button>
                </div>
                <p className="text-xs text-gray-700 break-all font-mono">{invitationData.invitation_url}</p>
              </div>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
              <p className="text-xs text-amber-800">
                Your friend will need both their email address and the invitation token to sign up. This invitation expires in 30 days.
              </p>
            </div>

            <button
              onClick={handleClose}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Done
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                Email Address
              </label>
              <input
                type="email"
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="friend@example.com"
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label htmlFor="message" className="block text-sm font-medium text-gray-700 mb-1">
                Personal Message (Optional)
              </label>
              <textarea
                id="message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Add a personal message to your invitation..."
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              />
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}

            <div className="flex gap-3">
              <button
                type="button"
                onClick={handleClose}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  'Creating...'
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    Send Invitation
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
