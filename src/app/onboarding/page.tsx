'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'

export default function OnboardingPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [formData, setFormData] = useState({
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
  })
  const [errors, setErrors] = useState<Record<string, string>>({})

  const supabase = createClient()

  useEffect(() => {
    checkAuth()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function checkAuth() {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        router.push('/login')
        return
      }

      const { data: profile } = await supabase
        .from('user_profile')
        .select('*')
        .eq('auth_user_id', user.id)
        .single()

      if (!profile) {
        router.push('/')
        return
      }

      // Only show onboarding if must_change_password is true
      if (!profile.must_change_password) {
        router.push('/profile')
        return
      }

      setFormData((prev) => ({ ...prev, email: user.email || '' }))
      setLoading(false)
    } catch (err) {
      console.error('Error checking auth:', err)
      router.push('/login')
    }
  }

  function validateForm() {
    const newErrors: Record<string, string> = {}

    if (!formData.email.trim()) {
      newErrors.email = 'Email requis'
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Email invalide'
    }

    if (formData.phone && !/^\+?[0-9]{8,15}$/.test(formData.phone.replace(/\s/g, ''))) {
      newErrors.phone = 'Numéro de téléphone invalide'
    }

    if (!formData.password) {
      newErrors.password = 'Mot de passe requis'
    } else if (formData.password.length < 8) {
      newErrors.password = 'Le mot de passe doit contenir au moins 8 caractères'
    } else if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(formData.password)) {
      newErrors.password = 'Le mot de passe doit contenir au moins une majuscule, une minuscule et un chiffre'
    }

    if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Les mots de passe ne correspondent pas'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!validateForm()) {
      return
    }

    try {
      setSubmitting(true)

      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        throw new Error('Utilisateur non trouvé')
      }

      // Update password
      const { error: passwordError } = await supabase.auth.updateUser({
        password: formData.password,
      })

      if (passwordError) throw passwordError

      // Update profile with email and phone
      const { error: profileError } = await supabase
        .from('user_profile')
        .update({
          email_or_phone: formData.email,
          must_change_password: false,
        })
        .eq('auth_user_id', user.id)

      if (profileError) {
        throw new Error(`Erreur de mise à jour du profil: ${profileError.message}`)
      }

      // Update auth email if changed
      if (formData.email !== user.email) {
        const { error: emailError } = await supabase.auth.updateUser({
          email: formData.email,
        })
        if (emailError) throw emailError
      }

      // Redirect to profile page
      router.push('/profile')
    } catch (err: any) {
      console.error('Error updating profile:', err)
      setErrors({ submit: err.message || 'Erreur lors de la mise à jour' })
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-gray-400">Chargement...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center px-4 pb-20">
      <Card className="w-full max-w-md p-6">
        <h1 className="text-2xl font-bold text-white mb-2">Bienvenue !</h1>
        <p className="text-gray-300 mb-6">
          Veuillez compléter vos informations et définir votre mot de passe
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-1">
              Email *
            </label>
            <input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              required
              className="w-full px-4 py-2 bg-gray-700 border-2 border-gray-600 text-white rounded-lg focus:ring-2 focus:ring-primary-teal focus:border-primary-teal placeholder-gray-400"
              placeholder="votre@email.com"
            />
            {errors.email && <p className="text-red-400 text-xs mt-1">{errors.email}</p>}
          </div>

          <div>
            <label htmlFor="phone" className="block text-sm font-medium text-gray-300 mb-1">
              Téléphone (optionnel)
            </label>
            <input
              id="phone"
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              className="w-full px-4 py-2 bg-gray-700 border-2 border-gray-600 text-white rounded-lg focus:ring-2 focus:ring-primary-teal focus:border-primary-teal placeholder-gray-400"
              placeholder="+223 XX XX XX XX"
            />
            {errors.phone && <p className="text-red-400 text-xs mt-1">{errors.phone}</p>}
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-1">
              Nouveau mot de passe *
            </label>
            <input
              id="password"
              type="password"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              required
              className="w-full px-4 py-2 bg-gray-700 border-2 border-gray-600 text-white rounded-lg focus:ring-2 focus:ring-primary-teal focus:border-primary-teal placeholder-gray-400"
              placeholder="Minimum 8 caractères"
            />
            {errors.password && <p className="text-red-400 text-xs mt-1">{errors.password}</p>}
          </div>

          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-300 mb-1">
              Confirmer le mot de passe *
            </label>
            <input
              id="confirmPassword"
              type="password"
              value={formData.confirmPassword}
              onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
              required
              className="w-full px-4 py-2 bg-gray-700 border-2 border-gray-600 text-white rounded-lg focus:ring-2 focus:ring-primary-teal focus:border-primary-teal placeholder-gray-400"
              placeholder="Répétez le mot de passe"
            />
            {errors.confirmPassword && (
              <p className="text-red-400 text-xs mt-1">{errors.confirmPassword}</p>
            )}
          </div>

          {errors.submit && (
            <div className="bg-red-900/50 border-2 border-red-600 text-red-200 px-4 py-3 rounded-lg text-sm">
              {errors.submit}
            </div>
          )}

          <Button type="submit" variant="primary" fullWidth disabled={submitting}>
            {submitting ? 'Enregistrement...' : 'ENREGISTRER'}
          </Button>
        </form>
      </Card>
    </div>
  )
}

