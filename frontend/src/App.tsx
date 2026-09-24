import { Navigate, Route, Routes } from "react-router-dom";
import { LoginPage } from "./features/auth/LoginPage";
import { RegisterPage } from "./features/auth/RegisterPage";
import { ProtectedRoute } from "./features/auth/ProtectedRoute";
import { WorkspaceListPage } from "./features/workspaces/WorkspaceListPage";
import { AppShell } from "./layout/AppShell";
import { PagesListPage } from "./features/pages/PagesListPage";
import { PageDetailPage } from "./features/pages/PageDetailPage";
import { BoardsListPage } from "./features/boards/BoardsListPage";
import { BoardPage } from "./features/boards/BoardPage";
import { ChatChannelListPage } from "./features/chat/ChatChannelListPage";
import { ChatPage } from "./features/chat/ChatPage";

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />

      <Route element={<ProtectedRoute />}>
        <Route path="/workspaces" element={<WorkspaceListPage />} />
        <Route path="/workspaces/:workspaceId" element={<AppShell />}>
          <Route index element={<Navigate to="pages" replace />} />
          <Route path="pages" element={<PagesListPage />} />
          <Route path="pages/:pageId" element={<PageDetailPage />} />
          <Route path="boards" element={<BoardsListPage />} />
          <Route path="boards/:boardId" element={<BoardPage />} />
          <Route path="chat" element={<ChatChannelListPage />} />
          <Route path="chat/:channelId" element={<ChatPage />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/workspaces" replace />} />
    </Routes>
  );
}
