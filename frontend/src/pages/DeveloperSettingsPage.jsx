import { useEffect, useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { KeyRound, LoaderCircle } from "lucide-react";
import ToastNotice from "@/components/shared/ToastNotice";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { changePasswordRequest } from "@/lib/api";
import { cn } from "@/lib/utils";

const passwordHasLetter = /[A-Za-z]/;
const passwordHasNumber = /\d/;

const initialFormState = {
  currentPassword: "",
  newPassword: "",
  confirmPassword: "",
};

const initialTouchedState = {
  currentPassword: false,
  newPassword: false,
  confirmPassword: false,
};

const getPasswordChecks = (password = "") => ({
  minLength: password.length >= 8,
  hasLetter: passwordHasLetter.test(password),
  hasNumber: passwordHasNumber.test(password),
});

const getStrengthMeta = (password, checks) => {
  if (!password) {
    return {
      label: "Not set",
      tone: "slate",
      width: 0,
    };
  }

  let score = 0;

  if (checks.minLength) {
    score += 1;
  }

  if (checks.hasLetter && checks.hasNumber) {
    score += 1;
  }

  if (password.length >= 12) {
    score += 1;
  }

  if (score <= 1) {
    return {
      label: "Weak",
      tone: "rose",
      width: 34,
    };
  }

  if (score === 2) {
    return {
      label: "Medium",
      tone: "amber",
      width: 68,
    };
  }

  return {
    label: "Strong",
    tone: "emerald",
    width: 100,
  };
};

const PasswordField = ({
  autoComplete,
  disabled,
  error,
  message,
  messageClassName,
  label,
  name,
  onBlur,
  onChange,
  placeholder,
  showPassword,
  value,
}) => (
  <div className="space-y-2">
    <label htmlFor={name} className="text-sm font-medium text-slate-700">
      {label}
    </label>
    <Input
      autoComplete={autoComplete}
      aria-describedby={message ? `${name}-message` : undefined}
      aria-invalid={Boolean(error)}
      className={cn(
        "h-12 rounded-2xl border-slate-200 bg-white px-4 shadow-none transition-all duration-200 focus-visible:border-blue-500 focus-visible:ring-4 focus-visible:ring-blue-500/10",
        error &&
          "border-rose-300 bg-rose-50/70 focus-visible:border-rose-400 focus-visible:ring-rose-500/25"
      )}
      disabled={disabled}
      id={name}
      name={name}
      placeholder={placeholder}
      type={showPassword ? "text" : "password"}
      value={value}
      onBlur={onBlur}
      onChange={onChange}
    />
    {message ? (
      <p
        id={`${name}-message`}
        className={cn("text-sm", messageClassName || "text-slate-500")}
      >
        {message}
      </p>
    ) : null}
  </div>
);

const DeveloperSettingsPage = () => {
  const [formData, setFormData] = useState(initialFormState);
  const [touched, setTouched] = useState(initialTouchedState);
  const [showPassword, setShowPassword] = useState(false);
  const [toast, setToast] = useState(null);

  const passwordChecks = useMemo(
    () => getPasswordChecks(formData.newPassword),
    [formData.newPassword]
  );

  const strengthMeta = useMemo(
    () => getStrengthMeta(formData.newPassword, passwordChecks),
    [formData.newPassword, passwordChecks]
  );

  const validationErrors = useMemo(() => {
    const errors = {};

    if (touched.currentPassword && !formData.currentPassword) {
      errors.currentPassword = "Current password is required";
    }

    if (touched.newPassword) {
      if (!formData.newPassword) {
        errors.newPassword = "New password is required";
      } else if (!passwordChecks.minLength) {
        errors.newPassword = "Password must be at least 8 characters";
      } else if (!passwordChecks.hasLetter || !passwordChecks.hasNumber) {
        errors.newPassword = "Password must include letters and numbers";
      } else if (formData.currentPassword && formData.newPassword === formData.currentPassword) {
        errors.newPassword = "New password must be different from current password";
      }
    }

    if (touched.confirmPassword) {
      if (!formData.confirmPassword) {
        errors.confirmPassword = "Confirm your new password";
      } else if (formData.confirmPassword !== formData.newPassword) {
        errors.confirmPassword = "Confirm password must match";
      }
    }

    return errors;
  }, [formData, passwordChecks, touched]);

  const isFormValid =
    Boolean(formData.currentPassword) &&
    Boolean(formData.newPassword) &&
    Boolean(formData.confirmPassword) &&
    passwordChecks.minLength &&
    passwordChecks.hasLetter &&
    passwordChecks.hasNumber &&
    formData.currentPassword !== formData.newPassword &&
    formData.newPassword === formData.confirmPassword;

  const isUpdateDisabled = !isFormValid || changePasswordMutation.isPending;

  const currentPasswordMessage = validationErrors.currentPassword || "";
  const newPasswordMessage = validationErrors.newPassword || "";
  const confirmPasswordMessage = validationErrors.confirmPassword
    ? validationErrors.confirmPassword
    : touched.confirmPassword && formData.confirmPassword
      ? "Passwords match."
      : "";

  useEffect(() => {
    if (!toast?.id) {
      return undefined;
    }

    const timer = window.setTimeout(() => {
      setToast(null);
    }, 3600);

    return () => window.clearTimeout(timer);
  }, [toast?.id]);

  const changePasswordMutation = useMutation({
    mutationFn: changePasswordRequest,
    onSuccess: (data) => {
      setToast({
        id: Date.now(),
        type: "success",
        message: data.message || "Password updated successfully",
      });
      setFormData(initialFormState);
      setTouched(initialTouchedState);
      setShowPassword(false);
    },
    onError: (error) => {
      setToast({
        id: Date.now(),
        type: "error",
        message:
          error.response?.data?.message ||
          "Unable to update your password right now.",
      });
    },
  });

  const handleFieldChange = (event) => {
    const { name, value } = event.target;

    changePasswordMutation.reset();

    setFormData((current) => ({
      ...current,
      [name]: value,
    }));
  };

  const handleFieldBlur = (event) => {
    const { name } = event.target;

    setTouched((current) => ({
      ...current,
      [name]: true,
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    setTouched({
      currentPassword: true,
      newPassword: true,
      confirmPassword: true,
    });

    if (!isFormValid) {
      return;
    }

    try {
      await changePasswordMutation.mutateAsync({
        currentPassword: formData.currentPassword,
        newPassword: formData.newPassword,
      });
    } catch (error) {
      return error;
    }

    return undefined;
  };

  return (
    <div className="page-wrapper">
      <ToastNotice toast={toast} onDismiss={() => setToast(null)} />

      <div className="mx-auto mt-6 w-full max-w-[500px] sm:mt-10">
        <Card className="w-full rounded-2xl border border-slate-200/90 bg-white shadow-[0_24px_64px_-36px_rgba(15,23,42,0.26)] transition-shadow duration-200">
          <CardHeader className="space-y-1.5 px-6 pb-0 pt-6 sm:px-8 sm:pt-8">
            <div className="space-y-2">
              <CardTitle className="text-2xl tracking-tight text-slate-950">
                Change Password
              </CardTitle>
              <CardDescription className="text-sm text-slate-600">
                Update your password securely
              </CardDescription>
            </div>
          </CardHeader>

          <CardContent className="px-6 pb-6 pt-6 sm:px-8 sm:pb-8">
            <form className="space-y-5" onSubmit={handleSubmit}>
              <PasswordField
                autoComplete="current-password"
                disabled={changePasswordMutation.isPending}
                error={validationErrors.currentPassword}
                label="Current Password"
                message={currentPasswordMessage}
                messageClassName={validationErrors.currentPassword ? "text-rose-600" : undefined}
                name="currentPassword"
                placeholder="Enter your current password"
                showPassword={showPassword}
                value={formData.currentPassword}
                onBlur={handleFieldBlur}
                onChange={handleFieldChange}
              />

              <div className="space-y-3">
                <PasswordField
                  autoComplete="new-password"
                  disabled={changePasswordMutation.isPending}
                  error={validationErrors.newPassword}
                  label="New Password"
                  message={newPasswordMessage}
                  messageClassName={validationErrors.newPassword ? "text-rose-600" : undefined}
                  name="newPassword"
                  placeholder="Create a stronger password"
                  showPassword={showPassword}
                  value={formData.newPassword}
                  onBlur={handleFieldBlur}
                  onChange={handleFieldChange}
                />

                <div className="space-y-2">
                  <p className="text-xs text-slate-500">
                    Use at least 8 characters and include letters and numbers.
                  </p>
                  <div className="flex items-center gap-3">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className={cn(
                          "h-full rounded-full transition-all duration-300 ease-out",
                          strengthMeta.tone === "emerald" && "bg-emerald-500",
                          strengthMeta.tone === "amber" && "bg-amber-400",
                          strengthMeta.tone === "rose" && "bg-rose-500",
                          strengthMeta.tone === "slate" && "bg-slate-300"
                        )}
                        style={{ width: `${strengthMeta.width}%` }}
                      />
                    </div>
                    <span
                      className={cn(
                        "min-w-[56px] text-right text-xs font-semibold transition-colors duration-200",
                        strengthMeta.tone === "emerald" &&
                          "text-emerald-600",
                        strengthMeta.tone === "amber" && "text-amber-600",
                        strengthMeta.tone === "rose" && "text-rose-600",
                        strengthMeta.tone === "slate" && "text-slate-500"
                      )}
                    >
                      {strengthMeta.label}
                    </span>
                  </div>
                </div>
              </div>

              <PasswordField
                autoComplete="new-password"
                disabled={changePasswordMutation.isPending}
                error={validationErrors.confirmPassword}
                label="Confirm New Password"
                message={confirmPasswordMessage}
                messageClassName={
                  validationErrors.confirmPassword
                    ? "text-rose-600"
                    : "text-emerald-600"
                }
                name="confirmPassword"
                placeholder="Re-enter your new password"
                showPassword={showPassword}
                value={formData.confirmPassword}
                onBlur={handleFieldBlur}
                onChange={handleFieldChange}
              />

              <label className="flex items-center gap-3 text-sm text-slate-600">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500/30"
                  checked={showPassword}
                  disabled={changePasswordMutation.isPending}
                  onChange={(event) => setShowPassword(event.target.checked)}
                />
                <span>Show Password</span>
              </label>

              <Button
                className="mt-1 h-12 w-full rounded-2xl bg-gradient-to-r from-blue-600 to-sky-500 text-white shadow-[0_18px_34px_-18px_rgba(37,99,235,0.55)] transition-all duration-200 hover:-translate-y-0.5 hover:from-blue-700 hover:to-sky-600 hover:shadow-[0_22px_42px_-18px_rgba(37,99,235,0.62)]"
                disabled={isUpdateDisabled}
                type="submit"
              >
                {changePasswordMutation.isPending ? (
                  <>
                    <LoaderCircle className="h-4 w-4 animate-spin" />
                    Updating...
                  </>
                ) : (
                  <>
                    <KeyRound className="h-4 w-4" />
                    Update Password
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default DeveloperSettingsPage;
