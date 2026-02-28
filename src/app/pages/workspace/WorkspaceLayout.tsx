import { useState } from "react";
import { Link, Outlet, useLocation } from "react-router";
import { 
  Menu, 
  X, 
  FileCode, 
  FileJson, 
  Layers,
  Home,
  ChevronLeft,
  ChevronRight
} from "lucide-react";
import { Button } from "../../components/ui/button";
import { cn } from "../../components/ui/utils";

export function WorkspaceLayout() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const location = useLocation();

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
        <div className="h-16 border-b border-[#E2E8F0] flex items-center justify-between px-4">
          {!sidebarCollapsed && (
            <Link to="/" className="flex items-center gap-2">
              <div className="w-8 h-8 bg-[#0F6CBD] rounded-lg flex items-center justify-center">
                <FileCode className="w-5 h-5 text-white" />
              </div>
              <span className="font-semibold text-[#1F2937]">
                AssessmentCore
              </span>
            </Link>
          )}
          {sidebarCollapsed && (
            <div className="w-8 h-8 bg-[#0F6CBD] rounded-lg flex items-center justify-center mx-auto">
              <FileCode className="w-5 h-5 text-white" />
            </div>
          )}
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 p-4 space-y-2">
          <Link to="/">
            
          </Link>

          <div className={cn(!sidebarCollapsed && "mt-6 mb-2 px-3")}>
            {!sidebarCollapsed && (
              <p className="text-xs font-semibold text-[#94A3B8] uppercase tracking-wider">
                Workspace
              </p>
            )}
          </div>

          <Link to="/workspace/qti-renderer">
            <button
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors",
                isActive("/workspace/qti-renderer")
                  ? "bg-[#0F6CBD] text-white"
                  : "hover:bg-[#F1F5F9] text-[#475569]"
              )}
            >
              <FileJson className="w-5 h-5 flex-shrink-0" />
              {!sidebarCollapsed && <span>QTI Renderer</span>}
            </button>
          </Link>

          <Link to="/workspace/batch-creator">
            <button
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors",
                isActive("/workspace/batch-creator")
                  ? "bg-[#0F6CBD] text-white"
                  : "hover:bg-[#F1F5F9] text-[#475569]"
              )}
            >
              <Layers className="w-5 h-5 flex-shrink-0" />
              {!sidebarCollapsed && <span>Batch QTI Creator</span>}
            </button>
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

