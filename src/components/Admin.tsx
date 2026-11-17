import { useCallback, useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import type { LucideIcon } from 'lucide-react';

import {
  Activity,
  AlertCircle,
  BarChart3,
  BookOpen,
  Brain,
  Check,
  CheckCircle2,
  Clock,
  Cpu,
  Database,
  Eye,
  EyeOff,
  GraduationCap,
  LayoutDashboard,
  Loader2,
  LogIn,
  LogOut,
  Mail,
  MessageSquare,
  RefreshCw,
  Search,
  Server,
  Shield,
  ShieldCheck,
  Trash2,
  TrendingUp,
  UserCheck,
  Users,
  X,
  XCircle,
} from 'lucide-react';

import { api } from '@/lib/api';
import type { SharedKnowledge } from '@/lib/api';

type AdminSection =
  | 'overview'
  | 'pending'
  | 'approved'
  | 'users'
  | 'analytics'
  | 'health'
  | 'learning';

interface AdminUser {
  id: string;
  username: string;
  role: 'admin';
}

interface ManagedUser {
  id: string;
  email: string;
  status: string;
  createdAt: string | null;
  updatedAt: string | null;
}

interface UsersResponse {
  users: ManagedUser[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

interface ConversationAnalytics {
  summary: {
    totalChats: number;
    totalMessages: number;
    recentChats: number;
    recentMessages: number;
    totalUsers: number;
    periodDays: number;
  };
  dailyChats: Array<{ date: string; count: number }>;
  dailyMessages: Array<{ date: string; count: number }>;
  messageRoles: Array<{ role: string; count: number }>;
}

interface SystemHealth {
  application: string;
  status: string;
  services: {
    api: string;
    database: string;
    email: string;
    aiProvider: string;
    administratorAuthentication: string;
  };
  server: {
    uptimeSeconds: number;
    nodeVersion: string;
    platform: string;
    architecture: string;
    memory: {
      rssBytes: number;
      heapTotalBytes: number;
      heapUsedBytes: number;
      externalBytes: number;
    };
  };
  checkedAt: string;
}

interface LearningStatistics {
  personalLearning: {
    totalMemories: number;
    automaticallyLearned: number;
    manuallyCreated: number;
    categories: Array<{
      category: string;
      count: number;
    }>;
  };
  sharedLearning: {
    totalContributions: number;
    pending: number;
    approved: number;
    rejected: number;
    automaticallyDiscovered: number;
    manuallySubmitted: number;
  };
  checkedAt: string;
}

const EMPTY_ANALYTICS: ConversationAnalytics = {
  summary: {
    totalChats: 0,
    totalMessages: 0,
    recentChats: 0,
    recentMessages: 0,
    totalUsers: 0,
    periodDays: 30,
  },
  dailyChats: [],
  dailyMessages: [],
  messageRoles: [],
};

const EMPTY_LEARNING: LearningStatistics = {
  personalLearning: {
    totalMemories: 0,
    automaticallyLearned: 0,
    manuallyCreated: 0,
    categories: [],
  },
  sharedLearning: {
    totalContributions: 0,
    pending: 0,
    approved: 0,
    rejected: 0,
    automaticallyDiscovered: 0,
    manuallySubmitted: 0,
  },
  checkedAt: '',
};

const API_BASE_URL = (
  import.meta.env.VITE_API_URL || 'http://localhost:3000/api'
).replace(/\/+$/, '');

function getAdminToken(): string | null {
  return localStorage.getItem('nutterx_admin_token');
}

/**
 * Calls an administrator endpoint using the same admin token
 * used by the existing API authentication system.
 *
 * These requests use the actual backend paths:
 * /admin/system/health
 * /admin/learning/stats
 */
async function adminGet<T>(endpoint: string): Promise<T> {
  const token = getAdminToken();

  if (!token) {
    throw new Error('Your administrator session has expired. Please sign in again.');
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message =
      data?.error ||
      data?.message ||
      `Request failed with status ${response.status}.`;

    throw new Error(message);
  }

  return data as T;
}

function formatNumber(value: number | undefined): string {
  return Number(value || 0).toLocaleString();
}

function formatBytes(bytes: number | undefined): string {
  const value = Number(bytes || 0);

  if (value <= 0) return '0 MB';

  const megabytes = value / 1024 / 1024;

  if (megabytes >= 1024) {
    return `${(megabytes / 1024).toFixed(2)} GB`;
  }

  return `${megabytes.toFixed(1)} MB`;
}

function formatDuration(seconds: number | undefined): string {
  const total = Math.max(0, Math.floor(Number(seconds || 0)));

  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  const minutes = Math.floor((total % 3600) / 60);

  if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h ${minutes}m`;

  return `${minutes}m`;
}

function formatDate(value: string | null | undefined): string {
  if (!value) return 'Unavailable';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return 'Unavailable';

  return date.toLocaleDateString();
}

function serviceIsHealthy(value: string | undefined): boolean {
  const normalized = String(value || '').toLowerCase();

  return [
    'ok',
    'healthy',
    'connected',
    'configured',
    'active',
    'available',
    'operational',
    'running',
  ].includes(normalized);
}

function normalizeManagedUser(value: unknown): ManagedUser {
  const item = (value || {}) as Record<string, unknown>;

  return {
    id: String(item.id || item._id || ''),
    email: String(item.email || item.username || 'Unknown user'),
    status: String(item.status || 'active'),
    createdAt: item.createdAt ? String(item.createdAt) : null,
    updatedAt: item.updatedAt ? String(item.updatedAt) : null,
  };
}

export default function Admin() {
  const [user, setUser] = useState<AdminUser | null>(null);

  const [pending, setPending] = useState<SharedKnowledge[]>([]);
  const [approved, setApproved] = useState<SharedKnowledge[]>([]);

  const [activeSection, setActiveSection] =
    useState<AdminSection>('overview');

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [signingIn, setSigningIn] = useState(false);

  const [actionId, setActionId] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [authorized, setAuthorized] = useState(false);

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // User management.
  const [managedUsers, setManagedUsers] = useState<ManagedUser[]>([]);
  const [usersPage, setUsersPage] = useState(1);
  const [usersTotalPages, setUsersTotalPages] = useState(1);
  const [usersTotal, setUsersTotal] = useState(0);
  const [usersLoading, setUsersLoading] = useState(false);

  // Analytics.
  const [analytics, setAnalytics] =
    useState<ConversationAnalytics>(EMPTY_ANALYTICS);
  const [analyticsDays, setAnalyticsDays] = useState(30);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);

  // System health.
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [healthLoading, setHealthLoading] = useState(false);

  // Learning statistics.
  const [learning, setLearning] =
    useState<LearningStatistics>(EMPTY_LEARNING);
  const [learningLoading, setLearningLoading] = useState(false);

  // ---------------- LOAD KNOWLEDGE ----------------

  const loadKnowledge = useCallback(async () => {
    const [pendingItems, approvedItems] = await Promise.all([
      api.listPendingKnowledge(),
      api.listAdminApprovedKnowledge(),
    ]);

    setPending(pendingItems || []);
    setApproved(approvedItems || []);
  }, []);

  // ---------------- LOAD USERS ----------------

  const loadUsers = useCallback(async () => {
    setUsersLoading(true);

    try {
      const response = await api.listAdminUsers(
        usersPage,
        20,
        search.trim()
      );

      const result = response as unknown as UsersResponse;

      const normalizedUsers = Array.isArray(result.users)
        ? result.users.map(normalizeManagedUser)
        : [];

      setManagedUsers(normalizedUsers);
      setUsersTotal(Number(result.pagination?.total || 0));
      setUsersTotalPages(
        Math.max(1, Number(result.pagination?.totalPages || 1))
      );
    } finally {
      setUsersLoading(false);
    }
  }, [usersPage, search]);

  // ---------------- LOAD ANALYTICS ----------------

  const loadAnalytics = useCallback(async () => {
    setAnalyticsLoading(true);

    try {
      const response = await api.getConversationAnalytics(analyticsDays);

      const result = response as unknown as ConversationAnalytics;

      setAnalytics({
        summary: {
          ...EMPTY_ANALYTICS.summary,
          ...(result?.summary || {}),
        },
        dailyChats: Array.isArray(result?.dailyChats)
          ? result.dailyChats
          : [],
        dailyMessages: Array.isArray(result?.dailyMessages)
          ? result.dailyMessages
          : [],
        messageRoles: Array.isArray(result?.messageRoles)
          ? result.messageRoles
          : [],
      });
    } finally {
      setAnalyticsLoading(false);
    }
  }, [analyticsDays]);

  // ---------------- LOAD SYSTEM HEALTH ----------------

  const loadHealth = useCallback(async () => {
    setHealthLoading(true);

    try {
      // This is the actual route defined in server/index.js.
      const response = await adminGet<SystemHealth>(
        '/admin/system/health'
      );

      setHealth(response);
    } finally {
      setHealthLoading(false);
    }
  }, []);

  // ---------------- LOAD LEARNING STATISTICS ----------------

  const loadLearning = useCallback(async () => {
    setLearningLoading(true);

    try {
      // This is the actual route defined in server/index.js.
      const response = await adminGet<LearningStatistics>(
        '/admin/learning/stats'
      );

      setLearning({
        personalLearning: {
          ...EMPTY_LEARNING.personalLearning,
          ...(response?.personalLearning || {}),
          categories: Array.isArray(response?.personalLearning?.categories)
            ? response.personalLearning.categories
            : [],
        },
        sharedLearning: {
          ...EMPTY_LEARNING.sharedLearning,
          ...(response?.sharedLearning || {}),
        },
        checkedAt: response?.checkedAt || '',
      });
    } finally {
      setLearningLoading(false);
    }
  }, []);

  // ---------------- LOAD ACTIVE SECTION DATA ----------------

  const loadActiveSection = useCallback(async () => {
    if (!authorized) return;

    setError('');

    try {
      switch (activeSection) {
        case 'overview':
          await Promise.all([
            loadKnowledge(),
            loadAnalytics(),
          ]);
          break;

        case 'pending':
        case 'approved':
          await loadKnowledge();
          break;

        case 'users':
          await loadUsers();
          break;

        case 'analytics':
          await loadAnalytics();
          break;

        case 'health':
          await loadHealth();
          break;

        case 'learning':
          await loadLearning();
          break;
      }
    } catch (err) {
      console.error('Admin section loading failed:', err);

      setError(
        err instanceof Error
          ? err.message
          : 'Unable to load this administrator section.'
      );
    }
  }, [
    authorized,
    activeSection,
    loadKnowledge,
    loadAnalytics,
    loadUsers,
    loadHealth,
    loadLearning,
  ]);

  // ---------------- LOAD ADMIN SESSION ----------------

  const loadDashboard = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    setError('');
    setSuccess('');

    try {
      const currentUser = await api.adminGetMe();

      if (!currentUser) {
        setUser(null);
        setAuthorized(false);
        setPending([]);
        setApproved([]);
        return;
      }

      setUser(currentUser);
      setAuthorized(true);
    } catch (err) {
      console.error('Could not verify administrator session:', err);

      setAuthorized(false);
      setUser(null);
      setPending([]);
      setApproved([]);

      setError(
        err instanceof Error
          ? err.message
          : 'Unable to verify administrator access.'
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  // Load data when the administrator opens a section.
  useEffect(() => {
    if (!authorized) return;

    void loadActiveSection();
  }, [authorized, loadActiveSection]);

  // ---------------- ADMIN SIGN-IN ----------------

  const handleSignIn = async (
    event: FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();

    setError('');
    setSuccess('');

    const cleanUsername = username.trim();

    if (!cleanUsername || !password) {
      setError(
        'Please enter your administrator username and password.'
      );
      return;
    }

    setSigningIn(true);

    try {
      await api.adminSignIn(cleanUsername, password);

      const currentUser = await api.adminGetMe();

      if (!currentUser) {
        throw new Error(
          'Administrator authentication could not be verified.'
        );
      }

      setUser(currentUser);
      setAuthorized(true);
      setPassword('');
      setUsername(cleanUsername);
      setActiveSection('overview');

      setSuccess('Administrator signed in successfully.');
    } catch (err) {
      console.error('Administrator sign-in failed:', err);

      setUser(null);
      setAuthorized(false);

      setError(
        err instanceof Error
          ? err.message
          : 'Sign-in failed. Please check your credentials.'
      );
    } finally {
      setSigningIn(false);
      setLoading(false);
    }
  };

  // ---------------- SEARCH ----------------

  const filteredPending = useMemo(() => {
    const term = search.toLowerCase().trim();

    if (!term) return pending;

    return pending.filter(
      (item) =>
        item.title.toLowerCase().includes(term) ||
        item.content.toLowerCase().includes(term)
    );
  }, [pending, search]);

  const filteredApproved = useMemo(() => {
    const term = search.toLowerCase().trim();

    if (!term) return approved;

    return approved.filter(
      (item) =>
        item.title.toLowerCase().includes(term) ||
        item.content.toLowerCase().includes(term)
    );
  }, [approved, search]);

  // ---------------- APPROVE KNOWLEDGE ----------------

  const handleApprove = async (id: string) => {
    setActionId(id);
    setError('');
    setSuccess('');

    try {
      await api.approveKnowledge(id);

      setPending((items) =>
        items.filter((item) => item.id !== id)
      );

      setSuccess('Knowledge contribution approved successfully.');

      await loadKnowledge();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Approval failed.'
      );
    } finally {
      setActionId(null);
    }
  };

  // ---------------- REJECT KNOWLEDGE ----------------

  const handleReject = async (id: string) => {
    setActionId(id);
    setError('');
    setSuccess('');

    try {
      await api.rejectKnowledge(id);

      setPending((items) =>
        items.filter((item) => item.id !== id)
      );

      setSuccess('Knowledge contribution rejected.');

      await loadKnowledge();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Rejection failed.'
      );
    } finally {
      setActionId(null);
    }
  };

  // ---------------- DELETE KNOWLEDGE ----------------

  const handleDelete = async (id: string) => {
    const confirmed = window.confirm(
      'Are you sure you want to permanently delete this knowledge contribution?'
    );

    if (!confirmed) return;

    setActionId(id);
    setError('');
    setSuccess('');

    try {
      await api.deleteKnowledge(id);

      setPending((items) =>
        items.filter((item) => item.id !== id)
      );

      setApproved((items) =>
        items.filter((item) => item.id !== id)
      );

      setSuccess('Knowledge contribution deleted.');
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Deletion failed.'
      );
    } finally {
      setActionId(null);
    }
  };

  // ---------------- ADMIN SIGN-OUT ----------------

  const handleSignOut = async () => {
    try {
      await api.adminSignOut();
    } catch (err) {
      console.error('Admin sign-out error:', err);
    } finally {
      setUser(null);
      setAuthorized(false);
      setPending([]);
      setApproved([]);
      setManagedUsers([]);
      setHealth(null);
      setAnalytics(EMPTY_ANALYTICS);
      setLearning(EMPTY_LEARNING);
      setPassword('');
      setUsername('');
      setActiveSection('overview');
      setError('');
      setSuccess('');
    }
  };

  // ---------------- NAVIGATION ----------------

  const navigation: Array<{
    id: AdminSection;
    label: string;
    icon: LucideIcon;
    count?: number;
  }> = [
    {
      id: 'overview',
      label: 'Overview',
      icon: LayoutDashboard,
    },
    {
      id: 'users',
      label: 'User management',
      icon: Users,
    },
    {
      id: 'analytics',
      label: 'Conversation analytics',
      icon: BarChart3,
    },
    {
      id: 'health',
      label: 'System health',
      icon: Activity,
    },
    {
      id: 'learning',
      label: 'Learning statistics',
      icon: Brain,
    },
    {
      id: 'pending',
      label: 'Pending approvals',
      icon: Clock,
      count: pending.length,
    },
    {
      id: 'approved',
      label: 'Approved knowledge',
      icon: BookOpen,
    },
  ];

  // ---------------- LOADING SCREEN ----------------

  if (loading) {
    return (
      <div className="min-h-screen bg-[#09090f] text-white flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-9 h-9 animate-spin text-violet-400" />

          <p className="text-sm text-gray-400">
            Loading NUTTERX-AI Admin...
          </p>
        </div>
      </div>
    );
  }

  // ---------------- LOGIN SCREEN ----------------

  if (!user) {
    return (
      <div className="min-h-screen bg-[#09090f] text-white flex items-center justify-center p-5">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="w-16 h-16 rounded-2xl bg-violet-600 flex items-center justify-center mx-auto mb-5 shadow-lg shadow-violet-900/30">
              <ShieldCheck size={32} />
            </div>

            <h1 className="text-3xl font-bold tracking-tight">
              NUTTERX-AI
            </h1>

            <p className="text-gray-500 mt-2 text-sm">
              Administrator portal
            </p>
          </div>

          <div className="bg-[#12121c] border border-white/10 rounded-2xl p-6 sm:p-8 shadow-2xl">
            <div className="mb-6">
              <h2 className="text-xl font-semibold">
                Administrator sign in
              </h2>

              <p className="text-sm text-gray-500 mt-2">
                Enter your administrator username and password.
              </p>
            </div>

            {error && (
              <Notice
                type="error"
                message={error}
                onDismiss={() => setError('')}
              />
            )}

            <form onSubmit={handleSignIn} className="space-y-5">
              <div>
                <label
                  htmlFor="admin-username"
                  className="block text-sm font-medium text-gray-300 mb-2"
                >
                  Admin username
                </label>

                <input
                  id="admin-username"
                  type="text"
                  autoComplete="username"
                  required
                  value={username}
                  onChange={(event) =>
                    setUsername(event.target.value)
                  }
                  placeholder="Enter admin username"
                  disabled={signingIn}
                  className="w-full bg-[#09090f] border border-white/10 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-violet-500/60 transition placeholder:text-gray-600 disabled:opacity-50"
                />
              </div>

              <div>
                <label
                  htmlFor="admin-password"
                  className="block text-sm font-medium text-gray-300 mb-2"
                >
                  Admin password
                </label>

                <div className="relative">
                  <input
                    id="admin-password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(event) =>
                      setPassword(event.target.value)
                    }
                    placeholder="Enter admin password"
                    disabled={signingIn}
                    className="w-full bg-[#09090f] border border-white/10 rounded-xl px-4 py-3 pr-12 text-sm text-white outline-none focus:border-violet-500/60 transition placeholder:text-gray-600 disabled:opacity-50"
                  />

                  <button
                    type="button"
                    onClick={() =>
                      setShowPassword((value) => !value)
                    }
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-gray-500 hover:text-white transition"
                    aria-label={
                      showPassword
                        ? 'Hide password'
                        : 'Show password'
                    }
                  >
                    {showPassword ? (
                      <EyeOff size={18} />
                    ) : (
                      <Eye size={18} />
                    )}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={signingIn}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-violet-600 hover:bg-violet-500 py-3.5 font-semibold text-sm transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {signingIn ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    Verifying administrator...
                  </>
                ) : (
                  <>
                    <LogIn size={18} />
                    Sign in to Admin
                  </>
                )}
              </button>
            </form>

            <div className="mt-6 pt-5 border-t border-white/10">
              <div className="flex items-center justify-center gap-2 text-xs text-gray-500">
                <Shield size={14} />
                <span>Protected administrator access</span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              window.location.href = '/';
            }}
            className="w-full mt-6 text-sm text-gray-500 hover:text-white transition"
          >
            Return to NUTTERX-AI
          </button>
        </div>
      </div>
    );
  }

  // ---------------- ACCESS DENIED ----------------

  if (!authorized) {
    return (
      <div className="min-h-screen bg-[#09090f] text-white flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-[#12121c] border border-white/10 rounded-2xl p-8 text-center">
          <Shield className="w-14 h-14 text-red-400 mx-auto mb-5" />

          <h1 className="text-2xl font-bold mb-3">
            Admin access required
          </h1>

          <p className="text-gray-400 text-sm mb-3">
            Your administrator session could not be authorized.
          </p>

          <p className="text-red-300 text-sm mb-6 break-words">
            {error ||
              'Your session is not authorized to access this dashboard.'}
          </p>

          <div className="space-y-3">
            <button
              type="button"
              onClick={() => void handleSignOut()}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-violet-600 hover:bg-violet-500 py-3 font-semibold transition"
            >
              <LogOut size={17} />
              Sign out
            </button>

            <button
              type="button"
              onClick={() => {
                window.location.href = '/';
              }}
              className="w-full rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 py-3 font-medium transition"
            >
              Return to NUTTERX-AI
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ---------------- ADMIN DASHBOARD ----------------

  return (
    <div className="min-h-screen bg-[#09090f] text-white flex">
      <aside className="w-64 shrink-0 bg-[#10101a] border-r border-white/10 hidden md:flex flex-col">
        <div className="p-6 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-violet-600 flex items-center justify-center">
              <Brain className="w-6 h-6" />
            </div>

            <div>
              <h1 className="font-bold text-lg tracking-tight">
                NUTTERX-AI
              </h1>

              <p className="text-xs text-gray-500">
                Administration
              </p>
            </div>
          </div>
        </div>

        <div className="px-4 py-6">
          <p className="text-[10px] uppercase tracking-[0.2em] text-gray-500 font-semibold px-3 mb-3">
            Management
          </p>

          <nav className="space-y-2">
            {navigation.map((item) => {
              const Icon = item.icon;
              const active = activeSection === item.id;

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setActiveSection(item.id);
                    setSearch('');
                    setError('');
                  }}
                  className={`w-full flex items-center justify-between gap-3 px-3 py-3 rounded-xl text-sm transition ${
                    active
                      ? 'bg-violet-600/20 text-violet-300 border border-violet-500/20'
                      : 'text-gray-400 hover:bg-white/5 hover:text-white'
                  }`}
                >
                  <span className="flex items-center gap-3 text-left">
                    <Icon size={18} />
                    {item.label}
                  </span>

                  {item.count !== undefined && (
                    <span className="text-xs bg-violet-500/20 text-violet-300 px-2 py-1 rounded-full">
                      {item.count}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        <div className="mt-auto p-4 border-t border-white/10">
          <div className="flex items-center gap-3 px-2 mb-4">
            <div className="w-9 h-9 rounded-full bg-violet-600/20 flex items-center justify-center">
              <ShieldCheck
                size={18}
                className="text-violet-400"
              />
            </div>

            <div className="min-w-0">
              <p className="text-sm font-medium truncate">
                Administrator
              </p>

              <p className="text-xs text-gray-500 truncate">
                @{user.username}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => void handleSignOut()}
            className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition"
          >
            <LogOut size={18} />
            Sign out
          </button>
        </div>
      </aside>

      <main className="flex-1 min-w-0">
        <header className="min-h-16 px-5 md:px-8 py-3 border-b border-white/10 flex items-center justify-between bg-[#10101a]/80 gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="md:hidden w-9 h-9 rounded-lg bg-violet-600 flex items-center justify-center shrink-0">
              <Brain size={20} />
            </div>

            <div className="min-w-0">
              <h2 className="font-semibold truncate">
                {navigation.find(
                  (item) => item.id === activeSection
                )?.label || 'Dashboard'}
              </h2>

              <p className="text-xs text-gray-500 hidden sm:block">
                Manage your NUTTERX-AI platform
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <span className="hidden sm:flex items-center gap-2 text-xs text-green-400">
              <span className="w-2 h-2 rounded-full bg-green-400" />
              Admin authorized
            </span>

            <button
              type="button"
              onClick={() => {
                void loadDashboard(true).then(() => {
                  if (getAdminToken()) {
                    void loadActiveSection();
                  }
                });
              }}
              disabled={refreshing}
              className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 transition disabled:opacity-50"
              title="Refresh dashboard"
            >
              <RefreshCw
                size={17}
                className={refreshing ? 'animate-spin' : ''}
              />
            </button>

            <button
              type="button"
              onClick={() => void handleSignOut()}
              className="md:hidden p-2.5 rounded-xl bg-white/5 hover:bg-white/10"
              title="Sign out"
            >
              <LogOut size={17} />
            </button>
          </div>
        </header>

        <div className="md:hidden flex gap-2 p-3 overflow-x-auto border-b border-white/10">
          {navigation.map((item) => {
            const Icon = item.icon;

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setActiveSection(item.id);
                  setSearch('');
                  setError('');
                }}
                className={`flex items-center gap-2 whitespace-nowrap px-3 py-2 rounded-lg text-xs ${
                  activeSection === item.id
                    ? 'bg-violet-600/20 text-violet-300'
                    : 'bg-white/5 text-gray-400'
                }`}
              >
                <Icon size={15} />
                {item.label}
              </button>
            );
          })}
        </div>

        <div className="p-5 md:p-8 max-w-7xl mx-auto">
          {error && (
            <Notice
              type="error"
              message={error}
              onDismiss={() => setError('')}
            />
          )}

          {success && (
            <Notice
              type="success"
              message={success}
              onDismiss={() => setSuccess('')}
            />
          )}

          {/* OVERVIEW */}

          {activeSection === 'overview' && (
            <div className="space-y-8">
              <div>
                <h1 className="text-2xl md:text-3xl font-bold">
                  Welcome to Admin
                </h1>

                <p className="text-gray-400 mt-2 text-sm">
                  Monitor platform activity, manage users, and review shared AI knowledge.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                <StatCard
                  title="Total users"
                  value={formatNumber(analytics.summary.totalUsers)}
                  icon={Users}
                  color="text-blue-400"
                  description="Registered platform users"
                />

                <StatCard
                  title="Total conversations"
                  value={formatNumber(analytics.summary.totalChats)}
                  icon={MessageSquare}
                  color="text-violet-400"
                  description="Recorded conversations"
                />

                <StatCard
                  title="Total messages"
                  value={formatNumber(analytics.summary.totalMessages)}
                  icon={Activity}
                  color="text-cyan-400"
                  description="Recorded message count"
                />

                <StatCard
                  title="Pending approvals"
                  value={formatNumber(pending.length)}
                  icon={Clock}
                  color="text-amber-400"
                  description="Awaiting moderator review"
                />
              </div>

              <div className="grid lg:grid-cols-2 gap-5">
                <section className="bg-[#12121c] border border-white/10 rounded-2xl p-5 md:p-6">
                  <div className="flex items-center justify-between mb-5">
                    <div>
                      <h3 className="font-semibold text-lg">
                        Administration
                      </h3>

                      <p className="text-sm text-gray-500 mt-1">
                        Platform management tools
                      </p>
                    </div>

                    <ShieldCheck className="text-violet-400" size={25} />
                  </div>

                  <div className="space-y-4">
                    <StatusRow
                      icon={Users}
                      label="User management"
                      description="View registered accounts and account status."
                    />

                    <StatusRow
                      icon={BarChart3}
                      label="Conversation analytics"
                      description="Monitor aggregate conversation activity."
                    />

                    <StatusRow
                      icon={Server}
                      label="System health"
                      description="Check database, email, and AI provider configuration."
                    />

                    <StatusRow
                      icon={Brain}
                      label="Global learning statistics"
                      description="Monitor learning totals without exposing private memory contents."
                    />
                  </div>
                </section>

                <section className="bg-[#12121c] border border-white/10 rounded-2xl p-5 md:p-6">
                  <h3 className="font-semibold text-lg mb-5">
                    Knowledge management
                  </h3>

                  <div className="grid sm:grid-cols-2 gap-4">
                    <button
                      type="button"
                      onClick={() => setActiveSection('pending')}
                      className="text-left p-5 rounded-xl bg-amber-500/5 border border-amber-500/20 hover:bg-amber-500/10 transition"
                    >
                      <Clock className="text-amber-400 mb-3" size={24} />

                      <h4 className="font-semibold">
                        Review submissions
                      </h4>

                      <p className="text-sm text-gray-400 mt-1">
                        {pending.length} contribution(s) awaiting review.
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() => setActiveSection('approved')}
                      className="text-left p-5 rounded-xl bg-green-500/5 border border-green-500/20 hover:bg-green-500/10 transition"
                    >
                      <CheckCircle2 className="text-green-400 mb-3" size={24} />

                      <h4 className="font-semibold">
                        Approved knowledge
                      </h4>

                      <p className="text-sm text-gray-400 mt-1">
                        {approved.length} approved contribution(s).
                      </p>
                    </button>
                  </div>
                </section>
              </div>

              <section className="bg-[#12121c] border border-white/10 rounded-2xl p-5 md:p-6">
                <h3 className="font-semibold mb-4">
                  Platform capabilities
                </h3>

                <div className="grid sm:grid-cols-2 gap-5">
                  <StatusRow
                    icon={Brain}
                    label="Automatic personal learning"
                    description="Individual memories remain private to their owners."
                  />

                  <StatusRow
                    icon={Users}
                    label="Shared knowledge discovery"
                    description="General knowledge candidates can be submitted for review."
                  />

                  <StatusRow
                    icon={ShieldCheck}
                    label="Knowledge approval"
                    description="Only approved knowledge is available for shared AI context."
                  />

                  <StatusRow
                    icon={Activity}
                    label="Backend authorization"
                    description="Administrator actions are checked by the server."
                  />
                </div>
              </section>
            </div>
          )}

          {/* USER MANAGEMENT */}

          {activeSection === 'users' && (
            <div className="space-y-6">
              <SectionHeading
                title="User management"
                description="View registered users and their account status. Private conversations and personal memories are not displayed here."
              />

              <div className="grid sm:grid-cols-2 gap-4">
                <StatCard
                  title="Registered users"
                  value={formatNumber(usersTotal)}
                  icon={Users}
                  color="text-blue-400"
                  description="Total matching accounts"
                />

                <StatCard
                  title="Current page"
                  value={`${usersPage} / ${usersTotalPages}`}
                  icon={Database}
                  color="text-violet-400"
                  description="User list pagination"
                />
              </div>

              <SearchBar
                value={search}
                onChange={(value) => {
                  setSearch(value);
                  setUsersPage(1);
                }}
                placeholder="Search users by email..."
              />

              {usersLoading ? (
                <LoadingPanel label="Loading users..." />
              ) : managedUsers.length === 0 ? (
                <EmptyState
                  icon={Users}
                  title="No users found"
                  description="No registered users match this search."
                />
              ) : (
                <div className="bg-[#12121c] border border-white/10 rounded-2xl overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                      <thead className="bg-white/5 text-gray-400">
                        <tr>
                          <th className="px-5 py-4 font-medium">User</th>
                          <th className="px-5 py-4 font-medium">Status</th>
                          <th className="px-5 py-4 font-medium">Created</th>
                        </tr>
                      </thead>

                      <tbody>
                        {managedUsers.map((managedUser) => (
                          <tr
                            key={managedUser.id}
                            className="border-t border-white/5"
                          >
                            <td className="px-5 py-4">
                              <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-full bg-violet-500/10 flex items-center justify-center">
                                  <Users size={16} className="text-violet-400" />
                                </div>

                                <span className="text-gray-200 break-all">
                                  {managedUser.email}
                                </span>
                              </div>
                            </td>

                            <td className="px-5 py-4">
                              <StatusBadge status={managedUser.status} />
                            </td>

                            <td className="px-5 py-4 text-gray-400 whitespace-nowrap">
                              {formatDate(managedUser.createdAt)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="flex items-center justify-between gap-3 p-4 border-t border-white/10">
                    <p className="text-xs text-gray-500">
                      {formatNumber(usersTotal)} users
                    </p>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={usersPage <= 1 || usersLoading}
                        onClick={() =>
                          setUsersPage((page) => Math.max(1, page - 1))
                        }
                        className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm disabled:opacity-40"
                      >
                        Previous
                      </button>

                      <span className="text-xs text-gray-400">
                        {usersPage} / {usersTotalPages}
                      </span>

                      <button
                        type="button"
                        disabled={
                          usersPage >= usersTotalPages || usersLoading
                        }
                        onClick={() =>
                          setUsersPage((page) =>
                            Math.min(usersTotalPages, page + 1)
                          )
                        }
                        className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm disabled:opacity-40"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* CONVERSATION ANALYTICS */}

          {activeSection === 'analytics' && (
            <div className="space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <SectionHeading
                  title="Conversation analytics"
                  description="Aggregate usage statistics. Message contents and private conversation titles are not displayed."
                />

                <select
                  value={analyticsDays}
                  onChange={(event) =>
                    setAnalyticsDays(Number(event.target.value))
                  }
                  className="bg-[#12121c] border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-violet-500"
                >
                  <option value={7}>Last 7 days</option>
                  <option value={30}>Last 30 days</option>
                  <option value={90}>Last 90 days</option>
                  <option value={365}>Last 365 days</option>
                </select>
              </div>

              {analyticsLoading ? (
                <LoadingPanel label="Loading conversation analytics..." />
              ) : (
                <>
                  <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
                    <StatCard
                      title="Total conversations"
                      value={formatNumber(analytics.summary.totalChats)}
                      icon={MessageSquare}
                      color="text-violet-400"
                      description="All recorded conversations"
                    />

                    <StatCard
                      title="Total messages"
                      value={formatNumber(analytics.summary.totalMessages)}
                      icon={Activity}
                      color="text-cyan-400"
                      description="All recorded messages"
                    />

                    <StatCard
                      title="Registered users"
                      value={formatNumber(analytics.summary.totalUsers)}
                      icon={Users}
                      color="text-blue-400"
                      description="Total platform users"
                    />

                    <StatCard
                      title="Recent conversations"
                      value={formatNumber(analytics.summary.recentChats)}
                      icon={TrendingUp}
                      color="text-green-400"
                      description={`Within ${analyticsDays} days`}
                    />

                    <StatCard
                      title="Recent messages"
                      value={formatNumber(analytics.summary.recentMessages)}
                      icon={MessageSquare}
                      color="text-amber-400"
                      description={`Within ${analyticsDays} days`}
                    />

                    <StatCard
                      title="Reporting period"
                      value={`${analyticsDays} days`}
                      icon={Clock}
                      color="text-violet-400"
                      description="Selected analytics window"
                    />
                  </div>

                  <div className="grid lg:grid-cols-2 gap-5">
                    <DailyChart
                      title="Daily conversations"
                      data={analytics.dailyChats}
                    />

                    <DailyChart
                      title="Daily messages"
                      data={analytics.dailyMessages}
                    />
                  </div>

                  <section className="bg-[#12121c] border border-white/10 rounded-2xl p-5 md:p-6">
                    <h3 className="font-semibold mb-5">
                      Message role distribution
                    </h3>

                    {analytics.messageRoles.length === 0 ? (
                      <p className="text-sm text-gray-500">
                        No role statistics available.
                      </p>
                    ) : (
                      <div className="space-y-4">
                        {analytics.messageRoles.map((item) => {
                          const total = analytics.messageRoles.reduce(
                            (sum, entry) => sum + entry.count,
                            0
                          );

                          const percentage =
                            total > 0
                              ? (item.count / total) * 100
                              : 0;

                          return (
                            <div key={item.role}>
                              <div className="flex justify-between text-sm mb-2">
                                <span className="text-gray-300 capitalize">
                                  {item.role}
                                </span>

                                <span className="text-gray-400">
                                  {formatNumber(item.count)} · {percentage.toFixed(1)}%
                                </span>
                              </div>

                              <div className="h-2 rounded-full bg-white/5 overflow-hidden">
                                <div
                                  className="h-full bg-violet-500 rounded-full"
                                  style={{
                                    width: `${percentage}%`,
                                  }}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </section>
                </>
              )}
            </div>
          )}

          {/* SYSTEM HEALTH */}

          {activeSection === 'health' && (
            <div className="space-y-6">
              <SectionHeading
                title="System health"
                description="Monitor backend service configuration and server runtime information."
              />

              {healthLoading ? (
                <LoadingPanel label="Checking system health..." />
              ) : !health ? (
                <EmptyState
                  icon={Server}
                  title="Health information unavailable"
                  description="The system health endpoint did not return information. Check the error message above."
                />
              ) : (
                <>
                  <div className="bg-[#12121c] border border-white/10 rounded-2xl p-5 md:p-6">
                    <div className="flex flex-wrap items-center justify-between gap-4">
                      <div>
                        <p className="text-sm text-gray-400">
                          Overall application status
                        </p>

                        <h3 className="text-2xl font-bold mt-2">
                          {health.status || 'Unknown'}
                        </h3>

                        <p className="text-xs text-gray-500 mt-2">
                          Last checked: {formatDate(health.checkedAt)}
                        </p>
                      </div>

                      <StatusBadge status={health.status} />
                    </div>
                  </div>

                  <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
                    <HealthCard
                      icon={Activity}
                      title="API"
                      value={health.services?.api}
                    />

                    <HealthCard
                      icon={Database}
                      title="Database"
                      value={health.services?.database}
                    />

                    <HealthCard
                      icon={Mail}
                      title="Email"
                      value={health.services?.email}
                    />

                    <HealthCard
                      icon={Brain}
                      title="AI provider"
                      value={health.services?.aiProvider}
                    />

                    <HealthCard
                      icon={ShieldCheck}
                      title="Admin authentication"
                      value={health.services?.administratorAuthentication}
                    />
                  </div>

                  <p className="text-xs text-gray-500">
                    The AI provider status reflects the backend's configuration check; it does not necessarily confirm that the external AI service is reachable.
                  </p>

                  <section className="bg-[#12121c] border border-white/10 rounded-2xl p-5 md:p-6">
                    <h3 className="font-semibold mb-5">
                      Server information
                    </h3>

                    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
                      <InfoItem
                        label="Application"
                        value={health.application}
                      />

                      <InfoItem
                        label="Node version"
                        value={health.server?.nodeVersion}
                      />

                      <InfoItem
                        label="Platform"
                        value={`${health.server?.platform || 'Unavailable'} · ${health.server?.architecture || 'Unavailable'}`}
                      />

                      <InfoItem
                        label="Uptime"
                        value={formatDuration(health.server?.uptimeSeconds)}
                      />

                      <InfoItem
                        label="Memory used"
                        value={formatBytes(health.server?.memory?.heapUsedBytes)}
                      />

                      <InfoItem
                        label="Memory allocated"
                        value={formatBytes(health.server?.memory?.heapTotalBytes)}
                      />

                      <InfoItem
                        label="Resident memory"
                        value={formatBytes(health.server?.memory?.rssBytes)}
                      />

                      <InfoItem
                        label="External memory"
                        value={formatBytes(health.server?.memory?.externalBytes)}
                      />
                    </div>
                  </section>
                </>
              )}
            </div>
          )}

          {/* GLOBAL LEARNING STATISTICS */}

          {activeSection === 'learning' && (
            <div className="space-y-6">
              <SectionHeading
                title="Global learning statistics"
                description="Monitor learning totals and categories without displaying private memory content."
              />

              {learningLoading ? (
                <LoadingPanel label="Loading learning statistics..." />
              ) : (
                <>
                  <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
                    <StatCard
                      title="Personal memories"
                      value={formatNumber(learning.personalLearning.totalMemories)}
                      icon={Brain}
                      color="text-violet-400"
                      description="Total private memory records"
                    />

                    <StatCard
                      title="Automatically learned"
                      value={formatNumber(learning.personalLearning.automaticallyLearned)}
                      icon={Cpu}
                      color="text-cyan-400"
                      description="Automatically created memories"
                    />

                    <StatCard
                      title="Manually created"
                      value={formatNumber(learning.personalLearning.manuallyCreated)}
                      icon={UserCheck}
                      color="text-blue-400"
                      description="Manually created memories"
                    />

                    <StatCard
                      title="Shared contributions"
                      value={formatNumber(learning.sharedLearning.totalContributions)}
                      icon={BookOpen}
                      color="text-green-400"
                      description="Total shared knowledge candidates"
                    />

                    <StatCard
                      title="Pending contributions"
                      value={formatNumber(learning.sharedLearning.pending)}
                      icon={Clock}
                      color="text-amber-400"
                      description="Awaiting moderator review"
                    />

                    <StatCard
                      title="Approved contributions"
                      value={formatNumber(learning.sharedLearning.approved)}
                      icon={CheckCircle2}
                      color="text-green-400"
                      description="Approved shared knowledge"
                    />
                  </div>

                  <div className="grid lg:grid-cols-2 gap-5">
                    <section className="bg-[#12121c] border border-white/10 rounded-2xl p-5 md:p-6">
                      <h3 className="font-semibold mb-5">
                        Personal learning categories
                      </h3>

                      {learning.personalLearning.categories.length === 0 ? (
                        <p className="text-sm text-gray-500">
                          No category statistics available.
                        </p>
                      ) : (
                        <div className="space-y-4">
                          {learning.personalLearning.categories.map(
                            (category) => (
                              <div
                                key={category.category}
                                className="flex items-center justify-between gap-4"
                              >
                                <span className="text-sm text-gray-300 capitalize">
                                  {category.category}
                                </span>

                                <span className="text-sm font-semibold text-violet-300">
                                  {formatNumber(category.count)}
                                </span>
                              </div>
                            )
                          )}
                        </div>
                      )}
                    </section>

                    <section className="bg-[#12121c] border border-white/10 rounded-2xl p-5 md:p-6">
                      <h3 className="font-semibold mb-5">
                        Shared learning status
                      </h3>

                      <div className="space-y-4">
                        <LearningRow
                          icon={CheckCircle2}
                          label="Approved"
                          value={learning.sharedLearning.approved}
                          color="text-green-400"
                        />

                        <LearningRow
                          icon={Clock}
                          label="Pending"
                          value={learning.sharedLearning.pending}
                          color="text-amber-400"
                        />

                        <LearningRow
                          icon={XCircle}
                          label="Rejected"
                          value={learning.sharedLearning.rejected}
                          color="text-red-400"
                        />

                        <LearningRow
                          icon={Cpu}
                          label="Automatically discovered"
                          value={learning.sharedLearning.automaticallyDiscovered}
                          color="text-cyan-400"
                        />

                        <LearningRow
                          icon={GraduationCap}
                          label="Manually submitted"
                          value={learning.sharedLearning.manuallySubmitted}
                          color="text-violet-400"
                        />
                      </div>
                    </section>
                  </div>
                </>
              )}
            </div>
          )}

          {/* PENDING KNOWLEDGE */}

          {activeSection === 'pending' && (
            <div className="space-y-6">
              <SectionHeading
                title="Pending approvals"
                description="Review submissions before they become shared AI knowledge."
              />

              <SearchBar
                value={search}
                onChange={setSearch}
                placeholder="Search pending submissions..."
              />

              {filteredPending.length === 0 ? (
                <EmptyState
                  icon={CheckCircle2}
                  title="No pending submissions"
                  description={
                    search
                      ? 'No submissions match your search.'
                      : 'All caught up! There are no submissions awaiting approval.'
                  }
                />
              ) : (
                <div className="space-y-4">
                  {filteredPending.map((item) => (
                    <KnowledgeCard
                      key={item.id}
                      item={item}
                      actionId={actionId}
                      onApprove={handleApprove}
                      onReject={handleReject}
                      onDelete={handleDelete}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* APPROVED KNOWLEDGE */}

          {activeSection === 'approved' && (
            <div className="space-y-6">
              <SectionHeading
                title="Approved knowledge"
                description="Knowledge entries approved for shared AI use."
              />

              <SearchBar
                value={search}
                onChange={setSearch}
                placeholder="Search approved knowledge..."
              />

              {filteredApproved.length === 0 ? (
                <EmptyState
                  icon={BookOpen}
                  title="No approved knowledge found"
                  description={
                    search
                      ? 'No entries match your search.'
                      : 'Approved shared knowledge will appear here.'
                  }
                />
              ) : (
                <div className="space-y-4">
                  {filteredApproved.map((item) => (
                    <KnowledgeCard
                      key={item.id}
                      item={item}
                      actionId={actionId}
                      approved
                      onDelete={handleDelete}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

// ---------------- NOTICE ----------------

function Notice({
  type,
  message,
  onDismiss,
}: {
  type: 'error' | 'success';
  message: string;
  onDismiss: () => void;
}) {
  const isSuccess = type === 'success';

  return (
    <div
      className={`mb-6 flex items-start gap-3 p-4 rounded-xl border ${
        isSuccess
          ? 'bg-green-500/10 border-green-500/20 text-green-300'
          : 'bg-red-500/10 border-red-500/20 text-red-300'
      }`}
    >
      {isSuccess ? (
        <CheckCircle2 size={19} className="shrink-0 mt-0.5" />
      ) : (
        <AlertCircle size={19} className="shrink-0 mt-0.5" />
      )}

      <p className="text-sm break-words flex-1">
        {message}
      </p>

      <button
        type="button"
        onClick={onDismiss}
        className="shrink-0"
        aria-label="Dismiss notification"
      >
        <X size={17} />
      </button>
    </div>
  );
}

// ---------------- SECTION HEADING ----------------

function SectionHeading({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div>
      <h1 className="text-2xl md:text-3xl font-bold">
        {title}
      </h1>

      <p className="text-sm text-gray-400 mt-2">
        {description}
      </p>
    </div>
  );
}

// ---------------- STAT CARD ----------------

function StatCard({
  title,
  value,
  icon: Icon,
  color,
  description,
}: {
  title: string;
  value: string | number;
  icon: LucideIcon;
  color: string;
  description: string;
}) {
  return (
    <div className="bg-[#12121c] border border-white/10 rounded-2xl p-5">
      <div className="flex items-center justify-between mb-5">
        <p className="text-sm text-gray-400">{title}</p>

        <Icon size={21} className={color} />
      </div>

      <p className="text-3xl font-bold">{value}</p>

      <p className="text-xs text-gray-500 mt-2">
        {description}
      </p>
    </div>
  );
}

// ---------------- STATUS ROW ----------------

function StatusRow({
  icon: Icon,
  label,
  description,
}: {
  icon: LucideIcon;
  label: string;
  description: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="w-9 h-9 rounded-lg bg-violet-500/10 flex items-center justify-center shrink-0">
        <Icon size={18} className="text-violet-400" />
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">{label}</p>

        <p className="text-xs text-gray-500 mt-1">
          {description}
        </p>
      </div>

      <CheckCircle2
        size={17}
        className="text-green-400 shrink-0"
      />
    </div>
  );
}

// ---------------- SEARCH BAR ----------------

function SearchBar({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <div className="relative">
      <Search
        size={18}
        className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500"
      />

      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="w-full bg-[#12121c] border border-white/10 rounded-xl py-3 pl-11 pr-4 text-sm outline-none focus:border-violet-500/50 transition placeholder:text-gray-600"
      />
    </div>
  );
}

// ---------------- STATUS BADGE ----------------

function StatusBadge({
  status,
}: {
  status: string;
}) {
  const healthy = serviceIsHealthy(status);

  return (
    <span
      className={`inline-flex items-center gap-2 text-xs px-3 py-1.5 rounded-full border ${
        healthy
          ? 'text-green-400 bg-green-500/10 border-green-500/20'
          : 'text-amber-400 bg-amber-500/10 border-amber-500/20'
      }`}
    >
      <span
        className={`w-1.5 h-1.5 rounded-full ${
          healthy ? 'bg-green-400' : 'bg-amber-400'
        }`}
      />

      {status || 'Unknown'}
    </span>
  );
}

// ---------------- HEALTH CARD ----------------

function HealthCard({
  icon: Icon,
  title,
  value,
}: {
  icon: LucideIcon;
  title: string;
  value: string | undefined;
}) {
  return (
    <div className="bg-[#12121c] border border-white/10 rounded-2xl p-5">
      <div className="flex items-center justify-between gap-3 mb-4">
        <p className="text-sm text-gray-400">{title}</p>

        <Icon size={20} className="text-violet-400" />
      </div>

      <StatusBadge status={value || 'Unknown'} />
    </div>
  );
}

// ---------------- INFO ITEM ----------------

function InfoItem({
  label,
  value,
}: {
  label: string;
  value: string | undefined;
}) {
  return (
    <div>
      <p className="text-xs text-gray-500 mb-1">
        {label}
      </p>

      <p className="text-sm text-gray-200 break-words">
        {value || 'Unavailable'}
      </p>
    </div>
  );
}

// ---------------- LEARNING ROW ----------------

function LearningRow({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: LucideIcon;
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        <Icon size={17} className={color} />

        <span className="text-sm text-gray-300">
          {label}
        </span>
      </div>

      <span className="text-sm font-semibold">
        {formatNumber(value)}
      </span>
    </div>
  );
}

// ---------------- DAILY CHART ----------------

function DailyChart({
  title,
  data,
}: {
  title: string;
  data: Array<{ date: string; count: number }>;
}) {
  const maximum = Math.max(
    1,
    ...data.map((item) => Number(item.count || 0))
  );

  return (
    <section className="bg-[#12121c] border border-white/10 rounded-2xl p-5 md:p-6">
      <h3 className="font-semibold mb-6">
        {title}
      </h3>

      {data.length === 0 ? (
        <p className="text-sm text-gray-500">
          No daily data available.
        </p>
      ) : (
        <div className="space-y-4">
          {data.slice(-14).map((item) => {
            const percentage =
              (Number(item.count || 0) / maximum) * 100;

            return (
              <div key={item.date}>
                <div className="flex justify-between text-xs mb-2 gap-3">
                  <span className="text-gray-400">
                    {formatDate(item.date)}
                  </span>

                  <span className="text-gray-200 font-medium">
                    {formatNumber(item.count)}
                  </span>
                </div>

                <div className="h-2 rounded-full bg-white/5 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-violet-500"
                    style={{
                      width: `${percentage}%`,
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

// ---------------- LOADING PANEL ----------------

function LoadingPanel({
  label,
}: {
  label: string;
}) {
  return (
    <div className="bg-[#12121c] border border-white/10 rounded-2xl p-12 flex flex-col items-center justify-center gap-4">
      <Loader2 className="w-8 h-8 text-violet-400 animate-spin" />

      <p className="text-sm text-gray-400">
        {label}
      </p>
    </div>
  );
}

// ---------------- KNOWLEDGE CARD ----------------

function KnowledgeCard({
  item,
  actionId,
  approved = false,
  onApprove,
  onReject,
  onDelete,
}: {
  item: SharedKnowledge;
  actionId: string | null;
  approved?: boolean;
  onApprove?: (id: string) => void;
  onReject?: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const busy = actionId === item.id;

  return (
    <article className="bg-[#12121c] border border-white/10 rounded-2xl p-5 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <span
          className={`text-xs px-3 py-1.5 rounded-full border ${
            approved
              ? 'text-green-400 bg-green-500/10 border-green-500/20'
              : 'text-amber-400 bg-amber-500/10 border-amber-500/20'
          }`}
        >
          {approved ? 'Approved' : 'Pending review'}
        </span>

        <span className="text-xs text-gray-500">
          {item.createdAt
            ? new Date(item.createdAt).toLocaleString()
            : 'Date unavailable'}
        </span>
      </div>

      <h3 className="text-lg font-semibold mb-3">
        {item.title}
      </h3>

      <p className="text-sm text-gray-400 leading-7 whitespace-pre-wrap break-words">
        {item.content}
      </p>

      {item.approvedAt && (
        <p className="text-xs text-gray-500 mt-4">
          Approved: {new Date(item.approvedAt).toLocaleString()}
        </p>
      )}

      <div className="flex flex-wrap gap-3 mt-6 pt-5 border-t border-white/10">
        {!approved && onApprove && (
          <button
            type="button"
            onClick={() => onApprove(item.id)}
            disabled={busy || actionId !== null}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-green-600 hover:bg-green-500 text-sm font-medium transition disabled:opacity-50"
          >
            {busy ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Check size={16} />
            )}

            Approve
          </button>
        )}

        {!approved && onReject && (
          <button
            type="button"
            onClick={() => onReject(item.id)}
            disabled={busy || actionId !== null}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 text-sm transition disabled:opacity-50"
          >
            <XCircle size={16} />
            Reject
          </button>
        )}

        <button
          type="button"
          onClick={() => onDelete(item.id)}
          disabled={busy || actionId !== null}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-gray-400 hover:text-red-400 hover:bg-red-500/10 text-sm transition disabled:opacity-50"
        >
          <Trash2 size={16} />
          Delete
        </button>
      </div>
    </article>
  );
}

// ---------------- EMPTY STATE ----------------

function EmptyState({
  icon: Icon,
  title,
  description,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
}) {
  return (
    <div className="bg-[#12121c] border border-white/10 rounded-2xl p-12 text-center">
      <div className="w-14 h-14 rounded-2xl bg-violet-500/10 flex items-center justify-center mx-auto mb-5">
        <Icon size={26} className="text-violet-400" />
      </div>

      <h3 className="font-semibold text-lg">
        {title}
      </h3>

      <p className="text-sm text-gray-500 mt-2 max-w-sm mx-auto">
        {description}
      </p>
    </div>
  );
}