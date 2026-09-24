import { Socket } from "socket.io";
import { AuthService } from "../services/authService";

export function socketAuthMiddleware(
  socket: Socket,
  next: (err?: Error) => void,
) {
  const token = socket.handshake.auth?.token as string | undefined;
  if (!token) {
    return next(new Error("Missing auth token"));
  }
  try {
    const payload = AuthService.verifyAccessToken(token);
    socket.data.userId = payload.sub;
    next();
  } catch {
    next(new Error("Invalid or expired token"));
  }
}
