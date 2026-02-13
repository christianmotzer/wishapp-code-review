import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, CheckCircle, XCircle, Vote, Coins } from 'lucide-react';
import { getWishWithStats, acceptWish, rejectWish, enableVotingForWish, getWishById } from '../lib/wishes';
import { getWishTokenDistributionInfo, calculateMaxDistributableTokens, validateTokenDistribution, calculateEqualSplitAmount } from '../lib/tokens';
import type { WishWithStats, Wish } from '../types/database';

export default function RespondToWish() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [wish, setWish] = useState<WishWithStats | null>(null);
  const [parentWish, setParentWish] = useState<Wish | null>(null);
  const [action, setAction] = useState<'accept' | 'reject' | 'voting' | null>(null);
  const [reason, setReason] = useState('');
  const [closeParent, setCloseParent] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [votingConfig, setVotingConfig] = useState({
    required_votes: 10,
    approval_percentage: 60,
    voting_duration_hours: 168,
  });

  const [tokenDistributionMode, setTokenDistributionMode] = useState<'none' | 'full' | 'partial' | 'equal'>('none');
  const [tokenAmount, setTokenAmount] = useState(0);
  const [parentTokenInfo, setParentTokenInfo] = useState({
    currentTokens: 0,
    tokensDistributed: 0,
    availableForDistribution: 0,
    maxPerProposal: 0,
    acceptedProposalsCount: 0,
  });

  useEffect(() => {
    loadWish();
  }, [id]);

  async function loadWish() {
    if (!id) return;
    try {
      const data = await getWishWithStats(id);
      setWish(data);
      if (data.settlement_type === 'full_settlement') {
        setCloseParent(true);
        setTokenDistributionMode('full');
      } else if (data.settlement_type === 'partial_contribution') {
        setCloseParent(false);
        setTokenDistributionMode('partial');
      }

      if (data.parent_wish_id && data.wish_type === 'proposal') {
        const parent = await getWishById(data.parent_wish_id);
        setParentWish(parent);

        if (parent) {
          const tokenInfo = await getWishTokenDistributionInfo(data.parent_wish_id);
          setParentTokenInfo(tokenInfo);

          if (data.settlement_type === 'full_settlement') {
            setTokenAmount(tokenInfo.currentTokens);
          }
        }
      }
    } catch (err) {
      setError('Failed to load wish');
    }
  }

  const isProposal = wish?.wish_type === 'proposal';

  async function handleAccept() {
    if (!id) return;

    if (isProposal && tokenAmount > 0) {
      const validation = validateTokenDistribution(
        tokenAmount,
        parentTokenInfo.currentTokens,
        closeParent
      );

      if (!validation.valid) {
        setError(validation.error || 'Invalid token distribution');
        return;
      }
    }

    try {
      setLoading(true);
      const tokenDistribution = isProposal && tokenAmount > 0 ? { amount: tokenAmount } : undefined;
      await acceptWish(id, reason || undefined, isProposal ? closeParent : false, tokenDistribution);
      navigate(`/wishes/${id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to accept');
    } finally {
      setLoading(false);
    }
  }

  async function handleReject() {
    if (!id) return;
    if (!reason.trim()) {
      setError('Please provide a reason for rejection');
      return;
    }
    try {
      setLoading(true);
      await rejectWish(id, reason);
      navigate(`/wishes/${id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reject');
    } finally {
      setLoading(false);
    }
  }

  async function handleEnableVoting() {
    if (!id) return;
    try {
      setLoading(true);
      await enableVotingForWish(id, votingConfig);
      navigate(`/wishes/${id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to enable voting');
    } finally {
      setLoading(false);
    }
  }

  if (!wish) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  const label = isProposal ? 'Proposal' : 'Wish';

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 py-8">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>

        <div className="bg-white rounded-lg border border-gray-200 p-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-6">Respond to {label}</h1>

          <div className="mb-6 p-4 bg-gray-50 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <h2 className="font-semibold text-gray-900">{wish.title}</h2>
              {isProposal && (
                <span className="text-xs px-2 py-0.5 bg-teal-100 text-teal-700 rounded-full font-medium">
                  Proposal
                </span>
              )}
            </div>
            {wish.settlement_type && (
              <span className={`inline-block mt-2 text-xs px-2 py-0.5 rounded font-medium ${
                wish.settlement_type === 'full_settlement'
                  ? 'bg-green-100 text-green-700'
                  : 'bg-gray-200 text-gray-600'
              }`}>
                {wish.settlement_type === 'full_settlement' ? 'Full Settlement' : 'Partial Contribution'}
              </span>
            )}
            {wish.description && <p className="text-gray-600 text-sm mt-2">{wish.description}</p>}
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
              {error}
            </div>
          )}

          {!action && (
            <div className="space-y-4">
              <p className="text-gray-700 mb-6">
                Choose how you want to respond to this {label.toLowerCase()}:
              </p>

              <button
                onClick={() => setAction('accept')}
                className="w-full flex items-center gap-3 p-4 border-2 border-green-200 rounded-lg hover:bg-green-50 transition-colors"
              >
                <CheckCircle className="w-6 h-6 text-green-600" />
                <div className="text-left">
                  <div className="font-medium text-gray-900">Accept {label}</div>
                  <div className="text-sm text-gray-600">
                    {isProposal
                      ? 'Approve this proposal as a solution'
                      : 'Approve this and mark it as accepted'}
                  </div>
                </div>
              </button>

              <button
                onClick={() => setAction('voting')}
                className="w-full flex items-center gap-3 p-4 border-2 border-amber-200 rounded-lg hover:bg-amber-50 transition-colors"
              >
                <Vote className="w-6 h-6 text-amber-600" />
                <div className="text-left">
                  <div className="font-medium text-gray-900">Enable Community Voting</div>
                  <div className="text-sm text-gray-600">
                    Let the community decide through voting
                  </div>
                </div>
              </button>

              <button
                onClick={() => setAction('reject')}
                className="w-full flex items-center gap-3 p-4 border-2 border-red-200 rounded-lg hover:bg-red-50 transition-colors"
              >
                <XCircle className="w-6 h-6 text-red-600" />
                <div className="text-left">
                  <div className="font-medium text-gray-900">Reject {label}</div>
                  <div className="text-sm text-gray-600">
                    Decline this {label.toLowerCase()} with a reason
                  </div>
                </div>
              </button>
            </div>
          )}

          {action === 'accept' && (
            <div className="space-y-4">
              <h3 className="font-semibold text-gray-900">Accept {label}</h3>
              <div>
                <label
                  htmlFor="reason"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  Acceptance Message (Optional)
                </label>
                <textarea
                  id="reason"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={4}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  placeholder={`Add a message about why you're accepting this ${label.toLowerCase()}...`}
                />
              </div>

              {isProposal && parentWish && (
                <>
                  {parentTokenInfo.currentTokens > 0 && (
                    <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg space-y-4">
                      <div className="flex items-center gap-2 mb-3">
                        <Coins className="w-5 h-5 text-amber-600" />
                        <h4 className="font-semibold text-amber-900">Token Distribution</h4>
                      </div>

                      <div className="text-sm text-amber-800 space-y-1">
                        <p>Parent wish has <span className="font-semibold">{parentTokenInfo.currentTokens} WishCoins</span></p>
                        {parentTokenInfo.acceptedProposalsCount > 0 && (
                          <p className="text-amber-700">
                            {parentTokenInfo.acceptedProposalsCount} proposal(s) already accepted with {parentTokenInfo.tokensDistributed} tokens distributed
                          </p>
                        )}
                      </div>

                      <div className="space-y-3">
                        <label className="block text-sm font-medium text-amber-900">
                          How many tokens should be distributed to this proposal?
                        </label>

                        <div className="space-y-2">
                          <label className="flex items-start gap-2 cursor-pointer">
                            <input
                              type="radio"
                              name="tokenMode"
                              value="none"
                              checked={tokenDistributionMode === 'none'}
                              onChange={() => {
                                setTokenDistributionMode('none');
                                setTokenAmount(0);
                              }}
                              className="mt-0.5"
                            />
                            <div className="text-sm">
                              <div className="font-medium text-gray-900">No tokens (0 WishCoins)</div>
                              <div className="text-gray-600">Accept without distributing tokens</div>
                            </div>
                          </label>

                          <label className="flex items-start gap-2 cursor-pointer">
                            <input
                              type="radio"
                              name="tokenMode"
                              value="full"
                              checked={tokenDistributionMode === 'full'}
                              onChange={() => {
                                setTokenDistributionMode('full');
                                setTokenAmount(parentTokenInfo.currentTokens);
                                setCloseParent(true);
                              }}
                              className="mt-0.5"
                            />
                            <div className="text-sm">
                              <div className="font-medium text-gray-900">
                                Full fulfillment ({parentTokenInfo.currentTokens} WishCoins)
                              </div>
                              <div className="text-gray-600">
                                Distribute all tokens and close parent wish
                              </div>
                            </div>
                          </label>

                          <label className="flex items-start gap-2 cursor-pointer">
                            <input
                              type="radio"
                              name="tokenMode"
                              value="partial"
                              checked={tokenDistributionMode === 'partial'}
                              onChange={() => {
                                setTokenDistributionMode('partial');
                                setTokenAmount(0);
                              }}
                              className="mt-0.5"
                            />
                            <div className="text-sm">
                              <div className="font-medium text-gray-900">
                                Partial manual (max {parentTokenInfo.maxPerProposal} WishCoins)
                              </div>
                              <div className="text-gray-600">
                                Specify a custom amount up to 50% of available tokens
                              </div>
                            </div>
                          </label>

                          {parentTokenInfo.acceptedProposalsCount >= 0 && (
                            <label className="flex items-start gap-2 cursor-pointer">
                              <input
                                type="radio"
                                name="tokenMode"
                                value="equal"
                                checked={tokenDistributionMode === 'equal'}
                                onChange={() => {
                                  setTokenDistributionMode('equal');
                                  const equalAmount = calculateEqualSplitAmount(
                                    parentTokenInfo.currentTokens,
                                    parentTokenInfo.acceptedProposalsCount + 1
                                  );
                                  setTokenAmount(equalAmount);
                                }}
                                className="mt-0.5"
                              />
                              <div className="text-sm">
                                <div className="font-medium text-gray-900">
                                  Equal split (
                                  {calculateEqualSplitAmount(
                                    parentTokenInfo.currentTokens,
                                    parentTokenInfo.acceptedProposalsCount + 1
                                  )}{' '}
                                  WishCoins per proposal)
                                </div>
                                <div className="text-gray-600">
                                  Distribute equally among {parentTokenInfo.acceptedProposalsCount + 1} proposal(s)
                                </div>
                              </div>
                            </label>
                          )}
                        </div>

                        {tokenDistributionMode === 'partial' && (
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Token Amount
                            </label>
                            <input
                              type="number"
                              min="0"
                              max={parentTokenInfo.maxPerProposal}
                              value={tokenAmount}
                              onChange={(e) => setTokenAmount(parseInt(e.target.value) || 0)}
                              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                              placeholder="Enter amount (max 50%)"
                            />
                            <p className="mt-1 text-xs text-gray-500">
                              {tokenAmount > 0 && `${((tokenAmount / parentTokenInfo.currentTokens) * 100).toFixed(1)}% of available tokens`}
                            </p>
                          </div>
                        )}

                        {tokenAmount > 0 && (
                          <div className="p-3 bg-white rounded border border-amber-300">
                            <p className="text-xs font-medium text-amber-900 mb-2">Distribution Preview:</p>
                            <div className="text-xs text-gray-700 space-y-1">
                              <div className="flex justify-between">
                                <span>Tokens to proposal creator:</span>
                                <span className="font-semibold">{tokenAmount} WishCoins</span>
                              </div>
                              <div className="flex justify-between">
                                <span>Remaining on parent wish:</span>
                                <span className="font-semibold">
                                  {parentTokenInfo.currentTokens - tokenAmount} WishCoins
                                </span>
                              </div>
                            </div>
                            <p className="text-xs text-gray-600 mt-2">
                              Tokens will be distributed through the hierarchy (60%, 20%, 10%, 5%, 5%)
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    {wish.settlement_type && (
                      <p className="text-xs text-blue-700 mb-3">
                        The proposal creator marked this as a <span className="font-semibold">
                          {wish.settlement_type === 'full_settlement' ? 'Full Settlement' : 'Partial Contribution'}
                        </span>.
                      </p>
                    )}
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        id="close_parent"
                        checked={closeParent}
                        onChange={(e) => {
                          setCloseParent(e.target.checked);
                          if (!e.target.checked && tokenDistributionMode === 'full') {
                            setTokenDistributionMode('partial');
                            setTokenAmount(0);
                          }
                        }}
                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 mt-0.5"
                      />
                      <label htmlFor="close_parent" className="text-sm text-blue-900">
                        <span className="font-medium">Close parent wish as solved</span>
                        <br />
                        <span className="text-blue-700">
                          When checked, accepting this proposal will also mark the parent wish as
                          resolved. Uncheck to keep the parent wish open for additional proposals.
                        </span>
                      </label>
                    </div>
                  </div>
                </>
              )}

              <div className="flex gap-3">
                <button
                  onClick={handleAccept}
                  disabled={loading}
                  className="flex-1 px-6 py-3 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 disabled:opacity-50"
                >
                  {loading ? 'Processing...' : 'Confirm Accept'}
                </button>
                <button
                  onClick={() => { setAction(null); setReason(''); }}
                  className="px-6 py-3 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {action === 'reject' && (
            <div className="space-y-4">
              <h3 className="font-semibold text-gray-900">Reject {label}</h3>
              <div>
                <label
                  htmlFor="reason"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  Rejection Reason <span className="text-red-500">*</span>
                </label>
                <textarea
                  id="reason"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={4}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                  placeholder={`Explain why you're rejecting this ${label.toLowerCase()}...`}
                  required
                />
                <p className="mt-1 text-sm text-gray-500">
                  This reason will be visible to the {label.toLowerCase()} creator
                </p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={handleReject}
                  disabled={loading || !reason.trim()}
                  className="flex-1 px-6 py-3 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 disabled:opacity-50"
                >
                  {loading ? 'Processing...' : 'Confirm Reject'}
                </button>
                <button
                  onClick={() => { setAction(null); setReason(''); }}
                  className="px-6 py-3 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {action === 'voting' && (
            <div className="space-y-4">
              <h3 className="font-semibold text-gray-900">Enable Community Voting</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Required Votes
                  </label>
                  <input
                    type="number"
                    value={votingConfig.required_votes}
                    onChange={(e) =>
                      setVotingConfig({
                        ...votingConfig,
                        required_votes: parseInt(e.target.value),
                      })
                    }
                    min="1"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Approval Percentage Required
                  </label>
                  <input
                    type="number"
                    value={votingConfig.approval_percentage}
                    onChange={(e) =>
                      setVotingConfig({
                        ...votingConfig,
                        approval_percentage: parseFloat(e.target.value),
                      })
                    }
                    min="50"
                    max="100"
                    step="0.1"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Voting Duration (hours)
                  </label>
                  <input
                    type="number"
                    value={votingConfig.voting_duration_hours}
                    onChange={(e) =>
                      setVotingConfig({
                        ...votingConfig,
                        voting_duration_hours: parseInt(e.target.value),
                      })
                    }
                    min="1"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                  />
                </div>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={handleEnableVoting}
                  disabled={loading}
                  className="flex-1 px-6 py-3 bg-amber-600 text-white font-medium rounded-lg hover:bg-amber-700 disabled:opacity-50"
                >
                  {loading ? 'Processing...' : 'Enable Voting'}
                </button>
                <button
                  onClick={() => setAction(null)}
                  className="px-6 py-3 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
