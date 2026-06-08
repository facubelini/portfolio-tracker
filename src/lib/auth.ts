import { supabase } from './supabase'

const REDIRECT_URL = import.meta.env.DEV
  ? `${window.location.origin}/portfolio-tracker/`
  : 'https://facubelini.github.io/portfolio-tracker/'

export async function loginWithGitHub() {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'github',
    options: { redirectTo: REDIRECT_URL },
  })
  if (error) throw error
}

export async function logout() {
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}

export async function getSession() {
  const { data } = await supabase.auth.getSession()
  return data.session
}
