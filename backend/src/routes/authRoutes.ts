import { Router } from "express";
import { z } from "zod";
import { AuthService } from "../services/authService";

export const authRoutes = Router();

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1),
});

authRoutes.post("/register", async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }
  try {
    const result = await AuthService.register(
      parsed.data.email,
      parsed.data.password,
      parsed.data.name,
    );
    res.status(201).json(result);
  } catch (err) {
    res.status(409).json({ error: (err as Error).message });
  }
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

authRoutes.post("/login", async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }
  try {
    const result = await AuthService.login(parsed.data.email, parsed.data.password);
    res.status(200).json(result);
  } catch (err) {
    res.status(401).json({ error: (err as Error).message });
  }
});

const refreshSchema = z.object({ refreshToken: z.string().min(1) });

authRoutes.post("/refresh", async (req, res) => {
  const parsed = refreshSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }
  try {
    const result = await AuthService.refresh(parsed.data.refreshToken);
    res.status(200).json(result);
  } catch (err) {
    res.status(401).json({ error: (err as Error).message });
  }
});

authRoutes.post("/logout", async (req, res) => {
  const parsed = refreshSchema.safeParse(req.body);
  if (parsed.success) {
    await AuthService.logout(parsed.data.refreshToken);
  }
  res.status(204).send();
});
