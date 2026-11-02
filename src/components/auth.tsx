"use client";
import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Modal } from "./ui/dialog";
import { Button } from "./ui/button";
import { browserDb } from "@/lib/supabase/client";
const schema = z.object({ email: z.email(), password: z.string() });
export function Auth({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [mode, setMode] = useState<"login" | "register" | "reset">("login"),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { email: "", password: "" },
  });
  useEffect(() => {
    if (new URLSearchParams(location.search).get("auth_error"))
      setMessage(
        "This sign-in or recovery link is invalid or expired. Request a new link.",
      );
  }, []);
  async function submit(values: z.infer<typeof schema>) {
    setBusy(true);
    setMessage("");
    try {
      const db = browserDb();
      if (mode === "register" && values.password.length < 12)
        throw new Error("Use at least 12 characters.");
      const result =
        mode === "login"
          ? await db.auth.signInWithPassword(values)
          : mode === "register"
            ? await db.auth.signUp({
                ...values,
                options: {
                  emailRedirectTo: `${location.origin}/auth/callback`,
                },
              })
            : await db.auth.resetPasswordForEmail(values.email, {
                redirectTo: `${location.origin}/auth/callback?recovery=1`,
              });
      if (result.error) throw result.error;
      if (mode === "login") {
        onOpenChange(false);
        location.assign("/dashboard");
      } else
        setMessage("Check your email for the confirmation or recovery link.");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Authentication failed");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={
        mode === "login"
          ? "Welcome to your fortress"
          : mode === "register"
            ? "Create your account"
            : "Reset your password"
      }
    >
      <p className="muted">
        Secure access to verified domains, saved scans and AutoDefense.
      </p>
      <form onSubmit={handleSubmit(submit)} className="stack">
        <label>
          Email address
          <input
            type="email"
            autoComplete="email"
            {...register("email")}
            required
          />
        </label>
        {errors.email ? <p role="alert">Enter a valid email.</p> : null}
        {mode !== "reset" ? (
          <label>
            Password
            <input
              type="password"
              autoComplete={
                mode === "register" ? "new-password" : "current-password"
              }
              {...register("password")}
              required
              minLength={mode === "register" ? 12 : 1}
            />
          </label>
        ) : null}
        <Button disabled={busy}>
          {busy
            ? "Please wait…"
            : mode === "login"
              ? "Sign in"
              : mode === "register"
                ? "Create account"
                : "Send recovery email"}
        </Button>
      </form>
      <p role="status">{message}</p>
      <div className="row wrap">
        {(["login", "register", "reset"] as const)
          .filter((x) => x !== mode)
          .map((x) => (
            <Button
              key={x}
              variant="ghost"
              onClick={() => {
                setMode(x);
                setMessage("");
              }}
            >
              {x === "login"
                ? "Sign in"
                : x === "register"
                  ? "Create account"
                  : "Forgot password?"}
            </Button>
          ))}
      </div>
    </Modal>
  );
}
