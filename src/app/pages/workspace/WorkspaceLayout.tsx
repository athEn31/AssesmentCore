import { useState } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router";
import { 
  FileCode, 
  FileJson, 
  Layers,
  Download,
  User,
  LogOut,
  Home,
  ChevronLeft,
  ChevronRight
} from "lucide-react";
import { Button } from "../../components/ui/button";
import { cn } from "../../components/ui/utils";
import { Progress } from "../../components/ui/progress";
import { useAuth } from "../../../contexts/AuthContext";

export function WorkspaceLayout() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, userUsage, logout } = useAuth();

  const exportedQuestions = userUsage?.total_questions_converted || 0;
  const isUnlimited = !!userUsage?.is_unlimited;
  const freeQuestionQuota = 100;
  const remainingQuestions = Math.max(freeQuestionQuota - exportedQuestions, 0);
  const quotaProgress = isUnlimited
    ? 100
    : Math.min((exportedQuestions / freeQuestionQuota) * 100, 100);

  const handleLogout = async () => {
    if (isLoggingOut) return;
    setIsLoggingOut(true);
    try {
      await logout();
      navigate("/auth/login", { replace: true });
    } finally {
      setIsLoggingOut(false);
    }
  };

  const isActive = (path: string) => {
    if (path === "/workspace" && location.pathname === "/workspace") return true;
    if (path !== "/workspace" && location.pathname.includes(path)) return true;
    return false;
  };

  return (
    <div className="flex h-screen bg-[#F8FAFC]">
      {/* Sidebar */}
      <aside
        className={cn(
          "bg-[#FFFFFF] border-r border-[#E2E8F0] transition-all duration-300 flex flex-col",
          sidebarCollapsed ? "w-16" : "w-64"
        )}
      >
        {/* Sidebar Header */}
        <div className="h-28 border-b border-[#E2E8F0] px-4 py-2">
          {!sidebarCollapsed ? (
            <div className="h-full flex flex-col justify-center gap-1.5">
              <Link to="/" className="flex items-center gap-2">
                <div className="w-8 h-8 bg-[#0F6CBD] rounded-lg flex items-center justify-center">
                  <FileCode className="w-5 h-5 text-white" />
                </div>
                <span className="font-semibold text-[#1F2937]">AssessmentCore</span>
              </Link>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-[#334155]">
                  <div className="w-6 h-6 rounded-full bg-[#E0F2FE] border border-[#BAE6FD] flex items-center justify-center">
                    <User className="w-3.5 h-3.5 text-[#0F6CBD]" />
                  </div>
                  <span className="text-xs font-medium truncate max-w-[100px]">
                    {user?.email?.split("@")[0] || "Profile"}
                  </span>
                </div>
                <span className="text-xs font-semibold text-[#0F6CBD]">
                  {exportedQuestions} exported
                </span>
              </div>

              <div className="flex items-center gap-2">
                <div className="flex-1 min-w-0">
                  <Progress value={quotaProgress} className="h-1.5 bg-[#E2E8F0] [&_[data-slot=progress-indicator]]:bg-[#0F6CBD]" />
                  <p className="text-[10px] text-[#64748B] mt-0.5 truncate">
                    {isUnlimited
                      ? `Unlimited plan • ${exportedQuestions} questions exported`
                      : `${remainingQuestions} of ${freeQuestionQuota} questions left`}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleLogout}
                  disabled={isLoggingOut}
                  className="h-7 px-2 border-[#CBD5E1] text-[#334155] hover:bg-[#F8FAFC]"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span className="text-xs">Logout</span>
                </Button>
              </div>
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center gap-2">
              {/* App icon */}
              <div className="w-8 h-8 bg-[#0F6CBD] rounded-lg flex items-center justify-center">
                <FileCode className="w-5 h-5 text-white" />
              </div>
              {/* Avatar dot */}
              <div
                className="w-7 h-7 rounded-full bg-[#E0F2FE] border border-[#BAE6FD] flex items-center justify-center"
                title={user?.email || "Profile"}
              >
                <User className="w-3.5 h-3.5 text-[#0F6CBD]" />
              </div>
              {/* Logout icon button */}
              <button
                onClick={handleLogout}
                disabled={isLoggingOut}
                title="Logout"
                className="w-7 h-7 rounded-md flex items-center justify-center text-[#475569] hover:bg-[#F1F5F9] hover:text-[#DC2626] transition-colors disabled:opacity-50"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 p-4 space-y-2">
          <Link
            to="/"
            className={cn(
              "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors hover:bg-[#F1F5F9] text-[#475569]",
              sidebarCollapsed && "justify-center px-0"
            )}
          >
            <Home className="w-5 h-5 flex-shrink-0" />
            {!sidebarCollapsed && <span>Home</span>}
          </Link>

          <div className={cn(!sidebarCollapsed && "mt-4 mb-2 px-3")}>
            {!sidebarCollapsed && (
              <p className="text-xs font-semibold text-[#94A3B8] uppercase tracking-wider">
                Workspace
              </p>
            )}
          </div>

          <Link
            to="/workspace/qti-renderer"
            className={cn(
              "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors",
              sidebarCollapsed && "justify-center px-0",
              isActive("/workspace/qti-renderer")
                ? "bg-[#0F6CBD] text-white"
                : "hover:bg-[#F1F5F9] text-[#475569]"
            )}
          >
            <FileJson className="w-5 h-5 flex-shrink-0" />
            {!sidebarCollapsed && <span>QTI Renderer</span>}
          </Link>

          <Link
            to="/workspace/batch-creator"
            className={cn(
              "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors",
              sidebarCollapsed && "justify-center px-0",
              isActive("/workspace/batch-creator")
                ? "bg-[#0F6CBD] text-white"
                : "hover:bg-[#F1F5F9] text-[#475569]"
            )}
          >
            <Layers className="w-5 h-5 flex-shrink-0" />
            {!sidebarCollapsed && <span>Batch QTI Creator</span>}
          </Link>

          <Link
            to="/workspace/lms-export"
            className={cn(
              "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors",
              sidebarCollapsed && "justify-center px-0",
              isActive("/workspace/lms-export")
                ? "bg-[#0F6CBD] text-white"
                : "hover:bg-[#F1F5F9] text-[#475569]"
            )}
          >
            <Download className="w-5 h-5 flex-shrink-0" />
            {!sidebarCollapsed && <span>Export to LMS</span>}
          </Link>
        </nav>

        {/* Collapse Toggle Button */}
        <div className="p-4 border-t border-[#E2E8F0]">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="w-full border border-[#334155] text-[#1F2937] hover:bg-[#F1F5F9] rounded-md"
          >
            {sidebarCollapsed ? (
              <ChevronRight className="w-4 h-4" />
            ) : (
              <>
                <ChevronLeft className="w-4 h-4 mr-2" />
                Collapse
              </>
            )}
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}

