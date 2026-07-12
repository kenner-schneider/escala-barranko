// Sessão do FREE: JWT customizado guardado em localStorage, com checagem de expiração.
const KEY = 'escala.free_jwt'

export interface FreeClaims {
  person_id: string
  restaurant_id: string
  exp: number
}

function decode(jwt: string): FreeClaims | null {
  try {
    const payload = jwt.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
    return JSON.parse(atob(payload)) as FreeClaims
  } catch {
    return null
  }
}

export function getFreeJwt(): string | null {
  const jwt = localStorage.getItem(KEY)
  if (!jwt) return null
  const claims = decode(jwt)
  if (!claims || claims.exp * 1000 < Date.now()) {
    localStorage.removeItem(KEY)
    return null
  }
  return jwt
}

export function freeClaims(): FreeClaims | null {
  const jwt = getFreeJwt()
  return jwt ? decode(jwt) : null
}

export const setFreeJwt = (jwt: string) => localStorage.setItem(KEY, jwt)
export const clearFreeJwt = () => localStorage.removeItem(KEY)
