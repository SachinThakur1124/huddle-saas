import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Link, useNavigate } from "react-router-dom";
import { useDispatch } from "react-redux";
import { useLoginMutation } from "./authApi";
import { setCredentials } from "./authSlice";
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
      <form className="card auth-card" onSubmit={handleSubmit(onSubmit)}>
        <h1>Sign in to Huddle</h1>
        <div className="field">
          <label htmlFor="email">Email</label>
          <input id="email" type="email" {...register("email")} />
          {errors.email && <span className="field-error">{errors.email.message}</span>}
        </div>
        <div className="field">
          <label htmlFor="password">Password</label>
          <input id="password" type="password" {...register("password")} />
          {errors.password && <span className="field-error">{errors.password.message}</span>}
        </div>
        {error && <p className="field-error">Invalid email or password.</p>}
        <button className="btn" type="submit" disabled={isLoading}>
          {isLoading ? "Signing in..." : "Sign in"}
        </button>
        <p style={{ marginTop: "1rem" }}>
          No account? <Link to="/register">Register</Link>
        </p>
      </form>
    </div>
  );
}
