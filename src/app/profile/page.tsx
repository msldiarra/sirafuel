'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { Toast, ToastContainer, type ToastType } from '@/components/ui/Toast'
import { getRoleLabel } from '@/lib/utils'
import type { UserProfile } from '@/lib/supabase/types'

interface ToastItem {
  id: string
  type: ToastType
  message: string
}

export default function ProfilePage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [showPasswordForm, setShowPasswordForm] = useState(false)
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  })
  const [changingPassword, setChangingPassword] = useState(false)
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const supabase = createClient()

  const showToast = useCallback((type: ToastType, message: string) => {
    const id = Math.random().toString(36).substring(7)
    setToasts((prev) => [...prev, { id, type, message }])
  }, [])

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  useEffect(() => {
    loadProfile()
  }, [])

  async function loadProfile() {
    try {
      const {
        data: { user: currentUser },
      } = await supabase.auth.getUser()

      if (!currentUser) {
        router.push('/login')
        return
      }

      const { data: profileData } = await supabase
        .from('user_profile')
        .select('*')
        .eq('auth_user_id', currentUser.id)
        .single()

      // Redirect to onboarding if must_change_password is true
      if (profileData?.must_change_password) {
        router.push('/onboarding')
        return
      }

      setUser(currentUser)
      setProfile(profileData)
    } catch (err) {
      console.error('Error loading profile:', err)
    } finally {
      setLoading(false)
    }
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/')
  }

  async function handleChangePassword() {
    // Validation
    if (!passwordData.currentPassword || !passwordData.newPassword || !passwordData.confirmPassword) {
      showToast('warning', 'Veuillez remplir tous les champs')
      return
    }

    if (passwordData.newPassword.length < 6) {
      showToast('warning', 'Le nouveau mot de passe doit contenir au moins 6 caractères')
      return
    }

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      showToast('warning', 'Les mots de passe ne correspondent pas')
      return
    }

    if (passwordData.currentPassword === passwordData.newPassword) {
      showToast('warning', 'Le nouveau mot de passe doit être différent de l\'ancien')
      return
    }

    setChangingPassword(true)

    try {
      // First, verify current password by attempting to sign in
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: passwordData.currentPassword,
      })

      if (signInError) {
        showToast('error', 'Mot de passe actuel incorrect')
        return
      }

      // Update password
      const { error: updateError } = await supabase.auth.updateUser({
        password: passwordData.newPassword,
      })

      if (updateError) {
        throw updateError
      }

      showToast('success', 'Mot de passe modifié avec succès !')
      setPasswordData({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      })
      setShowPasswordForm(false)
    } catch (err: any) {
      console.error('Error changing password:', err)
      showToast('error', `Erreur lors du changement: ${err.message || 'Erreur inconnue'}`)
    } finally {
      setChangingPassword(false)
    }
  }

  const canChangePassword = profile?.role === 'TRUSTED_REPORTER' || profile?.role === 'STATION_MANAGER'

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-gray-400">Chargement...</div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-900">
        <EmptyState
          icon="👤"
          title="Non connecté"
          description="Connectez-vous pour accéder à votre profil"
          actionLabel="Se connecter"
          onAction={() => router.push('/login')}
        />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-900 pb-20">
      <ToastContainer toasts={toasts} onRemove={removeToast} />

      <header className="bg-gray-800 text-white sticky top-0 z-40 shadow-lg border-b-2 border-gray-700">
        <div className="px-4 py-3">
          <h1 className="text-2xl font-bold tracking-tight">Mon Profil</h1>
        </div>
      </header>

      <main className="px-4 py-4 space-y-4">
        <Card className="p-5 bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700 animate-slide-in-up">
          <div className="mb-4">
            <h2 className="text-xl font-bold text-white">{user.email}</h2>
            {profile && (
              <div className="text-sm text-gray-300 mt-1">
                {getRoleLabel(profile.role)}
                {profile.is_verified && (
                  <span className="ml-2 px-2 py-0.5 bg-green-600 text-white text-xs rounded">
                    Vérifié
                  </span>
                )}
              </div>
            )}
          </div>

          {profile && (
            <div className="space-y-2 text-sm pt-4 border-t-2 border-gray-700">
              <div className="flex justify-between">
                <span className="text-gray-400">Rôle:</span>
                <span className="font-medium text-white">{getRoleLabel(profile.role)}</span>
              </div>
              {profile.station_id && (
                <div className="flex justify-between">
                  <span className="text-gray-400">Station assignée:</span>
                  <span className="font-medium text-white">Oui</span>
                </div>
              )}
            </div>
          )}
        </Card>

        {/* Change Password Section - Premium */}
        {canChangePassword && (
          <Card className="p-5 bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700 animate-slide-in-up">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-lg text-white">CHANGER LE MOT DE PASSE</h3>
              {!showPasswordForm && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowPasswordForm(true)}
                >
                  Modifier
                </Button>
              )}
            </div>

            {showPasswordForm && (
              <div className="space-y-4 animate-scale-in">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Mot de passe actuel
                  </label>
                  <input
                    type="password"
                    value={passwordData.currentPassword}
                    onChange={(e) =>
                      setPasswordData({ ...passwordData, currentPassword: e.target.value })
                    }
                    className="w-full px-4 py-2 bg-gray-700 border-2 border-gray-600 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-teal focus:border-primary-teal transition-all"
                    placeholder="Entrez votre mot de passe actuel"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Nouveau mot de passe
                  </label>
                  <input
                    type="password"
                    value={passwordData.newPassword}
                    onChange={(e) =>
                      setPasswordData({ ...passwordData, newPassword: e.target.value })
                    }
                    className="w-full px-4 py-2 bg-gray-700 border-2 border-gray-600 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-teal focus:border-primary-teal transition-all"
                    placeholder="Au moins 6 caractères"
                  />
                  <p className="text-xs text-gray-400 mt-1">
                    Le mot de passe doit contenir au moins 6 caractères
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Confirmer le nouveau mot de passe
                  </label>
                  <input
                    type="password"
                    value={passwordData.confirmPassword}
                    onChange={(e) =>
                      setPasswordData({ ...passwordData, confirmPassword: e.target.value })
                    }
                    className="w-full px-4 py-2 bg-gray-700 border-2 border-gray-600 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-teal focus:border-primary-teal transition-all"
                    placeholder="Confirmez votre nouveau mot de passe"
                  />
                </div>

                <div className="flex gap-3 pt-2">
                  <Button
                    variant="primary"
                    fullWidth
                    onClick={handleChangePassword}
                    disabled={changingPassword}
                    className="hover-glow transition-all"
                  >
                    {changingPassword ? (
                      <span className="flex items-center justify-center gap-2">
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        Modification...
                      </span>
                    ) : (
                      'CONFIRMER'
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowPasswordForm(false)
                      setPasswordData({
                        currentPassword: '',
                        newPassword: '',
                        confirmPassword: '',
                      })
                    }}
                    disabled={changingPassword}
                  >
                    Annuler
                  </Button>
                </div>
              </div>
            )}
          </Card>
        )}

        <div className="space-y-3">
          {!profile && (
            <Card className="p-4">
              <p className="text-sm text-gray-400 mb-3">
                Votre profil n'est pas encore créé. Contactez un administrateur pour obtenir un rôle.
              </p>
            </Card>
          )}

          {profile?.role === 'ADMIN' && (
            <Button
              variant="primary"
              fullWidth
              onClick={() => router.push('/admin')}
            >
              ADMINISTRATION
            </Button>
          )}

          <Button variant="outline" fullWidth onClick={handleLogout}>
            SE DÉCONNECTER
          </Button>
        </div>
      </main>
    </div>
  )
}

