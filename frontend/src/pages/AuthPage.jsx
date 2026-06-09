import { useEffect, useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  LoaderCircle,
  LockKeyhole,
  Mail,
} from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import authWorkspaceImage from "@/assets/auth/bug-tracker-workspace-login.png";
import pirnavLogo from "@/assets/pirnav-logo.png";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/use-auth";
import { adminLoginRequest, loginRequest, registerRequest } from "@/lib/api";
import { getDashboardPathByRole } from "@/lib/roles";
import { cn } from "@/lib/utils";

const initialForm = {
  fullName: "",
  email: "",
  password: "",
  role: "Developer",
};

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const passwordHasLetter = /[A-Za-z]/;
const passwordHasNumber = /\d/;
const ADMIN_ROUTE_PATH = "/admin";
const isAdminDefaultLoginEnabledOnClient =
  import.meta.env.VITE_ENABLE_ADMIN_DEFAULT_LOGIN !== "false";

const inputClassName =
  "auth-input h-11 rounded-xl border border-white/25 bg-slate-950/70 pl-11 pr-4 text-sm text-slate-50 placeholder:text-slate-300 caret-white opacity-100 shadow-none transition duration-200 focus-visible:border-sky-300 focus-visible:ring-2 focus-visible:ring-sky-400/35 disabled:text-slate-50 disabled:opacity-100";

const passwordInputClassName =
  "auth-input h-11 rounded-xl border border-white/25 bg-slate-950/70 pl-11 pr-12 text-sm text-slate-50 placeholder:text-slate-300 caret-white opacity-100 shadow-none transition duration-200 focus-visible:border-sky-300 focus-visible:ring-2 focus-visible:ring-sky-400/35 disabled:text-slate-50 disabled:opacity-100";

const getSafeRedirectPath = (search = "") => {
  const redirect = new URLSearchParams(search).get("redirect") || "";

  if (
    !redirect ||
    !redirect.startsWith("/") ||
    redirect.startsWith("//") ||
    redirect.includes("\\")
  ) {
    return "";
  }

  try {
    const origin =
      typeof window !== "undefined" ? window.location.origin : "http://localhost";
    const parsedUrl = new URL(redirect, origin);

    if (parsedUrl.origin !== origin || ["/login", "/auth", "/admin"].includes(parsedUrl.pathname)) {
      return "";
    }

    return `${parsedUrl.pathname}${parsedUrl.search}${parsedUrl.hash}`;
  } catch (error) {
    return "";
  }
};

const getAuthErrorMessage = (error) => {
  const message = error?.response?.data?.message;

  if (
    error?.response?.status === 401 ||
    message === "Invalid credentials" ||
    message === "Invalid email or password"
  ) {
    return "Invalid email or password";
  }

  if (error?.response?.status === 409) {
    return message || "An account with that email already exists";
  }

  if (error?.response?.status === 400) {
    return message || "Please review the highlighted fields and try again.";
  }

  if (!error?.response) {
    return "Unable to reach the server. Please check the API and try again.";
  }

  return message || "Authentication failed.";
};

const validateForm = ({ mode, formData }) => {
  const errors = {};

  if (mode === "register") {
    if (!formData.fullName.trim()) {
      errors.fullName = "Full name is required";
    } else if (formData.fullName.trim().length < 2) {
      errors.fullName = "Full name must be at least 2 characters long";
    }

  }

  if (!formData.email.trim()) {
    errors.email = "Email is required";
  } else if (!emailRegex.test(formData.email.trim())) {
    errors.email = "Please enter a valid email address";
  }

  if (!formData.password) {
    errors.password = "Password is required";
  } else if (mode === "register" && formData.password.length < 8) {
    errors.password = "Password must be at least 8 characters long";
  } else if (
    mode === "register" &&
    (!passwordHasLetter.test(formData.password) ||
      !passwordHasNumber.test(formData.password))
  ) {
    errors.password = "Password must include at least one letter and one number";
  }

  return errors;
};

const AuthPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { setAuthSession } = useAuth();
  const [mode, setMode] = useState("login");
  const [formData, setFormData] = useState(initialForm);
  const [fieldErrors, setFieldErrors] = useState({});
  const [successMessage, setSuccessMessage] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [isBackgroundLoaded, setIsBackgroundLoaded] = useState(false);
  const [hasBackgroundError, setHasBackgroundError] = useState(false);
  const isAdminRoute = location.pathname === ADMIN_ROUTE_PATH;
  const canUseDefaultPassword =
    mode === "login" &&
    isAdminRoute &&
    isAdminDefaultLoginEnabledOnClient;

  const authMutation = useMutation({
    mutationFn: ({ currentMode, payload }) =>
      currentMode === "admin-default"
        ? adminLoginRequest(payload)
        : currentMode === "login"
          ? loginRequest(payload)
          : registerRequest(payload),
    onSuccess: (data, variables) => {
      if (
        variables.currentMode === "login" ||
        variables.currentMode === "admin-default"
      ) {
        setAuthSession(data, {
          rememberMe: Boolean(variables.payload?.rememberMe),
        });
        navigate(
          getSafeRedirectPath(location.search) ||
            getDashboardPathByRole(data?.user?.role),
          { replace: true }
        );
        return;
      }

      navigate("/login", {
        replace: true,
        state: {
          email: variables.payload.email,
          mode: "login",
          successMessage:
            data?.message || "Account created successfully. Please sign in.",
        },
      });
    },
  });

  useEffect(() => {
    if (!location.state?.successMessage) {
      return;
    }

    authMutation.reset();
    setFieldErrors({});
    setSuccessMessage(location.state.successMessage);
    setMode("login");
    setShowPassword(false);
    setRememberMe(false);
    setFormData({
      ...initialForm,
      email: location.state.email || "",
    });
    navigate(location.pathname, { replace: true, state: null });
  }, [authMutation, location.pathname, location.state, navigate]);

  useEffect(() => {
    let isMounted = true;
    const image = new window.Image();

    image.onload = () => {
      if (!isMounted) {
        return;
      }

      setIsBackgroundLoaded(true);
      setHasBackgroundError(false);
    };

    image.onerror = () => {
      if (!isMounted) {
        return;
      }

      setHasBackgroundError(true);
      setIsBackgroundLoaded(false);
    };

    image.src = authWorkspaceImage;

    return () => {
      isMounted = false;
    };
  }, []);

  const handleChange = (event) => {
    const { name, value } = event.target;
    authMutation.reset();
    setSuccessMessage("");
    setFieldErrors((current) => {
      if (!current[name]) {
        return current;
      }

      const nextErrors = { ...current };
      delete nextErrors[name];
      return nextErrors;
    });

    setFormData((current) => ({
      ...current,
      [name]: value,
    }));
  };

  const handleUseDefaultPassword = async () => {
    authMutation.reset();
    setSuccessMessage("");
    setFieldErrors({});

    await authMutation.mutateAsync({
      currentMode: "admin-default",
      payload: {
        rememberMe,
      },
    });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    authMutation.reset();
    setSuccessMessage("");

    const errors = validateForm({ mode, formData });

    if (Object.keys(errors).length) {
      setFieldErrors(errors);
      return;
    }

    setFieldErrors({});

    const normalizedEmail = formData.email.trim().toLowerCase();

    const payload =
      mode === "login"
        ? {
            email: normalizedEmail,
            password: formData.password,
            rememberMe,
          }
        : {
            name: formData.fullName.trim(),
            email: normalizedEmail,
            password: formData.password,
            role: formData.role,
          };

    await authMutation.mutateAsync({
      currentMode: mode,
      payload,
    });
  };

  const submitLabel = useMemo(() => {
    if (authMutation.isPending) {
      return mode === "login" ? "Logging in..." : "Creating account...";
    }

    return mode === "login" ? "Login" : "Create account";
  }, [authMutation.isPending, mode]);

  const eyebrowCopy = "Welcome Back";
  const titleCopy = "Sign in to your workspace";

  return (
    <main
      className="relative min-h-screen overflow-hidden bg-[#07111F] text-white"
      style={{ fontFamily: '"Inter", sans-serif' }}
    >
      <div className="auth-illustration-fallback absolute inset-0" aria-hidden="true" />
      {!hasBackgroundError ? (
        <div
          aria-hidden="true"
          className={cn(
            "absolute inset-0 bg-cover bg-center transition-opacity duration-500",
            isBackgroundLoaded ? "opacity-100" : "opacity-0"
          )}
          style={{ backgroundImage: `url(${authWorkspaceImage})` }}
        />
      ) : null}
      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(3,7,18,0.70)_0%,rgba(3,7,18,0.50)_28%,rgba(3,7,18,0.18)_58%,rgba(3,7,18,0.30)_100%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(2,6,23,0.30)_0%,rgba(2,6,23,0.12)_44%,rgba(2,6,23,0.42)_100%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_58%_40%,rgba(14,165,233,0.16)_0%,transparent_36%),radial-gradient(circle_at_26%_72%,rgba(249,115,22,0.14)_0%,transparent_32%)]" />

      <div className="relative z-10 flex min-h-screen items-center justify-center px-4 py-8 sm:px-6 lg:justify-start lg:px-0 lg:pl-12 xl:pl-16 2xl:pl-20">
        <div className="auth-fade-in w-full max-w-[430px] lg:max-w-[420px]">
          <div className="relative flex w-full flex-col overflow-hidden rounded-3xl border border-white/18 bg-slate-950/[0.56] p-6 shadow-[0_30px_90px_-20px_rgba(0,0,0,0.86)] backdrop-blur-[26px] sm:p-8">
            <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-cyan-200/60 to-transparent" />
            <div className="pointer-events-none absolute -right-20 -top-20 h-44 w-44 rounded-full bg-cyan-400/10 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-24 -left-16 h-44 w-44 rounded-full bg-amber-400/10 blur-3xl" />
            <div className="relative">
            <div className="space-y-2.5">
              <div className="flex items-center">
                <img
                  src={pirnavLogo}
                  alt="Pirnav Software Solutions Pvt. Ltd."
                  className="mb-3 h-9 w-auto object-contain"
                />
              </div>
              <p className="text-sm font-medium text-white/72">{eyebrowCopy}</p>
              <h1
                className="text-[29px] font-semibold leading-tight text-white sm:text-[33px]"
                style={{ fontFamily: '"Poppins", sans-serif' }}
              >
                {titleCopy}
              </h1>
            </div>

            <form className="mt-7 space-y-[18px]" onSubmit={handleSubmit}>
              {successMessage ? (
                <div className="flex items-start gap-3 rounded-[10px] border border-emerald-400/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />
                  <span>{successMessage}</span>
                </div>
              ) : null}

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-200" htmlFor="email">
                  Email
                </label>
                <div className="relative">
                  <Mail className="auth-field-icon pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2" />
                  <Input
                    aria-invalid={Boolean(fieldErrors.email)}
                    autoComplete="email"
                    className={cn(
                      inputClassName,
                      fieldErrors.email &&
                        "border-rose-400/60 focus-visible:border-rose-400 focus-visible:ring-rose-500/25"
                    )}
                    disabled={authMutation.isPending}
                    id="email"
                    name="email"
                    type="email"
                    placeholder="name@company.com"
                    value={formData.email}
                    onChange={handleChange}
                  />
                </div>
                {fieldErrors.email ? (
                  <p className="text-sm text-rose-300">{fieldErrors.email}</p>
                ) : null}
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-200" htmlFor="password">
                  Password
                </label>
                <div className="relative">
                  <LockKeyhole className="auth-field-icon pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2" />
                  <Input
                    aria-invalid={Boolean(fieldErrors.password)}
                    autoComplete={mode === "login" ? "current-password" : "new-password"}
                    className={cn(
                      passwordInputClassName,
                      fieldErrors.password &&
                        "border-rose-400/60 focus-visible:border-rose-400 focus-visible:ring-rose-500/25"
                    )}
                    disabled={authMutation.isPending}
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter your password"
                    value={formData.password}
                    onChange={handleChange}
                  />
                  <button
                    type="button"
                    className="auth-field-action absolute right-3 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    disabled={authMutation.isPending}
                    onClick={() => setShowPassword((current) => !current)}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" strokeWidth={2} />
                    ) : (
                      <Eye className="h-4 w-4" strokeWidth={2} />
                    )}
                  </button>
                </div>
                {fieldErrors.password ? (
                  <p className="text-sm text-rose-300">{fieldErrors.password}</p>
                ) : null}
              </div>

              {mode === "login" ? (
                <label className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.05] px-3.5 py-3 text-sm text-slate-200 transition hover:border-white/20 hover:bg-white/[0.08]">
                  <span className="flex min-w-0 items-center gap-3">
                    <input
                      checked={rememberMe}
                      className="h-4 w-4 rounded border-white/30 bg-slate-950 text-sky-500 focus:ring-2 focus:ring-sky-400/30"
                      disabled={authMutation.isPending}
                      type="checkbox"
                      onChange={(event) => setRememberMe(event.target.checked)}
                    />
                    <span className="font-medium">Remember me</span>
                  </span>
                  <span className="shrink-0 text-xs text-slate-300">30 days</span>
                </label>
              ) : null}

              {canUseDefaultPassword ? (
                <button
                  className="mt-3 w-fit rounded-lg border border-white/10 bg-white/[0.05] px-3 py-2 text-left text-[13px] text-[#93C5FD] transition-all duration-200 hover:border-[#3B82F6]/40 hover:bg-[#3B82F6]/20 disabled:cursor-wait disabled:opacity-70"
                  disabled={authMutation.isPending}
                  type="button"
                  onClick={handleUseDefaultPassword}
                >
                  Use Default Password
                </button>
              ) : null}

              {authMutation.error ? (
                <div className="rounded-[10px] border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
                  {getAuthErrorMessage(authMutation.error)}
                </div>
              ) : null}

              <Button
                className="group mt-2 h-[48px] w-full rounded-xl border border-cyan-200/24 bg-[linear-gradient(100deg,#2563EB_0%,#0891B2_52%,#F97316_150%)] text-sm font-bold text-white shadow-[0_20px_45px_-16px_rgba(14,165,233,0.68)] transition-all duration-300 hover:-translate-y-0.5 hover:scale-[1.01] hover:border-cyan-100/36 hover:shadow-[0_26px_58px_-14px_rgba(14,165,233,0.78)] active:translate-y-0 active:scale-[0.99]"
                disabled={authMutation.isPending}
                type="submit"
              >
                {submitLabel}
                {authMutation.isPending ? (
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                ) : (
                  <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
                )}
              </Button>
            </form>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
};

export default AuthPage;
