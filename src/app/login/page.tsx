'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const supabase = createClient()

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (signInError) throw signInError

      // Check if user needs to change password
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (user) {
        const { data: profile } = await supabase
          .from('user_profile')
          .select('must_change_password')
          .eq('auth_user_id', user.id)
          .single()

        if (profile?.must_change_password) {
          router.push('/onboarding')
          return
        }
      }

      router.push('/profile')
    } catch (err: any) {
      console.error('Login error:', err)
      setError(err.message || 'Erreur lors de la connexion')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center px-4 pb-20">
      <Card className="w-full max-w-md p-6">
        <h1 className="text-2xl font-bold text-white mb-2">Connexion</h1>
        <p className="text-gray-300 mb-6">
          Connectez-vous pour accéder aux fonctionnalités avancées
        </p>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-1">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-4 py-2 bg-gray-700 border-2 border-gray-600 text-white rounded-lg focus:ring-2 focus:ring-primary-teal focus:border-primary-teal placeholder-gray-400"
              placeholder="votre@email.com"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-1">
              Mot de passe
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full px-4 py-2 bg-gray-700 border-2 border-gray-600 text-white rounded-lg focus:ring-2 focus:ring-primary-teal focus:border-primary-teal placeholder-gray-400"
              placeholder="Votre mot de passe"
            />
          </div>

          {error && (
            <div className="bg-red-900/50 border-2 border-red-600 text-red-200 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          <Button type="submit" variant="primary" fullWidth disabled={loading}>
            {loading ? 'Connexion...' : 'SE CONNECTER'}
          </Button>
        </form>

        <div className="mt-6 text-center">
          <button
            onClick={() => router.push('/')}
            className="text-primary-teal text-sm font-medium hover:text-teal-400 transition-colors"
          >
            Retour à l&apos;accueil
          </button>
        </div>
      </Card>
    </div>
  )
}

