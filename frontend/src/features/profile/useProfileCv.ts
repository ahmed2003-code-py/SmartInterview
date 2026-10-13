import { useState } from "react";
import { toast } from "sonner";
import { api, ApiError, type CvProposal, type User } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/i18n";

const CV_MAX = 5 * 1024 * 1024;
type Review = { proposal: CvProposal } | null;

/** Upload / retry / remove the account's primary CV. Returns the review proposal after a successful extraction. */
export function useProfileCv() {
  const { d } = useI18n();
  const { setUser } = useAuth();
  const [busy, setBusy] = useState<"upload" | "retry" | "remove" | null>(null);

  const message = (err: unknown) => {
    if (err instanceof ApiError) {
      if (err.status === 413) return d.profileCv.errTooBig;
      if (err.code === "CV_UNSUPPORTED") return d.profileCv.errUnsupported;
      if (err.code === "CV_UNREADABLE") return d.profileCv.errUnreadable;
      if (err.code === "NETWORK_ERROR") return d.room.errors.network;
    }
    return d.profileCv.errFailed;
  };

  async function upload(file: File): Promise<Review> {
    if (file.size > CV_MAX) {
      toast.error(d.profileCv.errTooBig);
      return null;
    }
    setBusy("upload");
    try {
      const form = new FormData();
      form.append("cv", file, file.name);
      const res = await api.post<{ user: User; review: Review }>("/profile/cv", form);
      setUser(res.user);
      if (res.user.cv?.status === "failed") toast.error(d.profileCv.failed);
      return res.review;
    } catch (err) {
      toast.error(message(err));
      return null;
    } finally {
      setBusy(null);
    }
  }

  async function retry(): Promise<Review> {
    setBusy("retry");
    try {
      const res = await api.post<{ user: User; review: Review }>("/profile/cv/retry");
      setUser(res.user);
      return res.review;
    } catch (err) {
      toast.error(message(err));
      return null;
    } finally {
      setBusy(null);
    }
  }

  async function remove() {
    setBusy("remove");
    try {
      setUser((await api.del<{ user: User }>("/profile/cv")).user);
      toast.success(d.profileCv.removed);
    } catch (err) {
      toast.error(message(err));
    } finally {
      setBusy(null);
    }
  }

  const loadReview = () => api.get<{ review: Review }>("/profile/cv/review").then((r) => r.review);

  return { upload, retry, remove, loadReview, busy };
}
