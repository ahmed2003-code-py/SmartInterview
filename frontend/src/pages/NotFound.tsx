import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/layout/Logo";
import { useI18n } from "@/i18n";

export default function NotFound() {
  const { d } = useI18n();
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-4 text-center">
      <Logo className="mb-10" />
      <p className="text-sm font-medium text-primary">404</p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight">{d.common.notFound}</h1>
      <p className="mt-2 text-muted">{d.common.notFoundBody}</p>
      <Button asChild className="mt-6">
        <Link to="/">{d.common.goHome}</Link>
      </Button>
    </div>
  );
}
