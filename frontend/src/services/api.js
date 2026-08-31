const BASE = '/api';

let token = localStorage.getItem('tahir_token') || '';

export function setToken(t) {
  token = t || '';
  if (t) localStorage.setItem('tahir_token', t);
  else localStorage.removeItem('tahir_token');
}
export function getToken() {
  return token;
}

async function request(method, path, body) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = null;
  try {
    data = await res.json();
  } catch {
    data = { success: false, message: 'Invalid server response' };
  }
  if (!res.ok) {
    const err = new Error(data?.message || 'Something went wrong');
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

export const api = {
  get: (p) => request('GET', p),
  post: (p, b) => request('POST', p, b),
  put: (p, b) => request('PUT', p, b),
  del: (p) => request('DELETE', p),
};

export const authApi = {
  login: (body) => api.post('/auth/login', body),
  me: () => api.get('/auth/me'),
  changePassword: (body) => api.post('/auth/change-password', body),
};
