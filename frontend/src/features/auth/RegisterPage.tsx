import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Link, useNavigate } from "react-router-dom";
import { useDispatch } from "react-redux";
import { useRegisterMutation } from "./authApi";
import { setCredentials } from "./authSlice";
import { getErrorMessage } from "../../app/errors";
import type { AppDispatch } from "../../app/store";

const schema = z.object({
  name: z.string().min(1, "Name is required").max(100, "Keep it under 100 characters"),
  email: z.string().email("Enter a valid email"),
  password: z.string().min(8, "At least 8 characters"),
});
type FormValues = z.infer<typeof schema>;

export function RegisterPage() {
  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate();
  const [registerUser, { isLoading, error }] = useRegisterMutation();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  async function onSubmit(values: FormValues) {
    const result = await registerUser(values).unwrap();
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
        <h1>Create your account</h1>
        <p className="auth-subtitle">Pages, boards, and chat for your whole team.</p>
        <div className="field">
          <label htmlFor="name">Name</label>
          <input id="name" autoComplete="name" maxLength={100} {...register("name")} />
          {errors.name && <span className="field-error">{errors.name.message}</span>}
        </div>
        <div className="field">
          <label htmlFor="email">Email</label>
          <input id="email" type="email" autoComplete="email" {...register("email")} />
          {errors.email && <span className="field-error">{errors.email.message}</span>}
        </div>
        <div className="field">
          <label htmlFor="password">Password</label>
          <input id="password" type="password" autoComplete="new-password" {...register("password")} />
          {errors.password && <span className="field-error">{errors.password.message}</span>}
        </div>
        {error && (
          <div className="alert alert-error">
            {getErrorMessage(error, "Could not create account. Try a different email.")}
          </div>
        )}
        <button className="btn" type="submit" disabled={isLoading} style={{ width: "100%" }}>
          {isLoading ? <span className="spinner" /> : "Create account"}
        </button>
        <p style={{ marginTop: "1.2rem", fontSize: "0.9rem", color: "var(--text-muted)" }}>
          Already have an account? <Link to="/login">Sign in</Link>
        </p>
      </form>
    </div>
  );
}
