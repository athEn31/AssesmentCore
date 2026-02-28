import { createBrowserRouter } from "react-router";
import { LandingPage } from "./pages/LandingPage";
import { WorkspaceLayout } from "./pages/workspace/WorkspaceLayout";
import { QTIRenderer } from "./pages/workspace/QTIRenderer";
import { BatchCreator } from "./pages/workspace/BatchCreator";
import { RegisterPage } from "./pages/auth/RegisterPage";
import { LoginPage } from "./pages/auth/LoginPage";
import { VerifyEmailPage } from "./pages/auth/VerifyEmailPage";
import { ForgotPasswordPage } from "./pages/auth/ForgotPasswordPage";
import { ResetPasswordPage } from "./pages/auth/ResetPasswordPage";
import { PricingPage } from "./pages/PricingPage";

export const router = createBrowserRouter([
  {
    path: "/",
    Component: LandingPage,
  },
  {
    path: "/auth",
    children: [
      {
        path: "register",
        Component: RegisterPage,
      },
      {
        path: "login",
        Component: LoginPage,
      },
      {
        path: "verify-email",
        Component: VerifyEmailPage,
      },
      {
        path: "forgot-password",
        Component: ForgotPasswordPage,
      },
      {
        path: "reset-password",
        Component: ResetPasswordPage,
      },
    ],
  },
  {
    path: "/pricing",
    Component: PricingPage,
  },
  {
    path: "/workspace",
    Component: WorkspaceLayout,
    children: [
      {
        index: true,
        Component: QTIRenderer,
      },
      {
        path: "qti-renderer",
        Component: QTIRenderer,
      },
      {
        path: "batch-creator",
        Component: BatchCreator,
      },
    ],
  },
]);
