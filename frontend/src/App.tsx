import { lazy, Suspense } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster } from "sonner";
import { I18nProvider, useI18n } from "@/i18n";
import { ThemeProvider, useTheme } from "@/lib/theme";
import { AuthProvider } from "@/lib/auth";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppLayout } from "@/components/layout/AppLayout";
import { GuestOnly, RequireAuth } from "@/components/layout/RequireAuth";
import { Spinner } from "@/components/ui/spinner";
import { MotionProvider } from "@/lib/motion";
import Landing from "@/pages/Landing";
import { LoginPage, RegisterPage } from "@/pages/Auth";
import NotFound from "@/pages/NotFound";

const Dashboard = lazy(() => import("@/pages/Dashboard"));
const Setup = lazy(() => import("@/pages/Setup"));
const History = lazy(() => import("@/pages/History"));
const Report = lazy(() => import("@/pages/Report"));
const InterviewRoom = lazy(() => import("@/pages/InterviewRoom"));

function Toasts() {
  const { resolved } = useTheme();
  const { dir } = useI18n();
  return <Toaster theme={resolved} dir={dir} position={dir === "rtl" ? "bottom-left" : "bottom-right"} toastOptions={{ className: "!font-sans" }} />;
}

const fallback = (
  <div className="grid min-h-[60vh] place-items-center text-muted">
    <Spinner />
  </div>
);

export default function App() {
  return (
    <ThemeProvider>
      <I18nProvider>
        <AuthProvider>
          <TooltipProvider>
            <MotionProvider>
            <BrowserRouter>
              <Suspense fallback={fallback}>
                <Routes>
                  <Route path="/" element={<Landing />} />
                  <Route element={<GuestOnly />}>
                    <Route path="/login" element={<LoginPage />} />
                    <Route path="/register" element={<RegisterPage />} />
                  </Route>
                  <Route element={<RequireAuth />}>
                    <Route path="/interviews/:id" element={<InterviewRoom />} />
                    <Route element={<AppLayout />}>
                      <Route path="/dashboard" element={<Dashboard />} />
                      <Route path="/interviews/new" element={<Setup />} />
                      <Route path="/interviews/:id/report" element={<Report />} />
                      <Route path="/history" element={<History />} />
                    </Route>
                  </Route>
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </Suspense>
            </BrowserRouter>
            </MotionProvider>
            <Toasts />
          </TooltipProvider>
        </AuthProvider>
      </I18nProvider>
    </ThemeProvider>
  );
}
