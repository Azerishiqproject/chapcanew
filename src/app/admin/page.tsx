'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { logoutUser } from '@/store/slices/authSlice';
import {
  fetchUsers,
  createUserAction,
  updateUserAction,
  removeUser,
  clearError as clearUsersError,
  resetUsers
} from '@/store/slices/usersSlice';
import type { User } from '@/lib/users';
import { Timestamp } from 'firebase/firestore'; // Added Timestamp import
import { ThemeToggle } from '@/components/ThemeToggle';
import {
  UserPlus,
  Users as UsersIcon,
  LogOut,
  Edit3,
  Trash2,
  Search,
  Shield,
  Phone,
  Mail,
  Calendar,
  ChevronRight,
  Plus,
  RefreshCw,
  X,
  User as UserIcon
} from 'lucide-react';

export default function AdminPage() {
  const dispatch = useAppDispatch();
  const { user: currentUser, isAuthenticated, isAdmin, isLoading: authLoading } = useAppSelector((state) => state.auth);
  const { users, isLoading: usersLoading, error: usersError, hasMore, lastDoc } = useAppSelector((state) => state.users);
  const router = useRouter();

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const formatDateTime = (timestamp: Timestamp): string => {
    const date = timestamp.toDate();
    return date.toLocaleString('az-AZ', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    phone: '',
    status: 'user' as 'admin' | 'user',
  });

  const [mounted, setMounted] = useState(false);

  const pageSize = 12;

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted && !isAuthenticated && !authLoading) {
      router.push('/login');
    }
  }, [isAuthenticated, authLoading, router, mounted]);

  useEffect(() => {
    if (mounted && isAuthenticated && isAdmin) {
      dispatch(resetUsers());
      dispatch(fetchUsers({ pageSize }));
    } else if (mounted && isAuthenticated && !isAdmin) {
      router.push('/');
    }
  }, [isAuthenticated, isAdmin, dispatch, router, mounted]);

  const handleLoadMore = () => {
    if (hasMore && !usersLoading) {
      dispatch(fetchUsers({ pageSize, lastDoc }));
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    dispatch(clearUsersError());

    const result = await dispatch(createUserAction({
      email: formData.email,
      password: formData.password,
      name: formData.name,
      phone: formData.phone,
      status: formData.status,
    }));

    if (createUserAction.fulfilled.match(result)) {
      setShowCreateForm(false);
      setFormData({ name: '', email: '', password: '', phone: '', status: 'user' });
    }
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser?.id) return;

    dispatch(clearUsersError());

    const result = await dispatch(updateUserAction({
      userId: editingUser.id,
      userData: {
        name: formData.name,
        email: formData.email,
        phone: formData.phone,
        status: formData.status,
      },
    }));

    if (updateUserAction.fulfilled.match(result)) {
      setEditingUser(null);
      setFormData({ name: '', email: '', password: '', phone: '', status: 'user' });
      setShowCreateForm(false);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!confirm('Bu istifadəçini silmək istədiyinizə əminsiniz?')) {
      return;
    }

    dispatch(clearUsersError());
    await dispatch(removeUser(userId));
  };

  const handleEditClick = (user: User) => {
    setEditingUser(user);
    setFormData({
      name: user.name,
      email: user.email,
      password: '',
      phone: user.phone || '',
      status: user.status,
    });
    setShowCreateForm(true);
  };

  const handleLogout = async () => {
    await dispatch(logoutUser());
    router.push('/login');
  };

  if (!mounted || authLoading || (!users.length && usersLoading)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a]">
        <div className="text-center">
          <div className="relative w-16 h-16 mx-auto">
            <div className="absolute inset-0 border-4 border-[#00965e]/20 rounded-full"></div>
            <div className="absolute inset-0 border-4 border-t-[#00965e] rounded-full animate-spin"></div>
          </div>
          <p className="mt-6 text-white/50 font-medium tracking-widest uppercase text-[11px]">Admin Panel yüklənir...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !isAdmin || !currentUser) {
    return null;
  }

  return (
    <div className="min-h-screen relative overflow-hidden font-sans bg-[#0a0a0a] text-white">
      {/* Background */}
      <div
        className="fixed inset-0 z-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: "url('/bgimage2.jpg')" }}
      >
        <div className="absolute inset-0 bg-black/85 backdrop-blur-[2px]"></div>
      </div>

      <div className="relative z-10 flex flex-col min-h-screen">
        {/* Header */}
        <header className="px-8 py-5 border-b border-white/5 backdrop-blur-xl bg-white/5 sticky top-0 z-50">
          <div className="max-w-7xl mx-auto flex justify-between items-center">
            <div className="flex items-center gap-6">
              <button
                onClick={() => router.push('/')}
                className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 hover:border-[#00965e]/50 transition-all group"
              >
                <ChevronRight size={20} className="rotate-180 group-hover:-translate-x-1 transition-transform" />
              </button>
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-gradient-to-tr from-[#00965e] to-[#4fbfa3] rounded-xl flex items-center justify-center shadow-lg">
                  <Shield className="text-white w-6 h-6" />
                </div>
                <div>
                  <h1 className="text-xl font-black uppercase tracking-tight">Admin Terminal</h1>
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-[#00965e] animate-pulse"></div>
                    <span className="text-[10px] font-black text-[#00965e] uppercase tracking-[2px] opacity-80">Sistem İdarəetmə</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-6">
              <div className="hidden lg:flex flex-col text-right">
                <span className="text-[11px] font-black uppercase text-[#00965e] tracking-widest">Aktiv Admin</span>
                <span className="text-[13px] font-bold text-white/70">{currentUser.email}</span>
              </div>
              <div className="flex items-center gap-4">
                <ThemeToggle />
                <button
                  onClick={handleLogout}
                  className="h-10 px-4 rounded-xl bg-white/5 border border-white/10 flex items-center gap-2 text-[13px] font-bold text-white/70 hover:bg-red-500/10 hover:border-red-500/50 hover:text-red-400 transition-all"
                >
                  <LogOut size={18} />
                  <span className="hidden sm:inline">Çıxış</span>
                </button>
              </div>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="max-w-7xl mx-auto w-full px-8 py-12 flex flex-col gap-10">

          {/* Dashboard Stats & Actions */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-8">
            <div className="flex items-center gap-8">
              <div className="flex flex-col">
                <h2 className="text-4xl font-black uppercase tracking-tighter mb-1 italic">İstifadəçi Portalı</h2>
                <div className="flex items-center gap-4">
                  <span className="text-white/40 text-[12px] font-black tracking-[2px] uppercase">{users.length} qeydiyyatlı profil</span>
                  <div className="h-1 w-1 rounded-full bg-white/20"></div>
                  <span className="text-[#00965e] text-[12px] font-black tracking-[2px] uppercase">Online Access</span>
                </div>
              </div>
            </div>

            <button
              onClick={() => {
                setShowCreateForm(!showCreateForm);
                setEditingUser(null);
                setFormData({ name: '', email: '', password: '', phone: '', status: 'user' });
              }}
              className={`group px-10 py-5 rounded-[24px] flex items-center gap-3 font-black uppercase tracking-widest text-[13px] transition-all duration-300 active:scale-95 ${showCreateForm ? 'bg-white/5 border border-white/10 text-white/60 hover:bg-white/10' : 'bg-gradient-to-r from-[#00965e] to-[#4fbfa3] text-white shadow-2xl shadow-[#00965e]/30 hover:shadow-[#00965e]/50'}`}
            >
              {showCreateForm ? <X size={20} /> : <Plus size={20} className="text-white bg-white/20 rounded-lg p-0.5" />}
              {showCreateForm ? 'Prosesi Ləğv et' : 'Yeni İstifadəçi Əlavə et'}
            </button>
          </div>

          {/* Form Overlay/Section */}
          {showCreateForm && (
            <section className="animate-in fade-in zoom-in-95 duration-500">
              <div className="bg-white/5 backdrop-blur-[40px] rounded-[40px] border border-white/10 p-12 shadow-2xl relative overflow-hidden group/form">
                <div className="absolute top-0 right-0 w-64 h-64 bg-[#00965e]/10 rounded-full blur-[100px] -mr-32 -mt-32"></div>
                <div className="absolute bottom-0 left-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-[100px] -ml-32 -mb-32"></div>

                <div className="relative z-10">
                  <div className="flex items-center gap-4 mb-10">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#00965e] to-[#4fbfa3] flex items-center justify-center">
                      {editingUser ? <Edit3 size={24} className="text-white" /> : <UserPlus size={24} className="text-white" />}
                    </div>
                    <div>
                      <h3 className="text-2xl font-black uppercase tracking-tight">
                        {editingUser ? 'İstifadəçi Məlumatlarını Yenilə' : 'Yeni Hesab Konfiqurasiyası'}
                      </h3>
                      <p className="text-[11px] font-black text-white/30 uppercase tracking-[2px]">Tələb olunan xanaları doldurun</p>
                    </div>
                  </div>

                  <form onSubmit={editingUser ? handleUpdateUser : handleCreateUser} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
                    <div className="space-y-3">
                      <label className="text-[11px] font-black text-[#00965e] uppercase tracking-[3px] ml-1">Tam Ad Soyad</label>
                      <input
                        type="text"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        className="w-full px-6 py-5 bg-white/5 border border-white/10 rounded-[24px] outline-none focus:border-[#00965e]/60 focus:bg-white/10 transition-all font-bold placeholder:text-white/10"
                        required
                        placeholder="Məs: Əli Məmmədov"
                      />
                    </div>

                    <div className="space-y-3">
                      <label className="text-[11px] font-black text-[#00965e] uppercase tracking-[3px] ml-1">E-poçt (Verifikasiya)</label>
                      <input
                        type="email"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        className="w-full px-6 py-5 bg-white/5 border border-white/10 rounded-[24px] outline-none focus:border-[#00965e]/60 focus:bg-white/10 transition-all font-bold disabled:opacity-30 placeholder:text-white/10"
                        required
                        disabled={!!editingUser}
                        placeholder="example@portal.az"
                      />
                    </div>

                    {!editingUser && (
                      <div className="space-y-3">
                        <label className="text-[11px] font-black text-[#00965e] uppercase tracking-[3px] ml-1">Təhlükəsizlik Şifrəsi</label>
                        <input
                          type="password"
                          value={formData.password}
                          onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                          className="w-full px-6 py-5 bg-white/5 border border-white/10 rounded-[24px] outline-none focus:border-[#00965e]/60 focus:bg-white/10 transition-all font-bold placeholder:text-white/10"
                          required
                          minLength={6}
                          placeholder="Min. 6 simvol"
                        />
                      </div>
                    )}

                    <div className="space-y-3">
                      <label className="text-[11px] font-black text-[#00965e] uppercase tracking-[3px] ml-1">Əlaqə Nömrəsi</label>
                      <input
                        type="tel"
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        className="w-full px-6 py-5 bg-white/5 border border-white/10 rounded-[24px] outline-none focus:border-[#00965e]/60 focus:bg-white/10 transition-all font-bold placeholder:text-white/10"
                        placeholder="+994 -- --- -- --"
                      />
                    </div>

                    <div className="space-y-3">
                      <label className="text-[11px] font-black text-[#00965e] uppercase tracking-[3px] ml-1">Səlahiyyət Rejimi</label>
                      <select
                        value={formData.status}
                        onChange={(e) => setFormData({ ...formData, status: e.target.value as 'admin' | 'user' })}
                        className="w-full px-6 py-5 bg-white/5 border border-white/10 rounded-[24px] outline-none focus:border-[#00965e]/60 focus:bg-white/10 transition-all font-bold appearance-none cursor-pointer"
                      >
                        <option value="user" className="bg-[#1a1a1a]">Standart İstifadəçi (User)</option>
                        <option value="admin" className="bg-[#1a1a1a]">Sistem Administrator (Admin)</option>
                      </select>
                    </div>

                    <div className="flex items-end">
                      <button
                        type="submit"
                        disabled={usersLoading}
                        className="w-full px-10 py-5 bg-gradient-to-r from-[#00965e] to-[#4fbfa3] text-white font-black uppercase tracking-widest text-[14px] rounded-[24px] shadow-2xl shadow-[#00965e]/30 hover:shadow-[#00965e]/50 active:scale-95 transition-all disabled:opacity-50"
                      >
                        {usersLoading ? (
                          <div className="flex items-center justify-center gap-2">
                            <RefreshCw size={18} className="animate-spin" />
                            <span>Gözləyin...</span>
                          </div>
                        ) : editingUser ? 'Məlumatları Təsdiqlə' : 'İstifadəçini Sisteminə Yarad'}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            </section>
          )}

          {/* Users Grid/List */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
            {users.map((user) => (
              <div
                key={user.id}
                className="group relative bg-white/5 backdrop-blur-xl rounded-[32px] border border-white/10 p-6 hover:bg-white/[0.08] hover:border-[#00965e]/40 transition-all duration-500 flex flex-col cursor-pointer overflow-hidden"
                onClick={() => router.push(`/admin/users/${encodeURIComponent(user.email)}`)}
              >
                {/* Decorative background element */}
                <div className={`absolute top-0 right-0 w-24 h-24 blur-[40px] opacity-20 -mr-12 -mt-12 transition-all duration-500 group-hover:opacity-40 ${user.status === 'admin' ? 'bg-purple-500' : 'bg-[#00965e]'}`}></div>

                <div className="flex justify-between items-start mb-6 relative z-10">
                  <div className={`w-12 h-12 rounded-[16px] flex items-center justify-center shadow-lg transition-transform duration-500 group-hover:scale-110 ${user.status === 'admin' ? 'bg-gradient-to-br from-purple-500 to-indigo-600 text-white' : 'bg-gradient-to-br from-[#00965e] to-[#4fbfa3] text-white'}`}>
                    {user.status === 'admin' ? <Shield size={22} /> : <UserIcon size={22} />}
                  </div>
                  <div className="flex gap-2 translate-y-[-5px] sm:translate-y-0 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-all duration-300">
                    <button
                      onClick={(e) => { e.stopPropagation(); handleEditClick(user); }}
                      className="p-2.5 rounded-[12px] bg-white/5 border border-white/5 hover:bg-white/10 hover:border-white/20 text-white/40 hover:text-white transition-all shadow-xl"
                    >
                      <Edit3 size={16} />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); if (user.id) handleDeleteUser(user.id); }}
                      className="p-2.5 rounded-[12px] bg-white/5 border border-white/5 hover:bg-red-500/10 hover:border-red-500/30 text-white/40 hover:text-red-400 transition-all shadow-xl"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>

                <div className="flex-1 relative z-10">
                  <div className={`text-[9px] font-black uppercase tracking-[2px] mb-1.5 ${user.status === 'admin' ? 'text-purple-400' : 'text-[#00965e]'}`}>
                    {user.status === 'admin' ? 'Administrator' : 'İstifadəçi'}
                  </div>
                  <h4 className="text-[18px] font-black uppercase tracking-tight mb-1 truncate text-white/90 group-hover:text-white transition-colors">{user.name}</h4>

                  <div className="space-y-2.5 mt-4">
                    <div className="flex items-center gap-2.5 text-white/40 group-hover:text-white/60 transition-colors">
                      <div className="w-7 h-7 rounded-lg bg-white/5 flex items-center justify-center">
                        <Mail size={12} className="text-[#00965e]" />
                      </div>
                      <span className="text-[12px] font-bold truncate">{user.email}</span>
                    </div>
                    {user.phone && (
                      <div className="flex items-center gap-2.5 text-white/40 group-hover:text-white/60 transition-colors">
                        <div className="w-7 h-7 rounded-lg bg-white/5 flex items-center justify-center">
                          <Phone size={12} className="text-[#00965e]" />
                        </div>
                        <span className="text-[12px] font-bold">{user.phone}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2.5 text-white/40 group-hover:text-white/60 transition-colors">
                      <div className="w-7 h-7 rounded-lg bg-white/5 flex items-center justify-center">
                        <Calendar size={12} className="text-[#00965e]" />
                      </div>
                      <span className="text-[11px] font-bold uppercase tracking-widest">{user.createdAt ? new Date(user.createdAt).toLocaleDateString('az-AZ') : '--.--.----'}</span>
                    </div>
                  </div>
                </div>

                <div className="mt-6 pt-5 border-t border-white/5 flex items-center justify-between relative z-10">
                  <span className="text-[10px] font-black text-white/20 uppercase tracking-[2px] group-hover:text-[#00965e] transition-colors italic">Detallar</span>
                  <div className="w-7 h-7 rounded-full bg-white/5 flex items-center justify-center group-hover:bg-[#00965e] transition-all group-hover:translate-x-1">
                    <ChevronRight size={16} className="text-white/20 group-hover:text-white" />
                  </div>
                </div>
              </div>
            ))}

            {/* Empty State */}
            {users.length === 0 && !usersLoading && (
              <div className="col-span-full py-32 bg-white/5 backdrop-blur-xl rounded-[32px] border border-white/10 border-dashed flex flex-col items-center justify-center">
                <UsersIcon size={48} className="text-white/10 mb-6" />
                <p className="text-white/40 font-black uppercase tracking-[4px]">Hələki heç bir istifadəçi tapılmadı</p>
              </div>
            )}
          </div>

          {/* Load More Section */}
          {hasMore && (
            <div className="flex justify-center mt-6">
              <button
                onClick={handleLoadMore}
                disabled={usersLoading}
                className="flex items-center gap-3 px-10 py-5 rounded-2xl bg-white/5 border border-white/10 text-[13px] font-black uppercase tracking-widest hover:bg-white/10 hover:border-[#00965e]/50 transition-all disabled:opacity-30 group"
              >
                {usersLoading ? (
                  <RefreshCw size={18} className="animate-spin text-[#00965e]" />
                ) : (
                  <Plus size={18} className="group-hover:rotate-90 transition-all text-[#00965e]" />
                )}
                {usersLoading ? 'Yüklənir...' : 'Daha çox yüklə'}
              </button>
            </div>
          )}

        </main>

        {/* Footer */}
        <footer className="px-8 py-10 border-t border-white/5 flex justify-center items-center mt-auto">
          <div className="flex flex-col items-center text-center">
            <span className="text-[11px] font-black text-white/20 uppercase tracking-[4px] mb-2">MİDA Administrator Control</span>
            <span className="text-[10px] font-bold text-white/5 uppercase tracking-widest italic font-sans italic">Secure Cloud Access & User Management v4.0.5</span>
          </div>
        </footer>
      </div>
    </div>
  );
}
