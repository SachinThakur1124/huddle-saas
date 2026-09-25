import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Link, useNavigate } from "react-router-dom";
import { useDispatch } from "react-redux";
import { useLoginMutation } from "./authApi";
import { setCredentials } from "./authSlice";
import { getErrorMessage } from "../../app/errors";
import type { AppDispatch } from "../../app/store";

const schema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(1, "Password is required"),
});
type FormValues = z.infer<typeof schema>;

export function LoginPage() {
  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate();
  const [login, { isLoading, error }] = useLoginMutation();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  async function onSubmit(values: FormValues) {
    const result = await login(values).unwrap();
    dispatch(setCredentials(result));
    navigate("/workspaces");
  }

  return (
    <div className="auth-screen">
      <div className="auth-brand">
        <span className="app-brand-mark" aria-hidden="true">
          H
        </span>
        Huddle
      </div>
      <form className="card auth-card" onSubmit={handleSubmit(onSubmit)} noValidate>
        <h1>Sign in</h1>
        <p className="auth-subtitle">Pick up where your team left off.</p>
        <div className="field">
          <label htmlFor="email">Email</label>
          <input id="email" type="email" autoComplete="email" {...register("email")} />
          {errors.email && <span className="field-error">{errors.email.message}</span>}
        </div>
        <div className="field">
          <label htmlFor="password">Password</label>
          <input id="password" type="password" autoComplete="current-password" {...register("password")} />
          {errors.password && <span className="field-error">{errors.password.message}</span>}
        </div>
        {error && <div className="alert alert-error">{getErrorMessage(error, "Invalid email or password.")}</div>}
        <button className="btn" type="submit" disabled={isLoading} style={{ width: "100%" }}>
          {isLoading ? <span className="spinner" /> : "Sign in"}
        </button>
        <p style={{ marginTop: "1.2rem", fontSize: "0.9rem", color: "var(--text-muted)" }}>
          No account? <Link to="/register">Create one</Link>
        </p>
      </form>
    </div>
  );
}
