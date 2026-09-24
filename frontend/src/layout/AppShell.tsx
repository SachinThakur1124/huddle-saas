import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { ErrorBoundary } from "../components/ErrorBoundary";
import { ThemeToggle } from "../components/ThemeToggle";
import { WorkspaceSwitcher } from "../features/workspaces/WorkspaceSwitcher";
import { SearchBar } from "../features/search/SearchBar";
import { clearCredentials, selectCurrentUser } from "../features/auth/authSlice";
import { disconnectSocket } from "../features/chat/socket";
import type { AppDispatch } from "../app/store";

function RouteFallback() {
  return <div className="error-fallback">Something went wrong loading this page.</div>;
}

export function AppShell() {
  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate();
  const user = useSelector(selectCurrentUser);

  function handleLogout() {
    disconnectSocket();
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
