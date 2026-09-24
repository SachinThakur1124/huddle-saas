import { useEffect } from "react";
import { NavLink, Outlet, useNavigate, useParams } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { ErrorBoundary } from "../components/ErrorBoundary";
import { ThemeToggle } from "../components/ThemeToggle";
import { WorkspaceSwitcher } from "../features/workspaces/WorkspaceSwitcher";
import { SearchBar } from "../features/search/SearchBar";
import { clearCredentials, selectCurrentUser } from "../features/auth/authSlice";
import { useLogoutMutation } from "../features/auth/authApi";
import { disconnectSocket, joinWorkspace } from "../features/chat/socket";
import { api } from "../app/api";
import type { AppDispatch, RootState } from "../app/store";

function selectRefreshToken(state: RootState): string | null {
  return state.auth.refreshToken;
}

function RouteFallback() {
  return <div className="error-fallback">Something went wrong loading this page.</div>;
}

export function AppShell() {
  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate();
  const user = useSelector(selectCurrentUser);
  const refreshToken = useSelector(selectRefreshToken);
  const { workspaceId } = useParams();
  const [logout] = useLogoutMutation();

  useEffect(() => {
    if (workspaceId) joinWorkspace(workspaceId);
  }, [workspaceId]);

  async function handleLogout() {
    disconnectSocket();
    if (refreshToken) {
      try {
        await logout({ refreshToken }).unwrap();
      } catch {
        // best-effort server-side revoke; proceed with client logout regardless
      }
    }
    // Clear all cached queries so a different user logging in on the same
    // tab never sees the previous user's workspaces/messages before a
    // fresh fetch completes.
    dispatch(api.util.resetApiState());
    dispatch(clearCredentials());
    navigate("/login");
  }

  return (
    <div className="app-shell">
      <aside className="app-sidebar">
        <WorkspaceSwitcher />
        <nav>
          <NavLink to="pages" className="nav-link">
            Pages
          </NavLink>
          <NavLink to="boards" className="nav-link">
            Boards
          </NavLink>
          <NavLink to="chat" className="nav-link">
            Chat
          </NavLink>
        </nav>
        <div style={{ marginTop: "auto" }}>
          <button type="button" className="btn btn-ghost" onClick={handleLogout}>
            Log out {user ? `(${user.name})` : ""}
          </button>
        </div>
      </aside>
      <div className="app-main">
        <header className="app-topbar">
          <SearchBar />
          <ThemeToggle />
        </header>
        <main className="app-content">
          <ErrorBoundary fallback={<RouteFallback />}>
            <Outlet />
          </ErrorBoundary>
        </main>
      </div>
    </div>
  );
}
