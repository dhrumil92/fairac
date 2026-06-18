// =============================================================================
// src/pages/auth/LoginPage.jsx
// Login Page — Designed by Stitch, integrated with FairAC API
// =============================================================================

import { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import api from '../../api/axios';
import './AuthPages.css';

const LoginPage = () => {
  const navigate     = useNavigate();
  const { login, user } = useAuth();

  const [identifier, setIdentifier]   = useState('');
  const [password, setPassword]       = useState('');
  const [showPass, setShowPass]       = useState(false);
  const [isLoading, setIsLoading]     = useState(false);
  const [error, setError]             = useState('');
  const canvasRef                     = useRef(null);

  // Redirect if already logged in
  useEffect(() => {
    if (user) {
      navigate(user.role === 'admin' ? '/admin/dashboard' : '/dashboard');
    }
  }, [user, navigate]);

  // ─── WebGL Animated Shader (from Stitch) ────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const syncSize = () => {
      const w = canvas.clientWidth  || 1280;
      const h = canvas.clientHeight || 720;
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width  = w;
        canvas.height = h;
      }
    };

    const resizeObserver = new ResizeObserver(syncSize);
    resizeObserver.observe(canvas);
    syncSize();

    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    if (!gl) return;

    const vs = `
      attribute vec2 a_position;
      varying vec2 v_texCoord;
      void main() {
        v_texCoord = a_position * 0.5 + 0.5;
        gl_Position = vec4(a_position, 0.0, 1.0);
      }`;

    const fs = `
      precision highp float;
      varying vec2 v_texCoord;
      uniform float u_time;
      uniform vec2 u_resolution;
      void main() {
        vec2 uv = v_texCoord;
        float noise1 = sin(uv.x * 3.0 + u_time * 0.5) * 0.5 + 0.5;
        float noise2 = cos(uv.y * 2.0 - u_time * 0.3) * 0.5 + 0.5;
        vec3 color1 = vec3(0.0588, 0.0902, 0.1608);
        vec3 color2 = vec3(0.4235, 0.3882, 1.0);
        vec3 color3 = vec3(0.1, 0.0, 0.3);
        float mixFactor = smoothstep(0.3, 0.7, noise1 * noise2 + sin(u_time * 0.2) * 0.1);
        vec3 finalColor = mix(color1, mix(color2, color3, uv.y), mixFactor * 0.4);
        float dist = distance(uv, vec2(0.5));
        finalColor += color2 * (1.0 - smoothstep(0.0, 0.8, dist)) * 0.2;
        gl_FragColor = vec4(finalColor, 1.0);
      }`;

    const createShader = (type, src) => {
      const s = gl.createShader(type);
      gl.shaderSource(s, src);
      gl.compileShader(s);
      return s;
    };

    const prog = gl.createProgram();
    gl.attachShader(prog, createShader(gl.VERTEX_SHADER, vs));
    gl.attachShader(prog, createShader(gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(prog);
    gl.useProgram(prog);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), gl.STATIC_DRAW);
    const pos = gl.getAttribLocation(prog, 'a_position');
    gl.enableVertexAttribArray(pos);
    gl.vertexAttribPointer(pos, 2, gl.FLOAT, false, 0, 0);

    const uTime = gl.getUniformLocation(prog, 'u_time');
    const uRes  = gl.getUniformLocation(prog, 'u_resolution');

    let animId;
    const render = (t) => {
      syncSize();
      gl.viewport(0, 0, canvas.width, canvas.height);
      if (uTime) gl.uniform1f(uTime, t * 0.001);
      if (uRes)  gl.uniform2f(uRes, canvas.width, canvas.height);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      animId = requestAnimationFrame(render);
    };
    animId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animId);
      resizeObserver.disconnect();
    };
  }, []);

  // ─── Form Submit ─────────────────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!identifier.trim() || !password) {
      setError('Please enter your email/mobile and password.');
      return;
    }

    setIsLoading(true);
    try {
      const response = await api.post('/auth/login', { identifier, password });
      const { token, user } = response.data.data;

      login(token, user);

      // Route based on role
      if (user.role === 'admin') {
        navigate('/admin/dashboard');
      } else {
        navigate('/dashboard');
      }
    } catch (err) {
      const msg = err.response?.data?.message || 'Login failed. Please try again.';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="auth-page">
      {/* ── Left: Decorative Panel with Animated Shader ── */}
      <div className="auth-hero">
        <canvas ref={canvasRef} className="auth-shader" />
        <div className="auth-hero-content">
          {/* FairAC Logo */}
          <div className="auth-logo">
            <div className="auth-logo-icon">
              <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect width="64" height="64" rx="12" fill="url(#logo-grad)"/>
                <path d="M20 44V22h24v6H28v4h14v6H28v6H20z" fill="white"/>
                <circle cx="44" cy="20" r="6" fill="#00D4AA"/>
                <defs>
                  <linearGradient id="logo-grad" x1="0" y1="0" x2="64" y2="64">
                    <stop stopColor="#6C63FF"/>
                    <stop offset="1" stopColor="#4F46E5"/>
                  </linearGradient>
                </defs>
              </svg>
            </div>
            <span className="auth-logo-text">FairAC</span>
          </div>

          <h1 className="auth-hero-title">Fair AC Billing.<br/>Zero Disputes.</h1>

          <ul className="auth-features">
            <li><span className="auth-feature-icon">⚡</span> Usage-based billing</li>
            <li><span className="auth-feature-icon">👥</span> Share only your time</li>
            <li><span className="auth-feature-icon">💳</span> Instant wallet top-up</li>
          </ul>
        </div>
      </div>

      {/* ── Right: Login Form ── */}
      <div className="auth-form-panel">
        <div className="auth-card glass-card">
          <div className="auth-card-header">
            <h2 className="auth-title">Welcome Back</h2>
            <p className="auth-subtitle">Log in to your FairAC account</p>
          </div>

          <form onSubmit={handleSubmit} className="auth-form" noValidate>
            {/* Error Banner */}
            {error && (
              <div className="auth-error" role="alert">
                <span>⚠️</span> {error}
              </div>
            )}

            {/* Email / Mobile */}
            <div className="form-group">
              <label className="form-label" htmlFor="identifier">
                Email or Mobile Number
              </label>
              <input
                id="identifier"
                type="text"
                className="form-input"
                placeholder="raj@example.com or 9876543210"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                autoComplete="username"
                required
              />
            </div>

            {/* Password */}
            <div className="form-group">
              <label className="form-label" htmlFor="password">
                Password
              </label>
              <div className="input-wrapper">
                <input
                  id="password"
                  type={showPass ? 'text' : 'password'}
                  className="form-input"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  className="input-icon-btn"
                  onClick={() => setShowPass(!showPass)}
                  aria-label={showPass ? 'Hide password' : 'Show password'}
                >
                  {showPass ? '🙈' : '👁️'}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              className="btn-primary"
              disabled={isLoading}
              id="login-submit-btn"
            >
              {isLoading ? (
                <span className="btn-loading">
                  <span className="spinner" /> Logging in...
                </span>
              ) : 'Login'}
            </button>

            {/* Divider */}
            <div className="auth-divider">
              <span>New to FairAC?</span>
            </div>

            {/* Register Link */}
            <Link to="/register" className="btn-outline" id="create-account-btn">
              Create Account
            </Link>

            {/* Admin Link */}
            <p className="auth-footer-text">
              <Link to="/login" className="auth-muted-link">Admin? Log in here</Link>
            </p>
          </form>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
