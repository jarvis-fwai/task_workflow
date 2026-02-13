"use client";

import { useState, useMemo } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { trpc } from "@/lib/trpc";

const googleEnabled = process.env.NEXT_PUBLIC_GOOGLE_ENABLED === "true";

function getErrorMessage(err: any): string {
  const msg = err?.message ?? "";

  // Duplicate email
  if (
    msg.toLowerCase().includes("already exists") ||
    msg.toLowerCase().includes("conflict") ||
    msg.toLowerCase().includes("duplicate") ||
    err?.data?.code === "CONFLICT"
  ) {
    return "An account with this email already exists";
  }

  // Validation errors from zod
  if (msg.includes("too_small") || msg.includes("at least 8")) {
    return "Password must be at least 8 characters";
  }
  if (msg.includes("invalid_string") || msg.includes("Invalid email")) {
    return "Please enter a valid email address";
  }
  if (msg.includes("Name is required")) {
    return "Name is required";
  }

  // Network / connection errors
  if (
    msg.toLowerCase().includes("fetch") ||
    msg.toLowerCase().includes("network") ||
    msg.toLowerCase().includes("failed to fetch") ||
    msg.toLowerCase().includes("econnrefused")
  ) {
    return "Connection failed, please try again";
  }

  // Fallback — show the server message if available
  return msg || "Something went wrong. Please try again.";
}

interface ValidationErrors {
  name?: string;
  email?: string;
  password?: string;
}

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  const validation = useMemo((): ValidationErrors => {
    const errs: ValidationErrors = {};
    if (touched.name && !name.trim()) {
      errs.name = "Name is required";
    }
    if (touched.email && email) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        errs.email = "Please enter a valid email address";
      }
    }
    if (touched.email && !email) {
      errs.email = "Email is required";
    }
    if (touched.password && password) {
      if (password.length < 8) {
        errs.password = "Password must be at least 8 characters";
      }
    }
    if (touched.password && !password) {
      errs.password = "Password is required";
    }
    return errs;
  }, [name, email, password, touched]);

  const hasValidationErrors = Object.keys(validation).length > 0;

  const registerMutation = trpc.auth.register.useMutation({
    onSuccess: async () => {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });
      if (result?.ok) {
        router.push("/home");
        router.refresh();
      } else {
        setError("Account created but login failed. Please try logging in.");
      }
    },
    onError: (err) => {
      setError(getErrorMessage(err));
    },
  });

  const handleBlur = (field: string) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    // Mark all fields as touched
    setTouched({ name: true, email: true, password: true });

    // Client-side validation
    if (!name.trim()) {
      setError("Name is required");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("Please enter a valid email address");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }

    registerMutation.mutate({ name: name.trim(), email: email.trim(), password });
  };

  const handleGoogleSignIn = () => {
    signIn("google", { callbackUrl: "/home" });
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2 text-center">
        <h1 className="text-3xl font-semibold tracking-tight">
          Create your account
        </h1>
        <p className="text-muted-foreground">
          Start managing projects with AI
        </p>
      </div>

      {googleEnabled && (
        <>
          <Button
            variant="outline"
            className="w-full justify-center gap-3 py-5 text-sm font-normal"
            onClick={handleGoogleSignIn}
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5">
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                fill="#4285F4"
              />
              <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
              />
              <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                fill="#FBBC05"
              />
              <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                fill="#EA4335"
              />
            </svg>
            Continue with Google
          </Button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <Separator />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-white px-4 text-muted-foreground">or</span>
            </div>
          </div>
        </>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="name">Full name</Label>
          <Input
            id="name"
            type="text"
            placeholder="Your full name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => handleBlur("name")}
            required
            autoFocus
            className={cn(validation.name && "border-destructive")}
          />
          {validation.name && (
            <p className="text-xs text-destructive">{validation.name}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="email">Email address</Label>
          <Input
            id="email"
            type="email"
            placeholder="name@company.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onBlur={() => handleBlur("email")}
            required
            className={cn(validation.email && "border-destructive")}
          />
          {validation.email && (
            <p className="text-xs text-destructive">{validation.email}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            placeholder="At least 8 characters"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onBlur={() => handleBlur("password")}
            required
            minLength={8}
            className={cn(validation.password && "border-destructive")}
          />
          {validation.password && (
            <p className="text-xs text-destructive">{validation.password}</p>
          )}
          {touched.password && password.length > 0 && password.length < 8 && (
            <div className="flex gap-1 mt-1">
              {Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className={cn(
                    "h-1 flex-1 rounded-full",
                    password.length >= (i + 1) * 2 ? "bg-yellow-500" : "bg-gray-200",
                    password.length >= 8 && "bg-green-500"
                  )}
                />
              ))}
            </div>
          )}
        </div>

        {error && (
          <div className="rounded-md border border-destructive/50 bg-destructive/5 p-3">
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}

        <Button
          type="submit"
          className="w-full bg-[#4573D2] py-5 hover:bg-[#3A63B8]"
          disabled={registerMutation.isPending || hasValidationErrors}
        >
          {registerMutation.isPending ? "Creating account..." : "Sign up"}
        </Button>
      </form>

      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link href="/login" className="text-[#4573D2] hover:underline">
          Log in
        </Link>
      </p>
    </div>
  );
}
