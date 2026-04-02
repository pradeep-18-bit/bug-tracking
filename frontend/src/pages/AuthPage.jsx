import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { ArrowRight, LoaderCircle } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import pirnavLogo from "@/assets/pirnav-logo.png";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/use-auth";
import { loginRequest, registerRequest } from "@/lib/api";
import { getDashboardPathByRole } from "@/lib/roles";
import { cn } from "@/lib/utils";

const initialForm = {
  fullName: "",
  email: "",
  password: "",
  role: "Developer",
};

const roleOptions = ["Admin", "Developer", "Tester"];
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const inputClassName =
  "h-11 rounded-[10px] border-[#e5e7eb] bg-white/92 px-3.5 text-sm text-slate-900 shadow-[0_12px_28px_-24px_rgba(15,23,42,0.18)] placeholder:text-slate-400 focus-visible:border-indigo-400 focus-visible:ring-4 focus-visible:ring-[rgba(99,102,241,0.2)]";

const fieldLabelClassName =
  "text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500";

const modeButtonClassName =
  "rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition-all duration-200 hover:-translate-y-0.5";

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

    if (!roleOptions.includes(formData.role)) {
      errors.role = "Please select a valid role";
    }
  }

  if (!formData.email.trim()) {
    errors.email = "Email is required";
  } else if (!emailRegex.test(formData.email.trim())) {
    errors.email = "Please enter a valid email address";
  }

  if (!formData.password) {
    errors.password = "Password is required";
  } else if (formData.password.length < 6) {
    errors.password = "Password must be at least 6 characters long";
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

  const authMutation = useMutation({
    mutationFn: ({ currentMode, payload }) =>
      currentMode === "login" ? loginRequest(payload) : registerRequest(payload),
    onSuccess: (data, variables) => {
      if (variables.currentMode === "login") {
        setAuthSession(data);
        navigate(getDashboardPathByRole(data?.user?.role), { replace: true });
        return;
      }

      navigate("/auth", {
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
    setMode(location.state.mode === "register" ? "register" : "login");
    setFormData({
      ...initialForm,
      email: location.state.email || "",
    });
    navigate(location.pathname, { replace: true, state: null });
  }, [authMutation, location.pathname, location.state, navigate]);

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

  const handleModeChange = (nextMode) => {
    authMutation.reset();
    setFieldErrors({});
    setSuccessMessage("");
    setMode(nextMode);
    setFormData((current) => ({
      ...initialForm,
      email: current.email,
    }));
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

  return (
    <main className="relative h-screen w-full overflow-hidden bg-[#f4f7fb]">
      <div className="flex h-full w-full overflow-hidden">
        <section className="relative flex h-full basis-full flex-col overflow-hidden bg-[#fbfcfe] lg:basis-1/2">
          <div className="flex items-center px-8 pt-8 lg:px-12 lg:pt-10">
            <img
              src={pirnavLogo}
              alt="Pirnav Software Solutions Pvt. Ltd."
              className="h-auto max-h-9 w-auto max-w-[136px] object-contain"
            />
          </div>

          <div className="flex flex-1 items-center justify-center px-6 pb-8 pt-4 lg:px-12 lg:pb-10">
            <Card className="page-shell-enter w-full max-w-[380px] rounded-[16px] border border-slate-200/80 bg-white shadow-[0_24px_60px_-36px_rgba(15,23,42,0.18)]">
              <CardContent className="p-6">
                <div className="flex justify-end">
                  <div className="inline-flex rounded-full border border-slate-200 bg-slate-50 p-1">
                    <button
                      className={cn(
                        modeButtonClassName,
                        mode === "login"
                          ? "bg-[linear-gradient(135deg,#4f46e5,#3b82f6)] text-white shadow-[0_12px_24px_-16px_rgba(79,70,229,0.38)]"
                          : "text-slate-600 hover:bg-white hover:text-slate-900"
                      )}
                      type="button"
                      onClick={() => handleModeChange("login")}
                    >
                      Login
                    </button>
                    <button
                      className={cn(
                        modeButtonClassName,
                        mode === "register"
                          ? "bg-[linear-gradient(135deg,#4f46e5,#3b82f6)] text-white shadow-[0_12px_24px_-16px_rgba(79,70,229,0.38)]"
                          : "text-slate-600 hover:bg-white hover:text-slate-900"
                      )}
                      type="button"
                      onClick={() => handleModeChange("register")}
                    >
                      Register
                    </button>
                  </div>
                </div>

                <div className="mt-6 text-center">
                  <h1 className="text-[42px] font-semibold tracking-tight text-slate-950">
                    {mode === "login" ? "Welcome Back" : "Create Account"}
                  </h1>
                  <p className="mt-3 text-sm text-slate-500">
                    {mode === "login"
                      ? "Enter your email and password to access your account."
                      : "Create your account to access your workspace."}
                  </p>
                </div>

                <form className="mt-8 space-y-3.5" onSubmit={handleSubmit}>
                {successMessage ? (
                  <div className="rounded-[18px] border border-emerald-200/80 bg-emerald-50/80 px-4 py-3 text-sm text-emerald-700 backdrop-blur-xl">
                    {successMessage}
                  </div>
                ) : null}

                {mode === "register" ? (
                  <div className="space-y-2.5">
                    <label className={fieldLabelClassName} htmlFor="fullName">
                      Full Name
                    </label>
                    <Input
                      aria-invalid={Boolean(fieldErrors.fullName)}
                      className={inputClassName}
                      disabled={authMutation.isPending}
                      id="fullName"
                      name="fullName"
                      placeholder="Avery Morgan"
                      value={formData.fullName}
                      onChange={handleChange}
                    />
                    {fieldErrors.fullName ? (
                      <p className="text-sm text-rose-600">{fieldErrors.fullName}</p>
                    ) : null}
                  </div>
                ) : null}

                <div className="space-y-2.5">
                  <label className={fieldLabelClassName} htmlFor="email">
                    Email
                  </label>
                  <Input
                    aria-invalid={Boolean(fieldErrors.email)}
                    className={inputClassName}
                    disabled={authMutation.isPending}
                    id="email"
                    name="email"
                    type="email"
                    placeholder="team@company.com"
                    value={formData.email}
                    onChange={handleChange}
                  />
                  {fieldErrors.email ? (
                    <p className="text-sm text-rose-600">{fieldErrors.email}</p>
                  ) : null}
                </div>

                <div className="space-y-2.5">
                  <label className={fieldLabelClassName} htmlFor="password">
                    Password
                  </label>
                  <Input
                    aria-invalid={Boolean(fieldErrors.password)}
                    className={inputClassName}
                    disabled={authMutation.isPending}
                    id="password"
                    name="password"
                    type="password"
                    placeholder="Enter your password"
                    value={formData.password}
                    onChange={handleChange}
                  />
                  {fieldErrors.password ? (
                    <p className="text-sm text-rose-600">{fieldErrors.password}</p>
                  ) : null}
                </div>

                {mode === "register" ? (
                  <div className="space-y-2.5">
                    <label className={fieldLabelClassName} htmlFor="role">
                      Role
                    </label>
                    <select
                      aria-invalid={Boolean(fieldErrors.role)}
                      className={cn("field-select", inputClassName, "appearance-none")}
                      disabled={authMutation.isPending}
                      id="role"
                      name="role"
                      value={formData.role}
                      onChange={handleChange}
                    >
                      {roleOptions.map((role) => (
                        <option key={role} value={role}>
                          {role}
                        </option>
                      ))}
                    </select>
                    {fieldErrors.role ? (
                      <p className="text-sm text-rose-600">{fieldErrors.role}</p>
                    ) : null}
                  </div>
                ) : null}

                {authMutation.error ? (
                  <div className="rounded-[18px] border border-rose-200/80 bg-rose-50/85 px-4 py-3 text-sm text-rose-700 backdrop-blur-xl">
                    {getAuthErrorMessage(authMutation.error)}
                  </div>
                ) : null}

                <Button
                  className="h-11 w-full rounded-[10px] bg-[linear-gradient(135deg,#3b82f6_0%,#6366f1_100%)] text-white shadow-[0_20px_36px_-22px_rgba(59,130,246,0.42)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-[linear-gradient(135deg,#2563eb_0%,#5b5ff2_100%)] hover:shadow-[0_26px_44px_-22px_rgba(99,102,241,0.38)]"
                  disabled={authMutation.isPending}
                  type="submit"
                >
                  {authMutation.isPending
                    ? mode === "login"
                      ? "Signing in..."
                      : "Creating account..."
                    : mode === "login"
                      ? "Sign In"
                      : "Create Account"}
                  {authMutation.isPending ? (
                    <LoaderCircle className="h-4 w-4 animate-spin" />
                  ) : (
                    <ArrowRight className="h-4 w-4" />
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
          </div>
        </section>

        <section className="relative hidden h-full basis-1/2 overflow-hidden bg-[linear-gradient(135deg,#4f46e5,#6366f1)] lg:flex">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(255,255,255,0.12),transparent_28%),linear-gradient(90deg,rgba(255,255,255,0.06)_1px,transparent_1px),linear-gradient(rgba(255,255,255,0.06)_1px,transparent_1px)] bg-[length:auto,120px_120px,120px_120px]" />
          <div className="pointer-events-none absolute -left-20 top-10 h-64 w-64 rounded-full border border-white/10 bg-white/10 blur-2xl" />
          <div className="pointer-events-none absolute bottom-[-60px] right-[-40px] h-80 w-80 rounded-full border border-white/10 bg-indigo-400/20 blur-2xl" />

          <div className="relative flex h-full w-full flex-col justify-between px-12 py-12">
            <div />

            <div className="max-w-[480px] text-white">
              <h2 className="text-5xl font-semibold leading-[1.1] tracking-tight">
                Effortlessly manage your team and operations
              </h2>
              <p className="mt-5 max-w-[420px] text-base leading-7 text-white/82">
                Log in to access your workspace dashboard and keep projects, issues,
                and teams moving in sync.
              </p>
            </div>

            <div className="mx-auto w-full max-w-[520px] rounded-[24px] border border-white/18 bg-white/10 p-5 shadow-[0_28px_70px_-36px_rgba(15,23,42,0.38)] backdrop-blur-xl">
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-[18px] bg-white px-4 py-4 shadow-sm">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                    Active Tasks
                  </p>
                  <p className="mt-3 text-2xl font-semibold text-slate-900">128</p>
                  <p className="mt-1 text-xs text-emerald-500">+12% this week</p>
                </div>
                <div className="rounded-[18px] bg-white px-4 py-4 shadow-sm">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                    Team Uptime
                  </p>
                  <p className="mt-3 text-2xl font-semibold text-slate-900">99.2%</p>
                  <div className="mt-3 h-2 rounded-full bg-slate-100">
                    <div className="h-2 w-[82%] rounded-full bg-[linear-gradient(135deg,#4f46e5,#6366f1)]" />
                  </div>
                </div>
                <div className="rounded-[18px] bg-white px-4 py-4 shadow-sm">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                    Response Time
                  </p>
                  <p className="mt-3 text-2xl font-semibold text-slate-900">1.8h</p>
                  <p className="mt-1 text-xs text-slate-500">Average issue turnaround</p>
                </div>
              </div>

              <div className="mt-4 grid gap-4 lg:grid-cols-[1.35fr_0.95fr]">
                <div className="rounded-[20px] bg-white p-4 shadow-sm">
                  <div className="flex items-end gap-2">
                    {[42, 58, 47, 70, 62, 78, 88].map((value, index) => (
                      <span
                        key={index}
                        className="flex-1 rounded-full bg-[linear-gradient(180deg,#818cf8,#4f46e5)]"
                        style={{ height: `${value}px` }}
                      />
                    ))}
                  </div>
                  <div className="mt-4 flex items-center justify-between text-xs text-slate-400">
                    <span>Mon</span>
                    <span>Wed</span>
                    <span>Fri</span>
                    <span>Sun</span>
                  </div>
                </div>

                <div className="rounded-[20px] bg-white p-4 shadow-sm">
                  <div className="mx-auto flex h-40 w-40 items-center justify-center rounded-full bg-[conic-gradient(from_180deg,#4f46e5_0deg,#6366f1_220deg,#e0e7ff_220deg,#e0e7ff_360deg)]">
                    <div className="flex h-24 w-24 flex-col items-center justify-center rounded-full bg-white">
                      <span className="text-2xl font-semibold text-slate-900">82%</span>
                      <span className="text-xs text-slate-400">Delivery</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
};

export default AuthPage;
