import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { Eye, EyeOff, Mail, Lock, User, Sparkles, RefreshCw, Key, CheckCircle2 } from 'lucide-react';
import { generateNewName, updateProfile } from '../../lib/profiles';
import { verifyInvitationToken, acceptInvitation } from '../../lib/invitations';

interface SignupFormProps {
  onSuccess?: () => void;
}

export function SignupForm({ onSuccess }: SignupFormProps) {
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState('');
  const [invitationToken, setInvitationToken] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [useCustomName, setUseCustomName] = useState(false);
  const [generatedName, setGeneratedName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [tosAccepted, setTosAccepted] = useState(false);
  const [gdprAccepted, setGdprAccepted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [generatingName, setGeneratingName] = useState(false);
  const [verifyingToken, setVerifyingToken] = useState(false);
  const [tokenValid, setTokenValid] = useState<boolean | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (!useCustomName && !generatedName) {
      generateNamePreview();
    }

    const emailParam = searchParams.get('email');
    const tokenParam = searchParams.get('token');
    if (emailParam) setEmail(emailParam);
    if (tokenParam) setInvitationToken(tokenParam);
  }, []);

  const generateNamePreview = async () => {
    setGeneratingName(true);
    const name = await generateNewName();
    if (name) {
      setGeneratedName(name);
    }
    setGeneratingName(false);
  };

  const handleVerifyToken = async () => {
    if (!email || !invitationToken) {
      return;
    }

    setVerifyingToken(true);
    setTokenValid(null);

    try {
      const isValid = await verifyInvitationToken(email, invitationToken);
      setTokenValid(isValid);
      if (!isValid) {
        setMessage({ type: 'error', text: 'Invalid invitation token or email combination' });
      } else {
        setMessage(null);
      }
    } catch (error) {
      setTokenValid(false);
      setMessage({ type: 'error', text: 'Failed to verify invitation token' });
    } finally {
      setVerifyingToken(false);
    }
  };

  useEffect(() => {
    if (email && invitationToken && invitationToken.length > 10) {
      handleVerifyToken();
    }
  }, [email, invitationToken]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    if (password !== confirmPassword) {
      setMessage({ type: 'error', text: 'Passwords do not match' });
      setLoading(false);
      return;
    }

    if (password.length < 6) {
      setMessage({ type: 'error', text: 'Password must be at least 6 characters long' });
      setLoading(false);
      return;
    }

    if (!tosAccepted || !gdprAccepted) {
      setMessage({ type: 'error', text: 'You must accept the Terms of Service and GDPR compliance statement' });
      setLoading(false);
      return;
    }

    if (!invitationToken) {
      setMessage({ type: 'error', text: 'Invitation token is required' });
      setLoading(false);
      return;
    }

    const isValidToken = await verifyInvitationToken(email, invitationToken);
    if (!isValidToken) {
      setMessage({ type: 'error', text: 'Invalid invitation token or email. Please check your invitation details.' });
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: undefined,
        },
      });

      if (error) {
        setMessage({ type: 'error', text: error.message });
      } else if (data.user) {
        await acceptInvitation(invitationToken);

        if (useCustomName && displayName.trim()) {
          await updateProfile(data.user.id, {
            display_name: displayName.trim(),
            tos_accepted: tosAccepted,
            gdpr_accepted: gdprAccepted
          });
        } else if (!useCustomName && generatedName) {
          await updateProfile(data.user.id, {
            display_name: generatedName,
            tos_accepted: tosAccepted,
            gdpr_accepted: gdprAccepted
          });
        }
        setMessage({ type: 'success', text: 'Account created successfully!' });
        onSuccess?.();
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'An unexpected error occurred' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto">
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
            Email
          </label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Enter your email"
            />
          </div>
        </div>

        <div>
          <label htmlFor="invitationToken" className="block text-sm font-medium text-gray-700 mb-2">
            Invitation Token
          </label>
          <div className="relative">
            <Key className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              id="invitationToken"
              type="text"
              value={invitationToken}
              onChange={(e) => setInvitationToken(e.target.value)}
              required
              className={`w-full pl-10 pr-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                tokenValid === false ? 'border-red-300 bg-red-50' : tokenValid === true ? 'border-green-300 bg-green-50' : 'border-gray-300'
              }`}
              placeholder="Enter your invitation token"
            />
            {verifyingToken && (
              <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
              </div>
            )}
          </div>
          <p className="text-xs text-gray-600 mt-1">
            You need an invitation to create an account. Check your email for the token.
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Display Name
          </label>
          <div className="space-y-3">
            <div className="flex items-center space-x-2">
              <input
                type="radio"
                id="autoName"
                checked={!useCustomName}
                onChange={() => setUseCustomName(false)}
                className="w-4 h-4 text-blue-600 focus:ring-blue-500"
              />
              <label htmlFor="autoName" className="text-sm text-gray-700 flex-1">
                Generate a lovely name for me
              </label>
            </div>
            {!useCustomName && (
              <div className="ml-6 flex items-center space-x-2 p-3 bg-blue-50 rounded-lg border border-blue-200">
                <Sparkles className="w-5 h-5 text-blue-600 flex-shrink-0" />
                <span className="text-blue-800 font-medium flex-1">
                  {generatingName ? 'Generating...' : generatedName || 'Your Name'}
                </span>
                <button
                  type="button"
                  onClick={generateNamePreview}
                  disabled={generatingName}
                  className="p-1 text-blue-600 hover:text-blue-800 disabled:opacity-50"
                  title="Generate new name"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
              </div>
            )}
            <div className="flex items-center space-x-2">
              <input
                type="radio"
                id="customName"
                checked={useCustomName}
                onChange={() => setUseCustomName(true)}
                className="w-4 h-4 text-blue-600 focus:ring-blue-500"
              />
              <label htmlFor="customName" className="text-sm text-gray-700">
                I want to choose my own name
              </label>
            </div>
            {useCustomName && (
              <div className="ml-6">
                <div className="relative">
                  <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Enter your display name"
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        <div>
          <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
            Password
          </label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full pl-10 pr-12 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Enter your password"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>
        </div>

        <div>
          <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-2">
            Confirm Password
          </label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              id="confirmPassword"
              type={showConfirmPassword ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              className="w-full pl-10 pr-12 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Confirm your password"
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>
        </div>

        <div className="space-y-3 bg-gray-50 p-4 rounded-lg">
          <div className="flex items-start space-x-3">
            <input
              id="tos"
              type="checkbox"
              checked={tosAccepted}
              onChange={(e) => setTosAccepted(e.target.checked)}
              className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 mt-1 flex-shrink-0"
            />
            <label htmlFor="tos" className="text-sm text-gray-700">
              I accept the Terms of Service and understand the rules of this community
            </label>
          </div>

          <div className="flex items-start space-x-3">
            <input
              id="gdpr"
              type="checkbox"
              checked={gdprAccepted}
              onChange={(e) => setGdprAccepted(e.target.checked)}
              className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 mt-1 flex-shrink-0"
            />
            <label htmlFor="gdpr" className="text-sm text-gray-700">
              I accept the GDPR compliance statement and consent to the collection and processing of my personal data as described
            </label>
          </div>

          <p className="text-xs text-gray-500 pt-2">
            You can delete your account and personal data anytime in your profile settings.
          </p>
        </div>

        {message && (
          <div
            className={`p-4 rounded-lg ${
              message.type === 'error'
                ? 'bg-red-50 text-red-700 border border-red-200'
                : 'bg-green-50 text-green-700 border border-green-200'
            }`}
          >
            {message.text}
          </div>
        )}

        <button
          type="submit"
          disabled={loading || !tosAccepted || !gdprAccepted}
          className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? 'Creating account...' : 'Create Account'}
        </button>
      </form>
    </div>
  );
}