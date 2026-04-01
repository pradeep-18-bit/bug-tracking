import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  ArrowRight,
  KeyRound,
  LoaderCircle,
  ShieldCheck,
  Sparkles,
  Workflow,
} from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/use-auth";
import { loginRequest, registerRequest } from "@/lib/api";
import { getDashboardPathByRole } from "@/lib/roles";

const highlights = [
  {
    icon: Workflow,
    title: "Structured execution",
    description:
      "Track work in a clean, searchable issue registry with project-aware ownership.",
  },
  {
    icon: ShieldCheck,
    title: "JWT-secured access",
    description:
      "Protected routes and persisted sessions keep the workspace secure and focused.",
  },
  {
    icon: Sparkles,
    title: "Premium SaaS feel",
    description:
      "Clean light surfaces, fast interactions, and polished cards inspired by modern SaaS tools.",
  },
];

const initialForm = {
  fullName: "",
  email: "",
  password: "",
  role: "Developer",
};

const roleOptions = ["Admin", "Developer", "Tester"];
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const DEFAULT_ADMIN = {
  email: "admin@example.com",
  password: "admin123",
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

  const fillDefaultCredentials = () => {
    authMutation.reset();
    setFieldErrors({});
    setSuccessMessage("");
    setMode("login");
    setFormData((current) => ({
      ...initialForm,
      email: DEFAULT_ADMIN.email,
      password: DEFAULT_ADMIN.password,
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
    <main className="relative flex min-h-screen items-center justify-center px-6 py-12">
      <section className="grid w-full max-w-7xl gap-6 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="app-panel-strong overflow-hidden p-8 lg:p-10">
          <div className="flex items-center gap-3">
            <div className="flex h-14 w-14 items-center justify-center rounded-[24px] bg-white text-lg font-bold text-blue-700 shadow-sm">
              JC
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.32em] text-blue-600">
                Jira Clone SaaS
              </p>
              <h1 className="text-2xl font-semibold text-gray-900">
                Delivery control for fast-moving teams
              </h1>
            </div>
          </div>

          <div className="mt-10 max-w-2xl space-y-5">
            <div className="inline-flex rounded-full border border-blue-200 bg-white px-4 py-1 text-[11px] uppercase tracking-[0.28em] text-blue-600 shadow-sm">
              Linear-grade Workflow
            </div>
            <h2 className="text-4xl font-semibold leading-tight text-gray-900 lg:text-5xl">
              Plan projects, track issues, and keep delivery moving without the
              clutter.
            </h2>
            <p className="text-base leading-7 text-gray-600">
              A premium full-stack workspace with authentication, projects,
              issue tracking, assignees, and threaded comments designed for
              modern engineering teams.
            </p>
          </div>

          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {highlights.map((item) => {
              const Icon = item.icon;

              return (
                <div
                  key={item.title}
                  className="rounded-[28px] border border-blue-100 bg-white/85 p-5 shadow-sm"
                >
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-100 text-blue-600">
                    <Icon className="h-5 w-5" />
                  </div>
                  <p className="mt-4 text-base font-semibold text-gray-900">
                    {item.title}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-gray-600">
                    {item.description}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        <Card className="shadow-lg">
          <CardHeader className="space-y-5">
            <div className="inline-flex w-fit rounded-full border border-gray-200 bg-gray-100 p-1">
              <button
                className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                  mode === "login"
                    ? "bg-blue-600 text-white"
                    : "text-gray-600 hover:text-gray-900"
                }`}
                type="button"
                onClick={() => handleModeChange("login")}
              >
                Login
              </button>
              <button
                className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                  mode === "register"
                    ? "bg-blue-600 text-white"
                    : "text-gray-600 hover:text-gray-900"
                }`}
                type="button"
                onClick={() => handleModeChange("register")}
              >
                Register
              </button>
            </div>
            <div>
              <CardTitle>
                {mode === "login" ? "Welcome back" : "Create your workspace"}
              </CardTitle>
              <CardDescription>
                {mode === "login"
                  ? "Sign in with your account to open the dashboard."
                  : "Create a new account and pick the role that fits your team."}
              </CardDescription>
            </div>
          </CardHeader>

          <CardContent>
            <form className="space-y-5" onSubmit={handleSubmit}>
              {successMessage ? (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                  {successMessage}
                </div>
              ) : null}

              {mode === "login" ? (
                <div className="rounded-[24px] border border-blue-200 bg-blue-50 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 text-sm font-semibold text-blue-700">
                        <KeyRound className="h-4 w-4" />
                        Default Admin Access
                      </div>
                      <p className="mt-2 text-sm text-blue-700/80">
                        The backend seeds this account on server startup.
                      </p>
                      <div className="mt-3 space-y-1 text-sm text-blue-700/90">
                        <p>Email: {DEFAULT_ADMIN.email}</p>
                        <p>Password: {DEFAULT_ADMIN.password}</p>
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={fillDefaultCredentials}
                    >
                      Use Default
                    </Button>
                  </div>
                </div>
              ) : null}

              {mode === "register" ? (
                <div className="space-y-2">
                  <label
                    className="text-sm font-medium text-gray-700"
                    htmlFor="fullName"
                  >
                    Full name
                  </label>
                  <Input
                    aria-invalid={Boolean(fieldErrors.fullName)}
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

              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700" htmlFor="email">
                  Email
                </label>
                <Input
                  aria-invalid={Boolean(fieldErrors.email)}
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

              <div className="space-y-2">
                <label
                  className="text-sm font-medium text-gray-700"
                  htmlFor="password"
                >
                  Password
                </label>
                <Input
                  aria-invalid={Boolean(fieldErrors.password)}
                  disabled={authMutation.isPending}
                  id="password"
                  name="password"
                  type="password"
                  placeholder="Enter a secure password"
                  value={formData.password}
                  onChange={handleChange}
                />
                {fieldErrors.password ? (
                  <p className="text-sm text-rose-600">{fieldErrors.password}</p>
                ) : null}
              </div>

              {mode === "register" ? (
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700" htmlFor="role">
                    Role
                  </label>
                  <select
                    aria-invalid={Boolean(fieldErrors.role)}
                    disabled={authMutation.isPending}
                    id="role"
                    name="role"
                    className="field-select"
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
                <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                  {getAuthErrorMessage(authMutation.error)}
                </div>
              ) : null}

              <Button className="w-full" disabled={authMutation.isPending} type="submit">
                {authMutation.isPending
                  ? mode === "login"
                    ? "Signing in..."
                    : "Creating account..."
                  : mode === "login"
                    ? "Access Workspace"
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
      </section>
    </main>
  );
};

export default AuthPage;
