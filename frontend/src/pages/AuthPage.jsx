import { useEffect, useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  ArrowRight,
  CheckCircle2,
  LoaderCircle,
  LockKeyhole,
  Mail,
  Sparkles,
  User2,
} from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import animeWorkspaceImage from "@/assets/auth/anime-workspace.jpg";
import pirnavLogo from "@/assets/pirnav-logo.png";
import { Button } from "@/components/ui/button";
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
const passwordHasLetter = /[A-Za-z]/;
const passwordHasNumber = /\d/;

const inputClassName =
  "h-11 rounded-[10px] border !border-white/20 !bg-white/[0.10] pl-11 pr-4 text-sm !text-white placeholder:!text-white/60 caret-white shadow-none transition duration-200 focus-visible:!border-[#3B82F6] focus-visible:ring-2 focus-visible:ring-[#3B82F6]/30 [&:-webkit-autofill]:[-webkit-text-fill-color:#fff] [&:-webkit-autofill]:shadow-[inset_0_0_0px_1000px_rgba(255,255,255,0.10)]";

const selectClassName =
  "h-11 w-full appearance-none rounded-[10px] border border-white/20 bg-white/[0.10] pl-11 pr-11 text-sm text-white outline-none transition duration-200 focus:border-[#3B82F6] focus:ring-2 focus:ring-[#3B82F6]/30";

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

  const handleFillAdminCredentials = () => {
    authMutation.reset();
    setSuccessMessage("");
    setFieldErrors((current) => {
      const nextErrors = { ...current };
      delete nextErrors.email;
      delete nextErrors.password;
      return nextErrors;
    });

    setFormData((current) => ({
      ...current,
      email: "admin@example.com",
      password: "admin123",
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

  const submitLabel = useMemo(() => {
    if (authMutation.isPending) {
      return mode === "login" ? "Logging in..." : "Creating account...";
    }

    return mode === "login" ? "Login" : "Create account";
  }, [authMutation.isPending, mode]);

  const eyebrowCopy = mode === "login" ? "Welcome Back" : "Create Account";
  const titleCopy =
    mode === "login" ? "Sign in to your workspace" : "Create your workspace account";

  return (
    <main
      className="fixed inset-0 overflow-hidden bg-[#0B1120] text-white"
      style={{
        backgroundImage: `url(${animeWorkspaceImage})`,
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
        backgroundSize: "cover",
        fontFamily: '"Inter", sans-serif',
      }}
    >
      <div className="absolute inset-0 bg-[rgba(10,25,50,0.65)]" />

      <div className="relative z-10 flex h-full items-center justify-center px-5 py-8 sm:px-8 md:justify-start md:pl-20 md:pr-10">
        <div className="auth-fade-in w-full md:w-auto">
          <div className="auth-card-float flex w-full max-w-[360px] flex-col rounded-2xl border border-white/20 bg-white/[0.08] p-8 shadow-[0_8px_40px_rgba(0,0,0,0.3)] backdrop-blur-[20px] md:w-[360px]">
            <div className="space-y-2">
              <div className="flex items-center">
                <img
                  src={pirnavLogo}
                  alt="Pirnav Software Solutions Pvt. Ltd."
                  className="mb-4 h-9 w-auto object-contain"
                />
              </div>
              <p className="text-sm font-medium text-white/72">{eyebrowCopy}</p>
              <h1
                className="text-[30px] font-semibold leading-tight tracking-[-0.04em] text-white sm:text-[34px]"
                style={{ fontFamily: '"Poppins", sans-serif' }}
              >
                {titleCopy}
              </h1>
            </div>

            <form className="mt-8 space-y-4" onSubmit={handleSubmit}>
              {successMessage ? (
                <div className="flex items-start gap-3 rounded-[10px] border border-emerald-400/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />
                  <span>{successMessage}</span>
                </div>
              ) : null}

              {mode === "register" ? (
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-200" htmlFor="fullName">
                    Full name
                  </label>
                  <div className="relative">
                    <User2 className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/70" />
                    <Input
                      aria-invalid={Boolean(fieldErrors.fullName)}
                      autoComplete="name"
                      className={cn(
                        inputClassName,
                        fieldErrors.fullName &&
                          "border-rose-400/60 focus-visible:border-rose-400 focus-visible:ring-rose-500/25"
                      )}
                      disabled={authMutation.isPending}
                      id="fullName"
                      name="fullName"
                      placeholder="Avery Morgan"
                      value={formData.fullName}
                      onChange={handleChange}
                    />
                  </div>
                  {fieldErrors.fullName ? (
                    <p className="text-sm text-rose-300">{fieldErrors.fullName}</p>
                  ) : null}
                </div>
              ) : null}

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-200" htmlFor="email">
                  Email
                </label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/70" />
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
                  <LockKeyhole className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/70" />
                  <Input
                    aria-invalid={Boolean(fieldErrors.password)}
                    autoComplete={mode === "login" ? "current-password" : "new-password"}
                    className={cn(
                      inputClassName,
                      fieldErrors.password &&
                        "border-rose-400/60 focus-visible:border-rose-400 focus-visible:ring-rose-500/25"
                    )}
                    disabled={authMutation.isPending}
                    id="password"
                    name="password"
                    type="password"
                    placeholder="Enter your password"
                    value={formData.password}
                    onChange={handleChange}
                  />
                </div>
                {fieldErrors.password ? (
                  <p className="text-sm text-rose-300">{fieldErrors.password}</p>
                ) : null}
              </div>

              {mode === "login" ? (
                <button
                  className="mt-3 w-fit rounded-lg border border-white/10 bg-white/[0.05] px-3 py-2 text-left text-[13px] text-[#93C5FD] transition-all duration-200 hover:border-[#3B82F6]/40 hover:bg-[#3B82F6]/20 disabled:cursor-wait disabled:opacity-70"
                  disabled={authMutation.isPending}
                  type="button"
                  onClick={handleFillAdminCredentials}
                >
                  Use Admin Login
                </button>
              ) : null}

              {mode === "register" ? (
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-200" htmlFor="role">
                    Role
                  </label>
                  <div className="relative">
                    <Sparkles className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/70" />
                    <select
                      aria-invalid={Boolean(fieldErrors.role)}
                      className={cn(
                        selectClassName,
                        fieldErrors.role &&
                          "border-rose-400/60 focus:border-rose-400 focus:ring-rose-500/25"
                      )}
                      disabled={authMutation.isPending}
                      id="role"
                      name="role"
                      style={{ colorScheme: "dark" }}
                      value={formData.role}
                      onChange={handleChange}
                    >
                      {roleOptions.map((role) => (
                        <option key={role} value={role}>
                          {role}
                        </option>
                      ))}
                    </select>
                    <div className="pointer-events-none absolute right-4 top-1/2 h-2.5 w-2.5 -translate-y-[60%] rotate-45 border-b border-r border-slate-400" />
                  </div>
                  {fieldErrors.role ? (
                    <p className="text-sm text-rose-300">{fieldErrors.role}</p>
                  ) : null}
                </div>
              ) : null}

              {authMutation.error ? (
                <div className="rounded-[10px] border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
                  {getAuthErrorMessage(authMutation.error)}
                </div>
              ) : null}

              <Button
                className="group mt-1 h-[46px] w-full rounded-[10px] border border-sky-300/20 bg-[linear-gradient(90deg,#2563EB_0%,#0EA5E9_100%)] text-sm font-bold text-white shadow-[0_20px_45px_-16px_rgba(14,165,233,0.6)] transition-all duration-200 hover:scale-[1.01] hover:shadow-[0_24px_54px_-14px_rgba(14,165,233,0.72)]"
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

            <div className="mt-6 text-sm text-slate-300">
              {mode === "login" ? "Not registered yet?" : "Already have an account?"}{" "}
              <button
                className="font-semibold text-sky-300 transition duration-200 hover:text-sky-200"
                type="button"
                onClick={() => handleModeChange(mode === "login" ? "register" : "login")}
              >
                {mode === "login" ? "Create an account" : "Login"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
};

export default AuthPage;
