import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { ArrowRight, Loader2 } from "lucide-react";
import { useDemoAuth } from "@/context/DemoAuthContext";

export default function Login() {
  const { login } = useDemoAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const from = (location.state as any)?.from?.pathname || "/dashboard";

  // Login form
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    const res = await login(email, password);
    setLoading(false);
    if (!res.ok) {
      setError(res.error || "Login failed.");
      return;
    }
    navigate(from, { replace: true });
  };

  const inputCls =
    "w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs font-semibold text-slate-900 dark:bg-slate-800 dark:border-slate-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500";

  return (
    <div className="mx-auto max-w-md px-4 py-12 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="text-center space-y-3 mb-8">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-tr from-indigo-900 to-indigo-600 p-1 shadow-lg shadow-indigo-500/30">
          <img
            src="https://media.base44.com/images/public/6a8e859522d0c3ff1205c51b/40a48d7b6_logo.jpg"
            alt="RGMCET Crest"
            className="h-full w-full rounded-xl object-contain"
          />
        </div>
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
          Hostel Hub Portal Access
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Sign in with your registered email and password to access the management portal.
        </p>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-md dark:border-slate-800 dark:bg-slate-900">
        {error && (
          <div className="mb-4 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-xs font-bold text-red-700 dark:bg-red-950/40 dark:border-red-900 dark:text-red-300">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4 text-xs">
          <div>
            <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
              Email Address
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@rgmcet.edu.in"
              className={inputCls}
            />
          </div>
          <div>
            <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className={inputCls}
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-6 py-3 text-xs font-bold text-white shadow-md hover:bg-indigo-700 disabled:opacity-60"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
            Sign In
          </button>
        </form>
      </div>

      <p className="mt-6 rounded-2xl bg-indigo-50/60 border border-indigo-100 p-4 text-center text-xs text-indigo-900 dark:bg-indigo-950/40 dark:border-indigo-900/60 dark:text-indigo-200 font-medium">
        Having trouble signing in? Contact the hostel office to have your account created or your password reset.
      </p>
    </div>
  );
}
