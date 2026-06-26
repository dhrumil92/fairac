// =============================================================================
// src/pages/auth/RegisterPage.jsx
// Signup Page — Stitch Design, FairAC API integrated
// =============================================================================

import { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import api from '../../api/axios';
import './AuthPages.css';

const RegisterPage = () => {
  const navigate        = useNavigate();
  const { login, user } = useAuth();

  const [form, setForm] = useState({
    name:     '',
    email:    '',
    mobile:   '',
    password: '',
    confirm:  '',
    secret_code: ''
  });
  const [showPass, setShowPass]   = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError]         = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const canvasRef                 = useRef(null);

  // Redirect if already logged in
  useEffect(() => {
    if (user) navigate(user.role === 'admin' ? '/admin/dashboard' : '/dashboard');
  }, [user, navigate]);

  // ─── WebGL Shader (same as login) ────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const syncSize = () => {
      const w = canvas.clientWidth  || 1280;
      const h = canvas.clientHeight || 720;
      if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    };
    const ro = new ResizeObserver(syncSize);
    ro.observe(canvas);
    syncSize();
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    if (!gl) return;
    const vs = `attribute vec2 a_position; varying vec2 v_texCoord; void main() { v_texCoord = a_position * 0.5 + 0.5; gl_Position = vec4(a_position, 0.0, 1.0); }`;
    const fs = `precision highp float; varying vec2 v_texCoord; uniform float u_time; void main() { vec2 uv = v_texCoord; float n1 = sin(uv.x * 3.0 + u_time * 0.5) * 0.5 + 0.5; float n2 = cos(uv.y * 2.0 - u_time * 0.3) * 0.5 + 0.5; vec3 c1 = vec3(0.059, 0.09, 0.161); vec3 c2 = vec3(0.42, 0.39, 1.0); vec3 c3 = vec3(0.1, 0.0, 0.3); float m = smoothstep(0.3, 0.7, n1 * n2 + sin(u_time * 0.2) * 0.1); vec3 fc = mix(c1, mix(c2, c3, uv.y), m * 0.4); float d = distance(uv, vec2(0.5)); fc += c2 * (1.0 - smoothstep(0.0, 0.8, d)) * 0.2; gl_FragColor = vec4(fc, 1.0); }`;
    const cs = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return s; };
    const prog = gl.createProgram();
    gl.attachShader(prog, cs(gl.VERTEX_SHADER, vs));
    gl.attachShader(prog, cs(gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(prog);
    gl.useProgram(prog);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), gl.STATIC_DRAW);
    const pos = gl.getAttribLocation(prog, 'a_position');
    gl.enableVertexAttribArray(pos);
    gl.vertexAttribPointer(pos, 2, gl.FLOAT, false, 0, 0);
    const uTime = gl.getUniformLocation(prog, 'u_time');
    let id;
    const render = (t) => { syncSize(); gl.viewport(0, 0, canvas.width, canvas.height); if (uTime) gl.uniform1f(uTime, t * 0.001); gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4); id = requestAnimationFrame(render); };
    id = requestAnimationFrame(render);
    return () => { cancelAnimationFrame(id); ro.disconnect(); };
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    if (fieldErrors[name]) setFieldErrors((prev) => ({ ...prev, [name]: '' }));
  };

  // ─── Client-Side Validation ───────────────────────────────────────────────
  const validate = () => {
    const errors = {};
    if (!form.name.trim())  errors.name = 'Full name is required.';
    if (!form.email.trim()) errors.email = 'Email address is required.';
    else if (!/\S+@\S+\.\S+/.test(form.email)) errors.email = 'Enter a valid email address.';
    if (!form.mobile.trim()) errors.mobile = 'Mobile number is required.';
    else if (!/^[6-9]\d{9}$/.test(form.mobile)) errors.mobile = 'Enter a valid 10-digit Indian mobile number.';
    if (!form.password) errors.password = 'Password is required.';
    else if (form.password.length < 8) errors.password = 'Password must be at least 8 characters.';
    if (form.password !== form.confirm) errors.confirm = 'Passwords do not match.';
    if (!form.secret_code.trim()) errors.secret_code = 'Secret Hostel Code is required.';
    return errors;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    const errors = validate();
    if (Object.keys(errors).length > 0) { setFieldErrors(errors); return; }

    setIsLoading(true);
    try {
      const response = await api.post('/auth/register', {
        name:     form.name.trim(),
        email:    form.email.trim().toLowerCase(),
        mobile:   form.mobile.trim(),
        password: form.password,
        secret_code: form.secret_code.trim(),
      });
      const { token, user } = response.data.data;
      login(token, user);
      navigate('/dashboard');
    } catch (err) {
      if (err.response?.data?.errors) {
        setError(err.response.data.errors.map(e => e.message).join(' | '));
      } else {
        const msg = err.response?.data?.message || 'Registration failed. Please try again.';
        setError(msg);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="auth-page">
      {/* ── Left Decorative Panel ── */}
      <div className="auth-hero">
        <canvas ref={canvasRef} className="auth-shader" />
        <div className="auth-hero-content">
          <div className="auth-logo">
            <div className="auth-logo-icon">
              <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect width="64" height="64" rx="12" fill="url(#reg-logo-grad)"/>
                <path d="M20 44V22h24v6H28v4h14v6H28v6H20z" fill="white"/>
                <circle cx="44" cy="20" r="6" fill="#00D4AA"/>
                <defs>
                  <linearGradient id="reg-logo-grad" x1="0" y1="0" x2="64" y2="64">
                    <stop stopColor="#6C63FF"/><stop offset="1" stopColor="#4F46E5"/>
                  </linearGradient>
                </defs>
              </svg>
            </div>
            <span className="auth-logo-text">FairAC</span>
          </div>
          <h1 className="auth-hero-title">Join FairAC.<br/>Split Fairly.</h1>
          <ul className="auth-features">
            <li><span className="auth-feature-icon">🏠</span> Join your hostel room</li>
            <li><span className="auth-feature-icon">⏱️</span> Pay only for your time</li>
            <li><span className="auth-feature-icon">📊</span> Track all your usage</li>
          </ul>
        </div>
      </div>

      {/* ── Right: Register Form ── */}
      <div className="auth-form-panel">
        <div className="auth-card glass-card">
          <div className="auth-card-header">
            <h2 className="auth-title">Create Account</h2>
            <p className="auth-subtitle">Start splitting AC costs fairly</p>
          </div>

          <form onSubmit={handleSubmit} className="auth-form" noValidate>
            {error && (
              <div className="auth-error" role="alert">
                <span>⚠️</span> {error}
              </div>
            )}

            {/* Full Name */}
            <div className="form-group">
              <label className="form-label" htmlFor="reg-name">Full Name</label>
              <input
                id="reg-name"
                name="name"
                type="text"
                className={`form-input ${fieldErrors.name ? 'input-error' : ''}`}
                placeholder="Raj Patel"
                value={form.name}
                onChange={handleChange}
              />
              {fieldErrors.name && <span className="field-error">{fieldErrors.name}</span>}
            </div>

            {/* Email */}
            <div className="form-group">
              <label className="form-label" htmlFor="reg-email">Email Address</label>
              <input
                id="reg-email"
                name="email"
                type="email"
                className={`form-input ${fieldErrors.email ? 'input-error' : ''}`}
                placeholder="raj@example.com"
                value={form.email}
                onChange={handleChange}
              />
              {fieldErrors.email && <span className="field-error">{fieldErrors.email}</span>}
            </div>

            {/* Mobile */}
            <div className="form-group">
              <label className="form-label" htmlFor="reg-mobile">Mobile Number</label>
              <input
                id="reg-mobile"
                name="mobile"
                type="tel"
                className={`form-input ${fieldErrors.mobile ? 'input-error' : ''}`}
                placeholder="9876543210"
                maxLength={10}
                value={form.mobile}
                onChange={handleChange}
              />
              {fieldErrors.mobile && <span className="field-error">{fieldErrors.mobile}</span>}
            </div>

            {/* Password */}
            <div className="form-group">
              <label className="form-label" htmlFor="reg-password">Password</label>
              <div className="input-wrapper">
                <input
                  id="reg-password"
                  name="password"
                  type={showPass ? 'text' : 'password'}
                  className={`form-input ${fieldErrors.password ? 'input-error' : ''}`}
                  placeholder="Min. 8 characters"
                  value={form.password}
                  onChange={handleChange}
                />
                <button type="button" className="input-icon-btn" onClick={() => setShowPass(!showPass)}>
                  {showPass ? '🙈' : '👁️'}
                </button>
              </div>
              {fieldErrors.password && <span className="field-error">{fieldErrors.password}</span>}
            </div>

            {/* Confirm Password */}
            <div className="form-group">
              <label className="form-label" htmlFor="reg-confirm">Confirm Password</label>
              <input
                id="reg-confirm"
                name="confirm"
                type="password"
                className={`form-input ${fieldErrors.confirm ? 'input-error' : ''}`}
                placeholder="Re-enter your password"
                value={form.confirm}
                onChange={handleChange}
              />
              {fieldErrors.confirm && <span className="field-error">{fieldErrors.confirm}</span>}
            </div>

            {/* Secret Hostel Code */}
            <div className="form-group">
              <label className="form-label" htmlFor="reg-secret">Secret Hostel Code</label>
              <input
                id="reg-secret"
                name="secret_code"
                type="text"
                className={`form-input ${fieldErrors.secret_code ? 'input-error' : ''}`}
                placeholder="Ask your admin for this"
                value={form.secret_code}
                onChange={handleChange}
              />
              {fieldErrors.secret_code && <span className="field-error">{fieldErrors.secret_code}</span>}
            </div>

            <button type="submit" className="btn-primary" disabled={isLoading} id="register-submit-btn">
              {isLoading ? (
                <span className="btn-loading"><span className="spinner" /> Creating account...</span>
              ) : 'Create Account'}
            </button>

            <div className="auth-divider"><span>Already have an account?</span></div>

            <Link to="/login" className="btn-outline">Log In</Link>
          </form>
        </div>
      </div>
    </div>
  );
};

export default RegisterPage;
